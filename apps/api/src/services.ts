/**
 * services.ts — 應用服務層
 *
 * - dataService: 包裝 DataProvider，提供 quote/fundamentals/history/analystTargets/snapshot
 * - llmService:  包裝 LLMClient，提供 chat
 * - analysisService: 串接 data + llm，做公允價值 / 走勢預測 / 報告
 * - watchlistStore: SQLite 持久化自選股
 *
 * 把服務層集中在這個檔，是為了避免目錄層級太深。
 * 如果未來單檔超過 600 行，再考慮依模組拆檔。
 */
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import {
  dataProvider,
  YFinanceProvider,
  toSymbol,
  DataProviderError,
} from '@fair-value-radar/data-providers';
import {
  createLLMClientFromEnv,
  readLLMConfigFromEnv,
  LLMConfigError,
  NotImplementedError,
  OpenAICompatibleClient,
  type LLMClient,
  type OpenAICompatibleConfig,
} from '@fair-value-radar/llm-clients';
import type {
  Quote, Fundamentals, OHLC, AnalystTargets, Symbol, Prediction, PredictionHorizon,
} from '@fair-value-radar/shared-types';
import {
  buildFairValueUserPrompt, FAIR_VALUE_SYSTEM_PROMPT,
  buildPredictionUserPrompt, PREDICTION_SYSTEM_PROMPT,
  buildChatUserPrompt, CHAT_SYSTEM_PROMPT,
} from './prompts.js';

// ===== dataService =====


// ============================================================
// LLM 回應處理（MiniMax-M2.7 是 reasoning model，會先 <think> 再給 JSON）
// ============================================================

/**
 * 從 LLM 回應中抽出 JSON。
 * 支援以下格式：
 *   - 純 JSON：`{...}`
 *   - 帶 markdown 圍欄：```json {...} ```
 *   - 帶 reasoning 前綴：<think>...</think>{...}
 *   - reasoning 與 JSON 混雜：<think>...{...}...<think>...{...}...
 *   - 文字內嵌 JSON：先 ... 後 {...} 再 ...
 */
export class LLMUpstreamError extends Error {
  override readonly name = 'LLMUpstreamError';
  readonly code = 'llm_upstream_error';
  readonly upstreamContent: string;
  override readonly cause?: unknown;
  readonly upstreamSample?: string;
  constructor(message: string, cause?: unknown, upstreamSample?: string) {
    super(message);
    this.upstreamContent = upstreamSample ?? '';
    if (cause !== undefined) this.cause = cause;
    if (upstreamSample !== undefined) this.upstreamSample = upstreamSample;
  }
}

export function extractJsonFromLLM<T = unknown>(raw: string): T {
  if (typeof raw !== 'string') {
    throw new LLMUpstreamError('LLM 回應不是字串');
  }
  const trimmed = raw.trim();

  // 策略 1：整段就是 JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch { /* 繼續往下 */ }
  }

  // 策略 2：包在 markdown 圍欄
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence) {
    try {
      return JSON.parse(fence[1] ? fence[1].trim() : '{}') as T;
    } catch { /* 繼續往下 */ }
  }

  // 策略 3：找最大 {...} 區塊（greedy）
  // 用 balanced bracket scan：從每個 { 開始找對應的 }
  let bestStart = -1, bestEnd = -1, bestLen = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== '{') continue;
    let depth = 1;
    let j = i + 1;
    while (j < trimmed.length && depth > 0) {
      if (trimmed[j] === '\\') { j += 2; continue; } // skip escaped chars
      if (trimmed[j] === '"') {
        // skip string literal
        let k = j + 1;
        while (k < trimmed.length && trimmed[k] !== '"') {
          if (trimmed[k] === '\\') k++;
          k++;
        }
        j = k + 1;
        continue;
      }
      if (trimmed[j] === '{') depth++;
      else if (trimmed[j] === '}') depth--;
      j++;
    }
    if (depth === 0 && j - i > bestLen) {
      bestStart = i;
      bestEnd = j;
      bestLen = j - i;
    }
  }
  if (bestStart >= 0) {
    try {
      return JSON.parse(trimmed.slice(bestStart, bestEnd)) as T;
    } catch (e) {
      throw new LLMUpstreamError('LLM 回應含 {...} 但無法解析為 JSON', e, trimmed.slice(bestStart, Math.min(bestEnd, bestStart + 300)));
    }
  }

  throw new LLMUpstreamError('LLM 回應中找不到 JSON 物件', null, trimmed.slice(0, 300));
}

export const dataService = {
  async quote(s: Symbol | string): Promise<Quote> {
    return dataProvider.getQuote(s);
  },
  async fundamentals(s: Symbol | string): Promise<Fundamentals> {
    return dataProvider.getFundamentals(s);
  },
  async history(s: Symbol | string, period?: string, interval?: string): Promise<OHLC[]> {
    return dataProvider.getHistory(s, period, interval);
  },
  async analystTargets(s: Symbol | string): Promise<AnalystTargets> {
    return dataProvider.getAnalystTargets(s);
  },
  async snapshot(s: Symbol | string): Promise<{
    symbol: Symbol;
    quote: Quote;
    fundamentals: Fundamentals;
    analystTargets: AnalystTargets;
  }> {
    const sym = typeof s === 'string' ? toSymbol(s) : s;
    const [quote, fundamentals, analystTargets] = await Promise.all([
      dataProvider.getQuote(sym),
      dataProvider.getFundamentals(sym),
      dataProvider.getAnalystTargets(sym),
    ]);
    return { symbol: sym, quote, fundamentals, analystTargets };
  },
};

// ===== llmService =====

let _llmSingleton: LLMClient | null = null;

function tryLLM(): LLMClient | null {
  try {
    // 優先用 settings store（DB），fallback env
    const cfg = getLLMConfig();
    if (!cfg.apiKey) {
      // 沒 key 試 env（讓 errorhandler 給 503）
      return createLLMClientFromEnv();
    }
    return new OpenAICompatibleClient({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
    });
  } catch (err) {
    if (err instanceof LLMConfigError) return null;
    throw err;
  }
}

export const llmService = {
  hasKey(): boolean {
    try {
      const cfg = getLLMConfig();
      return !!cfg.apiKey;
    } catch { return false; }
  },
  async chat(symbol: Symbol | string, question: string, history?: Array<{ role: 'user'|'assistant'; content: string }>): Promise<{ answer: string; model: string; usage?: { totalTokens: number } }> {
    const client = tryLLM();
    if (!client) throw new LLMConfigError('LLM 尚未設定');
    const sym = typeof symbol === 'string' ? toSymbol(symbol) : symbol;
    const ctx = await dataService.snapshot(sym).catch(() => null);
    const messages = [
      { role: 'system' as const, content: CHAT_SYSTEM_PROMPT },
      ...((history ?? []).map((h) => ({ role: h.role, content: h.content })) as Array<{role:'system'|'user'|'assistant';content:string}>),
      { role: 'user' as const, content: buildChatUserPrompt(sym.ticker, question, ctx) },
    ];
    let resp;
    try {
      resp = await client.chat({ messages, temperature: 0.4, maxTokens: 800 });
    } catch (err) {
      throw new LLMUpstreamError(
        `LLM 呼叫失敗: ${err instanceof Error ? err.message : String(err)}`,
        err,
        undefined,
      );
    }
    return {
      answer: resp.content,
      model: resp.model,
      usage: resp.usage ? { totalTokens: resp.usage.totalTokens } : undefined,
    };
  },
};

// ===== analysisService =====

const FairValueSchema = z.object({
  low: z.number(),
  mean: z.number(),
  high: z.number(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

const PredictionSchema = z.object({
  horizon: z.enum(['1w', '1m', '3m', '12m']),
  fairValue: z.number(),
  confidence: z.number().min(0).max(1),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  rationale: z.string(),
});

export const analysisService = {
  async fairValue(s: Symbol | string): Promise<{ low: number; mean: number; high: number; confidence: number; rationale: string; model?: string }> {
    const client = tryLLM();
    if (!client) throw new LLMConfigError('LLM 尚未設定，請到 .env 填 OPENAI_API_KEY');
    const sym = typeof s === 'string' ? toSymbol(s) : s;
    const ctx = await dataService.snapshot(sym);
    const fundMap: Record<string, number | undefined> = {
      marketCap: ctx.fundamentals.marketCap,
      peRatio: ctx.fundamentals.peRatio,
      pbRatio: ctx.fundamentals.pbRatio,
      eps: ctx.fundamentals.eps,
      bookValue: ctx.fundamentals.bookValue,
      revenue: ctx.fundamentals.revenue,
      dividendYield: ctx.fundamentals.dividendYield,
    };
    const messages = [
      { role: 'system' as const, content: FAIR_VALUE_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildFairValueUserPrompt({
        symbol: sym.ticker, market: sym.market, currentPrice: ctx.quote.price,
        fundamentals: fundMap, analystTargets: ctx.analystTargets,
      }) },
    ];
    let resp;
    try {
      resp = await client.chat({ messages, temperature: 0.3, maxTokens: 600, jsonMode: true });
    } catch (err) {
      // LLM 上游錯誤（401/403/422/500/網路）→ 502 Bad Gateway
      throw new LLMUpstreamError(
        `LLM 呼叫失敗: ${err instanceof Error ? err.message : String(err)}`,
        err,
        undefined,
      );
    }
    let parsed: z.infer<typeof FairValueSchema>;
    try {
      parsed = FairValueSchema.parse(extractJsonFromLLM(resp.content));
    } catch (parseErr) {
      if (parseErr instanceof LLMUpstreamError) throw parseErr;
      throw new LLMUpstreamError(`LLM 回應無法解析為公允價值 JSON`, parseErr, String(resp.content).slice(0, 200));
    }
    await watchlistStore.insertPrediction(sym.ticker, '12m', parsed.mean, parsed.confidence, parsed.rationale, resp.model);
    return { ...parsed, model: resp.model };
  },

  async predict(s: Symbol | string, horizon: PredictionHorizon): Promise<Prediction> {
    const client = tryLLM();
    if (!client) throw new LLMConfigError('LLM 尚未設定');
    const sym = typeof s === 'string' ? toSymbol(s) : s;
    const ctx = await dataService.snapshot(sym);
    const fundMap: Record<string, number | undefined> = {
      marketCap: ctx.fundamentals.marketCap,
      peRatio: ctx.fundamentals.peRatio,
      pbRatio: ctx.fundamentals.pbRatio,
      eps: ctx.fundamentals.eps,
      bookValue: ctx.fundamentals.bookValue,
      revenue: ctx.fundamentals.revenue,
      dividendYield: ctx.fundamentals.dividendYield,
    };
    const messages = [
      { role: 'system' as const, content: PREDICTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildPredictionUserPrompt({
        symbol: sym.ticker, market: sym.market, horizon,
        currentPrice: ctx.quote.price, fundamentals: fundMap,
      }) },
    ];
    let resp;
    try {
      resp = await client.chat({ messages, temperature: 0.3, maxTokens: 500, jsonMode: true });
    } catch (err) {
      throw new LLMUpstreamError(
        `LLM 呼叫失敗: ${err instanceof Error ? err.message : String(err)}`,
        err,
        undefined,
      );
    }
    let parsed: z.infer<typeof PredictionSchema>;
    try {
      parsed = PredictionSchema.parse({ ...extractJsonFromLLM<Record<string, unknown>>(resp.content), horizon });
    } catch (parseErr) {
      if (parseErr instanceof LLMUpstreamError) throw parseErr;
      throw new LLMUpstreamError(`LLM 回應無法解析為預測 JSON`, parseErr, String(resp.content).slice(0, 200));
    }
    await watchlistStore.insertPrediction(sym.ticker, horizon, parsed.fairValue, parsed.confidence, parsed.rationale, resp.model);
    return { symbol: sym, horizon: parsed.horizon, fairValue: parsed.fairValue, confidence: parsed.confidence, rationale: parsed.rationale, generatedAt: Math.floor(Date.now()/1000), model: resp.model };
  },

  async report(s: Symbol | string): Promise<{
    symbol: Symbol; quote: Quote; fundamentals: Fundamentals; analystTargets: AnalystTargets;
    fairValue?: { low: number; mean: number; high: number; confidence: number; rationale: string };
    generatedAt: number;
  }> {
    const sym = typeof s === 'string' ? toSymbol(s) : s;
    const snap = await dataService.snapshot(sym);
    let fairValue: { low: number; mean: number; high: number; confidence: number; rationale: string } | undefined;
    try {
      fairValue = await this.fairValue(sym);
    } catch {
      // LLM 沒設定就略過，不讓整個 report 報錯
      fairValue = undefined;
    }
    return { ...snap, fairValue, generatedAt: Math.floor(Date.now()/1000) };
  },
};

// ===== watchlistStore (SQLite) =====

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'fair-value-radar.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
      ticker TEXT PRIMARY KEY,
      market TEXT NOT NULL CHECK (market IN ('US','HK')),
      name TEXT,
      added_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_watchlist_added_at ON watchlist(added_at);

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      horizon TEXT NOT NULL CHECK (horizon IN ('1w','1m','3m','12m')),
      fair_value REAL NOT NULL,
      confidence REAL NOT NULL,
      rationale TEXT,
      model TEXT,
      generated_at INTEGER NOT NULL,
      UNIQUE(ticker, horizon, generated_at)
    );
    CREATE INDEX IF NOT EXISTS idx_predictions_ticker ON predictions(ticker);
  `);
  return _db;
}

export const watchlistStore = {
  list(): string[] {
    return db().prepare('SELECT ticker FROM watchlist ORDER BY added_at DESC').all().map((r: unknown) => (r as { ticker: string }).ticker);
  },
  add(ticker: string): { ticker: string; market: 'US' | 'HK' } {
    const sym = toSymbol(ticker);
    db().prepare('INSERT OR IGNORE INTO watchlist (ticker, market, name, added_at) VALUES (?, ?, NULL, ?)').run(sym.ticker, sym.market, Math.floor(Date.now()/1000));
    return { ticker: sym.ticker, market: sym.market };
  },
  remove(ticker: string): boolean {
    const r = db().prepare('DELETE FROM watchlist WHERE ticker = ?').run(ticker.toUpperCase());
    return r.changes > 0;
  },
  insertPrediction(ticker: string, horizon: PredictionHorizon, fairValue: number, confidence: number, rationale: string, model?: string): void {
    db().prepare('INSERT OR IGNORE INTO predictions (ticker, horizon, fair_value, confidence, rationale, model, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(ticker.toUpperCase(), horizon, fairValue, confidence, rationale, model ?? null, Math.floor(Date.now()/1000));
  },
};

// ============================================================
// 設定（持久化 SQLite，重啟容器不丟）
// ============================================================

export interface ApiSettings {
  openaiBaseUrl: string;
  openaiApiKey: string;       // 注意：API key 在 SQLite 是明文，v1 個人用可接受
  openaiModel: string;
  searxngUrl: string;
  schedule: string;            // HH:MM 排程（v1 未實作）
}

export const DEFAULT_SETTINGS: ApiSettings = {
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.minimaxi.com/v1',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'MiniMax-M2.7',
  searxngUrl: process.env.SEARXNG_URL ?? 'http://host.docker.internal:8888',
  schedule: '08:00',
};

/** 讀當前生效的 LLM 設定（DB 優先，env fallback） */
export function getLLMConfig(): { baseUrl: string; apiKey: string; model: string } {
  const dbSettings = readSettingsFromDb();
  return {
    baseUrl: dbSettings?.openaiBaseUrl ?? DEFAULT_SETTINGS.openaiBaseUrl,
    apiKey: dbSettings?.openaiApiKey ?? DEFAULT_SETTINGS.openaiApiKey,
    model: dbSettings?.openaiModel ?? DEFAULT_SETTINGS.openaiModel,
  };
}

function dbInstance(): Database.Database { return db(); }

function readSettingsFromDb(): ApiSettings | null {
  try {
    const db = dbInstance();
    if (!db) return null;
    const row = db.prepare('SELECT openai_base_url, openai_api_key, openai_model, searxng_url, schedule FROM settings WHERE id = 1').get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      openaiBaseUrl: typeof row.openai_base_url === 'string' ? row.openai_base_url : DEFAULT_SETTINGS.openaiBaseUrl,
      openaiApiKey: typeof row.openai_api_key === 'string' ? row.openai_api_key : DEFAULT_SETTINGS.openaiApiKey,
      openaiModel: typeof row.openai_model === 'string' ? row.openai_model : DEFAULT_SETTINGS.openaiModel,
      searxngUrl: typeof row.searxng_url === 'string' ? row.searxng_url : DEFAULT_SETTINGS.searxngUrl,
      schedule: typeof row.schedule === 'string' ? row.schedule : DEFAULT_SETTINGS.schedule,
    };
  } catch {
    return null;
  }
}

/** 不回傳 api key 但顯示 mask 與 source */
export function getApiSettingsResponse(): ApiSettings & { hasKey: boolean; keySource: 'db' | 'env' | 'none' } {
  const dbSettings = readSettingsFromDb();
  const envSettings = DEFAULT_SETTINGS;
  const baseSettings = dbSettings ?? envSettings;
  const dbHasKey = !!dbSettings?.openaiApiKey;
  const envHasKey = !!envSettings.openaiApiKey;
  return {
    ...baseSettings,
    openaiApiKey: dbHasKey ? '***已設定***' : envHasKey ? '***(env)***' : '',
    hasKey: dbHasKey || envHasKey,
    keySource: dbHasKey ? 'db' : envHasKey ? 'env' : 'none',
  };
}

export function patchSettings(patch: Partial<ApiSettings>): ApiSettings {
  const db = dbInstance();
  // 確保 table 存在
  db.exec(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    openai_base_url TEXT NOT NULL DEFAULT '',
    openai_api_key TEXT NOT NULL DEFAULT '',
    openai_model TEXT NOT NULL DEFAULT '',
    searxng_url TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '08:00',
    updated_at INTEGER NOT NULL
  )`);
  // 確保 row id=1 存在
  const exists = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!exists) {
    db.prepare(`INSERT INTO settings (id, openai_base_url, openai_api_key, openai_model, searxng_url, schedule, updated_at)
               VALUES (1, '', '', '', '', '08:00', ?)`).run(Math.floor(Date.now() / 1000));
  }
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.openaiBaseUrl !== undefined) { sets.push('openai_base_url = ?'); values.push(patch.openaiBaseUrl); }
  if (patch.openaiApiKey !== undefined) { sets.push('openai_api_key = ?'); values.push(patch.openaiApiKey); }
  if (patch.openaiModel !== undefined) { sets.push('openai_model = ?'); values.push(patch.openaiModel); }
  if (patch.searxngUrl !== undefined) { sets.push('searxng_url = ?'); values.push(patch.searxngUrl); }
  if (patch.schedule !== undefined) { sets.push('schedule = ?'); values.push(patch.schedule); }
  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    db.prepare(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`).run(...values);
  }
  // 清掉 LLM singleton 緩存
  _llmSingleton = null;
  const updated = readSettingsFromDb();
  return updated ?? DEFAULT_SETTINGS;
}

export function clearApiKey(): ApiSettings {
  return patchSettings({ openaiApiKey: '' });
}


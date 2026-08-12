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
  type LLMClient,
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

function tryLLM(): LLMClient | null {
  try {
    return createLLMClientFromEnv();
  } catch (err) {
    if (err instanceof LLMConfigError) return null;
    throw err;
  }
}

export const llmService = {
  hasKey(): boolean {
    try { readLLMConfigFromEnv(); return true; } catch { return false; }
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
    const resp = await client.chat({ messages, temperature: 0.4, maxTokens: 800 });
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
    const resp = await client.chat({ messages, temperature: 0.3, maxTokens: 600, jsonMode: true });
    let parsed: z.infer<typeof FairValueSchema>;
    try {
      parsed = FairValueSchema.parse(JSON.parse(resp.content));
    } catch (parseErr) {
      throw new Error(`LLM 回應無法解析為公允價值 JSON: ${resp.content.slice(0, 200)}`, { cause: parseErr });
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
    const resp = await client.chat({ messages, temperature: 0.3, maxTokens: 500, jsonMode: true });
    let parsed: z.infer<typeof PredictionSchema>;
    try {
      parsed = PredictionSchema.parse({ ...JSON.parse(resp.content), horizon });
    } catch (parseErr) {
      throw new Error(`LLM 回應無法解析為預測 JSON: ${resp.content.slice(0, 200)}`, { cause: parseErr });
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

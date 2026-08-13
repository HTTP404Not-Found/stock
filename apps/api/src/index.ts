/**
 * Fair Value Radar - 後端 API 入口（M2）
 *
 * M2 路由一覽：
 *   GET  /health
 *   GET  /api/v1/ping
 *   GET  /api/v1/stocks/:symbol/quote
 *   GET  /api/v1/stocks/:symbol/fundamentals
 *   GET  /api/v1/stocks/:symbol/history?period=1y&interval=1d
 *   GET  /api/v1/stocks/:symbol/analyst-targets
 *   GET  /api/v1/stocks/:symbol/snapshot
 *   GET  /api/v1/watchlist
 *   POST /api/v1/watchlist            { ticker }
 *   DELETE /api/v1/watchlist/:ticker
 *   POST /api/v1/analysis/:symbol/fair-value
 *   POST /api/v1/analysis/:symbol/predict   { horizon: '1w'|'1m'|'3m'|'12m' }
 *   POST /api/v1/analysis/:symbol/report
 *   POST /api/v1/chat                 { symbol, question, history? }
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { config as loadEnv } from 'dotenv';
import { DataProviderError } from '@fair-value-radar/data-providers';
import {
  createLLMClientFromEnv,
  readLLMConfigFromEnv,
  LLMConfigError,
  NotImplementedError,
  type LLMClient,
} from '@fair-value-radar/llm-clients';
import { dataService, llmService, analysisService, watchlistStore } from './services.js';
import { newsService } from './news.js';

loadEnv();

const PORT = Number.parseInt(process.env.API_PORT ?? '4000', 10);
const HOST = process.env.API_HOST ?? '0.0.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const VERSION = '0.1.0';

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
  },
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: true });

// ===== 健康檢查 =====
app.get('/health', async () => ({ status: 'ok', uptime: process.uptime(), version: VERSION }));
app.get('/api/v1/ping', async () => ({ message: 'pong', version: VERSION }));

// ===== 個股 =====
app.get<{ Params: { symbol: string } }>('/api/v1/stocks/:symbol/quote', async (req) => {
  return dataService.quote(req.params.symbol);
});
app.get<{ Params: { symbol: string } }>('/api/v1/stocks/:symbol/fundamentals', async (req) => {
  return dataService.fundamentals(req.params.symbol);
});
app.get<{
  Params: { symbol: string };
  Querystring: { period?: string; interval?: string };
}>('/api/v1/stocks/:symbol/history', async (req) => {
  return dataService.history(req.params.symbol, req.query.period, req.query.interval);
});
app.get<{ Params: { symbol: string } }>('/api/v1/stocks/:symbol/analyst-targets', async (req) => {
  return dataService.analystTargets(req.params.symbol);
});
app.get<{ Params: { symbol: string } }>('/api/v1/stocks/:symbol/snapshot', async (req) => {
  return dataService.snapshot(req.params.symbol);
});

// ===== 自選股 =====
app.get('/api/v1/watchlist', async () => watchlistStore.list());

// ===== 設定（持久化 SQLite，重啟容器不丟）=====
import { getApiSettingsResponse, patchSettings, clearApiKey, DEFAULT_SETTINGS, getLLMConfig } from './services.js';

// SettingsPatchSchema 移除：直接用 Record<string, unknown> 處理（避免 Fastify ajv 驗證衝突）

app.get('/api/v1/settings', async () => getApiSettingsResponse());

app.put('/api/v1/settings', async (req) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updated = patchSettings({
    openaiBaseUrl: typeof body.openaiBaseUrl === 'string' ? body.openaiBaseUrl : undefined,
    openaiApiKey: typeof body.openaiApiKey === 'string' ? body.openaiApiKey : undefined,
    openaiModel: typeof body.openaiModel === 'string' ? body.openaiModel : undefined,
    searxngUrl: typeof body.searxngUrl === 'string' ? body.searxngUrl : undefined,
    schedule: typeof body.schedule === 'string' ? body.schedule : undefined,
  });
  return { ...updated, hasKey: !!updated.openaiApiKey, keySource: updated.openaiApiKey ? 'db' : 'env' };
});

app.delete('/api/v1/settings/openai-api-key', async () => {
  const cleared = clearApiKey();
  return { ...cleared, hasKey: false, keySource: 'none', message: '已清除 API key' };
});

// 測試 LLM 連線（用目前 settings 真的 call 一次）
app.post('/api/v1/settings/test', async (req, reply) => {
  try {
    const cfg = getLLMConfig();
    if (!cfg.apiKey) {
      return reply.status(503).send({ ok: false, message: '尚未設定 API key' });
    }
    // 用 minimal test prompt
    const testResp = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });
    if (!testResp.ok) {
      const errText = await testResp.text();
      return reply.status(502).send({
        ok: false,
        message: `${testResp.status}: ${errText.slice(0, 200)}`,
      });
    }
    const data = await testResp.json() as { model?: string };
    return { ok: true, model: data.model ?? cfg.model };
  } catch (e) {
    return reply.status(502).send({ ok: false, message: e instanceof Error ? e.message : String(e) });
  }
});

const AddWatchSchema = z.object({ ticker: z.string().min(1).max(20) });
app.post<{ Body: z.infer<typeof AddWatchSchema> }>('/api/v1/watchlist', async (req, reply) => {
  const body = AddWatchSchema.parse(req.body);
  const result = watchlistStore.add(body.ticker);
  reply.status(201);
  return result;
});

app.delete<{ Params: { ticker: string } }>('/api/v1/watchlist/:ticker', async (req, reply) => {
  const removed = watchlistStore.remove(req.params.ticker);
  reply.status(removed ? 204 : 404);
  return removed ? null : { error: 'not found' };
});

// ===== 分析 =====
app.post<{ Params: { symbol: string } }>('/api/v1/analysis/:symbol/fair-value', async (req) => {
  return analysisService.fairValue(req.params.symbol);
});

const PredictSchema = z.object({ horizon: z.enum(['1w', '1m', '3m', '12m']) });
app.post<{
  Params: { symbol: string };
  Body: z.infer<typeof PredictSchema>;
}>('/api/v1/analysis/:symbol/predict', async (req) => {
  const body = PredictSchema.parse(req.body);
  return analysisService.predict(req.params.symbol, body.horizon);
});

app.post<{ Params: { symbol: string } }>('/api/v1/analysis/:symbol/report', async (req) => {
  return analysisService.report(req.params.symbol);
});

// ===== LLM 互動問股 =====
const ChatSchema = z.object({
  symbol: z.string().min(1).max(20),
  question: z.string().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .optional(),
});
app.post<{ Body: z.infer<typeof ChatSchema> }>('/api/v1/chat', async (req) => {
  const body = ChatSchema.parse(req.body);
  return llmService.chat(body.symbol, body.question, body.history);
});

// ===== 新聞（M3）=====
app.get<{
  Params: { symbol: string };
  Querystring: { name?: string };
}>('/api/v1/news/:symbol', async (req) => {
  return newsService.fetchAndInterpret(req.params.symbol, req.query.name);
});

// ===== 錯誤處理 =====
app.setErrorHandler((error, request, reply) => {
  const err = error as Error & { statusCode?: number; validation?: unknown };
  // Zod 驗證失敗 → 400
  if (err.name === 'ZodError' || (error as unknown as { validation?: unknown }).validation) {
    reply.status(400).send({ error: 'validation_error', message: err.message });
    return;
  }
  // LLM 設定缺失 → 503
  if (err instanceof LLMConfigError) {
    request.log.warn({ err: err.message }, 'LLM 未設定');
    reply.status(503).send({ error: 'llm_not_configured', message: err.message });
    return;
  }
  // DataProvider 錯誤 → 502
  if (err instanceof DataProviderError) {
    request.log.error({ err: err.message }, '資料源錯誤');
    reply.status(502).send({ error: err.code, message: err.message });
    return;
  }
  // LLM 回應格式無法解析（reasoning model 沒給 JSON）→ 502
  if (err.name === 'LLMUpstreamError' || (err as { code?: string }).code === 'llm_upstream_error') {
    request.log.error({ err: err.message, sample: (err as { upstreamContent?: string }).upstreamContent?.slice(0, 200) }, 'LLM 上游回應無法解析');
    reply.status(502).send({ error: 'llm_upstream_error', message: err.message });
    return;
  }
  // NotImplemented → 501
  if (err instanceof NotImplementedError) {
    reply.status(501).send({ error: 'not_implemented', message: err.message });
    return;
  }
  // 其他 → 500
  request.log.error(err);
  reply.status(err.statusCode ?? 500).send({ error: err.name, message: err.message });
});

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`🎯 Fair Value Radar API listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error({ err: String(err) });
  process.exit(1);
}
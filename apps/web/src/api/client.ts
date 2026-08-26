import axios, { type AxiosInstance } from 'axios';

/**
 * Shared axios instance.
 *
 * - dev: Vite proxies `/api` to backend (e.g. http://localhost:4000)
 * - prod: nginx forwards `/api/` to api container
 * - override base via VITE_API_BASE env var
 */
export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api/v1',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: 預設所有 API 要求 zh-Hant 回應
api.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = 'zh-Hant';
  return config;
});

// Response interceptor: 統一錯誤處理 + 自動 retry + log
//   - 5xx 自動 retry 一次（500ms 延遲）— 可能是暫時性錯誤
//   - 503/4xx 不 retry — 配置錯或參數錯 retry 沒用
//   - network error（沒 response）retry 一次
const RETRIED = '__fvr_retried__';
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

api.interceptors.response.use(
  (r) => r,
  async (err: unknown) => {
    const e = err as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
      config?: { method?: string; url?: string; headers?: Record<string, unknown> };
    };
    const status = e.response?.status;
    const cfg = e.config as (typeof e.config & { [RETRIED]?: boolean }) | undefined;
    const alreadyRetried = cfg?.[RETRIED];
    const shouldRetry = !alreadyRetried && (status == null || (status >= 500 && status < 600));

    if (shouldRetry) {
      // 標記已 retry
      if (cfg) cfg[RETRIED] = true;
      await sleep(600);
      // eslint-disable-next-line no-console
      console.info(`🔄 [API] retrying ${cfg?.method?.toUpperCase() ?? '?'} ${cfg?.url ?? '?'}`);
      try {
        return await api.request(cfg as unknown as Parameters<typeof api.request>[0]);
      } catch (retryErr) {
        return Promise.reject(retryErr);
      }
    }

    const message = e.response?.data?.message ?? e.message ?? 'unknown error';
    if (status === 503) {
      // eslint-disable-next-line no-console
      console.warn('🔑 LLM API key 尚未設定，請到設定頁填寫');
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `[API] ${e.config?.method?.toUpperCase() ?? '?'} ${e.config?.url ?? '?'} → ${status ?? '?'}`,
        message,
      );
    }
    return Promise.reject(err);
  },
);

// ====== Typed API surface ======
// 後端回傳的結構完全符合 shared-types，這裡直接重用，無需另外宣告 DTO。
import type {
  Quote, Fundamentals, OHLC, AnalystTargets, SnapshotResponse,

  Prediction, PredictionHorizon,
} from '@fair-value-radar/shared-types';

export const stocksApi = {
  quote: (symbol: string): Promise<Quote> =>
    api.get<Quote>(`/stocks/${encodeURIComponent(symbol)}/quote`).then((r) => r.data),
  fundamentals: (symbol: string): Promise<Fundamentals> =>
    api.get<Fundamentals>(`/stocks/${encodeURIComponent(symbol)}/fundamentals`).then((r) => r.data),
  history: (symbol: string, period = '1y'): Promise<OHLC[]> =>
    api.get<OHLC[]>(`/stocks/${encodeURIComponent(symbol)}/history`, {
      params: { period },
    }).then((r) => r.data),
  analystTargets: (symbol: string): Promise<AnalystTargets> =>
    api.get<AnalystTargets>(`/stocks/${encodeURIComponent(symbol)}/analyst-targets`).then((r) => r.data),
  snapshot: (symbol: string): Promise<SnapshotResponse> =>
    api.get<SnapshotResponse>(`/stocks/${encodeURIComponent(symbol)}/snapshot`).then((r) => r.data),
};

export const watchlistApi = {
  list: (): Promise<string[]> => api.get<string[]>('/watchlist').then((r) => r.data),
  add: (ticker: string) =>
    api.post<{ ok: true; ticker: string; market: string }>('/watchlist', { ticker }).then((r) => r.data),
  remove: (ticker: string) =>
    api.delete<{ ok: true; ticker: string }>(`/watchlist/${encodeURIComponent(ticker)}`).then((r) => r.data),
};

export const analysisApi = {
  fairValue: (symbol: string) =>
    api.post(`/analysis/${encodeURIComponent(symbol)}/fair-value`).then((r) => r.data),
  predict: (symbol: string, horizon: PredictionHorizon): Promise<Prediction> =>
    api.post<Prediction>(`/analysis/${encodeURIComponent(symbol)}/predict`, { horizon }).then((r) => r.data),
  report: (symbol: string) =>
    api.post(`/analysis/${encodeURIComponent(symbol)}/report`).then((r) => r.data),
};

export interface ChatAnswer {
  answer: string;
  model: string;
  usage?: { totalTokens?: number };
}

export const chatApi = {
  ask: (symbol: string, question: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<ChatAnswer> =>
    api.post<ChatAnswer>('/chat', { symbol, question, history }).then((r) => r.data),
};

// ===== 新聞（接 SearXNG + 後端 LLM 解讀）=====
export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedAt?: string;
}

export interface NewsSummary {
  symbol: string;
  fetchedAt: number;
  raw: NewsItem[];
  llmInterpretation?: string;
  interpretationModel?: string;
}

export const newsApi = {
  fetch: (symbol: string, name?: string): Promise<NewsSummary> => {
    const params = name ? { name } : undefined;
    return api.get<NewsSummary>(`/news/${encodeURIComponent(symbol)}`, { params }).then((r) => r.data);
  },
};

// ===== 設定 =====
export interface ApiSettings {
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  searxngUrl: string;
  schedule: string;
  hasKey: boolean;
  keySource: 'db' | 'env' | 'none';
}

export const settingsApi = {
  get: (): Promise<ApiSettings> => api.get<ApiSettings>('/settings').then((r) => r.data),
  patch: (patch: Partial<ApiSettings>): Promise<ApiSettings> =>
    api.put<ApiSettings>('/settings', patch).then((r) => r.data),
  clearKey: (): Promise<ApiSettings> =>
    api.delete<ApiSettings>('/settings/openai-api-key').then((r) => r.data),
  test: (): Promise<{ ok: boolean; message?: string; model?: string }> =>
    api.post<{ ok: boolean; message?: string; model?: string }>('/settings/test', {}).then((r) => r.data),
};
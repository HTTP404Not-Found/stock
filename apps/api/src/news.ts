/**
 * news.ts — 新聞模組
 *
 * 從 SearXNG（http://localhost:8888）搜尋股票相關新聞，再用 LLM 解讀成繁中摘要。
 *
 * 設計重點：
 * - SearXNG 失敗要 fallback 成空陣列，不要讓整個 endpoint 壞掉
 * - LLM 沒設定或失敗時，llmInterpretation 為 undefined（前端可優雅降級）
 * - service 層不接 Fastify logger（router 層才有），統一用 console.warn
 */
import { LLMConfigError } from '@fair-value-radar/llm-clients';
import {
  NEWS_INTERPRETATION_SYSTEM_PROMPT,
  buildNewsInterpretationPrompt,
} from './newsPrompts.js';

/** 單則新聞的最小資料模型。 */
export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  /** 來源引擎（SearXNG 給的，例如 "bing news"、"google news"） */
  source?: string;
  /** 發布時間（ISO 字串，SearXNG 可能沒給） */
  publishedAt?: string;
}

/** 新聞彙整結果：原始新聞 +（可選）LLM 解讀。 */
export interface NewsSummary {
  symbol: string;
  /** Unix timestamp（秒） */
  fetchedAt: number;
  raw: NewsItem[];
  /** LLM 解讀（沒 key 或失敗時為 undefined） */
  llmInterpretation?: string;
  interpretationModel?: string;
}

const SEARXNG_URL = process.env.SEARXNG_URL ?? 'http://localhost:8888';
/** SearXNG 之前會 timeout，這裡給 8 秒上限（<= 10 秒上限規範） */
const TIMEOUT_MS = 8_000;

/**
 * 從 SearXNG 搜尋單一關鍵字。
 *
 * @param query 搜尋字串
 * @param maxResults 最多取幾筆（預設 8）
 * @returns SearXNG 回傳的結果（已 map 成 NewsItem）
 */
async function searxngSearch(query: string, maxResults = 8): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // SearXNG 對 language 接受 zh-TW / zh-CN / zh / en；zh-Hant 會 400
    const url =
      `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}` +
      `&format=json&categories=news&language=zh-TW&time_range=week`;
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`SearXNG 回 ${resp.status}`);
    const data = (await resp.json()) as {
      results?: Array<{
        title: string;
        url: string;
        content?: string;
        engine?: string;
        publishedDate?: string;
      }>;
    };
    return (data.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content ?? '',
      source: r.engine,
      publishedAt: r.publishedDate,
    }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 用 console.warn 替代 Fastify logger，因為 service 層取不到 req.log。
 * 不要把這層擴大成共用 logger，避免污染其他模組。
 */
function appLogWarn(msg: string): void {
  console.warn(`[news] ${msg}`);
}

/**
 * 抓新聞 + LLM 解讀的入口。
 * SearXNG 或 LLM 任一失敗都會被 swallow，整個 endpoint 仍能回 200。
 */
export const newsService = {
  /**
   * 抓該股票最近一週的新聞並（若有 LLM）解讀成繁中摘要。
   *
   * @param symbol 股票代號（例：AAPL、0700.HK）
   * @param companyName 公司名稱（可選，用來強化搜尋字串）
   * @returns 新聞彙整結果
   */
  async fetchAndInterpret(symbol: string, companyName?: string): Promise<NewsSummary> {
    const query = `${companyName ?? symbol} ${symbol} 股票 新聞`;
    const raw = await searxngSearch(query).catch((err: Error) => {
      appLogWarn(`SearXNG 失敗: ${err.message}`);
      return [];
    });

    const summary: NewsSummary = {
      symbol,
      fetchedAt: Math.floor(Date.now() / 1000),
      raw,
    };

    // 若有 LLM key，做解讀
    try {
      const { createLLMClientFromEnv } = await import('@fair-value-radar/llm-clients');
      const llm = createLLMClientFromEnv();
      const prompt = buildNewsInterpretationPrompt(symbol, raw);
      const resp = await llm.chat({
        messages: [
          { role: 'system', content: NEWS_INTERPRETATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 600,
      });
      summary.llmInterpretation = resp.content;
      summary.interpretationModel = resp.model;
    } catch (err) {
      if (!(err instanceof LLMConfigError)) {
        appLogWarn(
          `新聞 LLM 解讀失敗: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      // 沒 key 或 LLM 失敗就略過，不讓整個 endpoint 壞掉
    }
    return summary;
  },
};
/**
 * data-providers — 行情/基本面/分析師目標價的統一介面
 *
 * 目前只實作 YFinanceProvider（用 yahoo-finance2）。
 * 未來可加 LongbridgeProvider / FinnhubProvider / AkShareProvider，全部
 * 透過 DataProvider 介面對外。
 */
import YahooFinance from 'yahoo-finance2';
import type {
  Quote,
  Fundamentals,
  OHLC,
  AnalystTargets,
  Symbol,
  Market,
} from '@fair-value-radar/shared-types';

// yahoo-finance2 v4 預設會印 notice，把它關掉
// suppressNotices 只接受 NOTICE_IDS 列舉（看 yahoo-finance2 型別）
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export class DataProviderError extends Error {
  declare readonly cause?: unknown;
  constructor(public readonly code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'DataProviderError';
    if (cause !== undefined) this.cause = cause;
  }
}

export interface DataProvider {
  readonly name: string;
  getQuote(symbol: Symbol | string): Promise<Quote>;
  getFundamentals(symbol: Symbol | string): Promise<Fundamentals>;
  getHistory(symbol: Symbol | string, period?: string, interval?: string): Promise<OHLC[]>;
  getAnalystTargets(symbol: Symbol | string): Promise<AnalystTargets>;
}

/** 從 ticker 字串判斷市場別 */
export function toSymbol(ticker: string): Symbol {
  const upper = ticker.trim().toUpperCase();
  const market: Market = upper.endsWith('.HK') ? 'HK' : 'US';
  return { ticker: upper, market };
}

/** 簡單 TTL 快取，避免 yfinance 限流 */
class TTLCache<K, V> {
  private store = new Map<K, { value: V; expires: number }>();
  constructor(private ttlMs: number) {}
  get(key: K): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }
  set(key: K, value: V): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

const cache = new TTLCache<string, unknown>(60_000);

/** 速率限制：每個請求至少間隔 rateMs 毫秒 */
let lastCallAt = 0;
async function throttle(rateMs: number): Promise<void> {
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < rateMs) await new Promise((r) => setTimeout(r, rateMs - elapsed));
  lastCallAt = Date.now();
}

export class YFinanceProvider implements DataProvider {
  readonly name = 'yfinance';

  constructor(private readonly rateMs = Number(process.env.YFINANCE_RATE_LIMIT_MS ?? '200')) {}

  private resolve(symbol: Symbol | string): Symbol {
    if (typeof symbol === 'string') return toSymbol(symbol);
    return symbol;
  }

  async getQuote(symbol: Symbol | string): Promise<Quote> {
    const s = this.resolve(symbol);
    const key = `quote:${s.ticker}`;
    const hit = cache.get(key);
    if (hit) return hit as Quote;

    await throttle(this.rateMs);
    try {
      const q = await yf.quote(s.ticker);
      const result: Quote = {
        symbol: s,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? undefined,
        changePct: q.regularMarketChangePercent != null ? q.regularMarketChangePercent / 100 : undefined,
        asOf: (q.regularMarketTime ?? Math.floor(Date.now() / 1000)),
        currency: (q.currency === 'HKD' ? 'HKD' : 'USD') as Quote['currency'],
      };
      cache.set(key, result);
      return result;
    } catch (err) {
      throw new DataProviderError('YF_QUOTE_FAILED', `yfinance quote 失敗: ${s.ticker}`, err);
    }
  }

  async getFundamentals(symbol: Symbol | string): Promise<Fundamentals> {
    const s = this.resolve(symbol);
    const key = `fund:${s.ticker}`;
    const hit = cache.get(key);
    if (hit) return hit as Fundamentals;

    await throttle(this.rateMs);
    try {
      const sum = await yf.quoteSummary(s.ticker, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData'],
      });
      const detail = sum.summaryDetail as unknown as Record<string, unknown> | undefined;
      const ks = sum.defaultKeyStatistics as unknown as Record<string, unknown> | undefined;
      const fin = sum.financialData as unknown as Record<string, unknown> | undefined;
      const num = (v: unknown): number | undefined =>
        typeof v === 'number' ? v : undefined;
      const result: Fundamentals = {
        symbol: s,
        marketCap: num(detail?.['marketCap']),
        peRatio: num(detail?.['trailingPE']) ?? num(ks?.['trailingPE']),
        pbRatio: num(ks?.['priceToBook']),
        dividendYield: num(detail?.['dividendYield']),
        eps: num(ks?.['trailingEps']),
        bookValue: num(ks?.['bookValue']),
        revenue: num(fin?.['totalRevenue']),
        asOf: Math.floor(Date.now() / 1000),
      };
      cache.set(key, result);
      return result;
    } catch (err) {
      throw new DataProviderError('YF_FUNDAMENTALS_FAILED', `yfinance fundamentals 失敗: ${s.ticker}`, err);
    }
  }

  async getHistory(symbol: Symbol | string, period = '1y', interval = '1d'): Promise<OHLC[]> {
    const s = this.resolve(symbol);
    const key = `hist:${s.ticker}:${period}:${interval}`;
    const hit = cache.get(key);
    if (hit) return hit as OHLC[];

    await throttle(this.rateMs);
    try {
      const chart = await yf.chart(s.ticker, {
        period1: this.periodToDate(period),
        interval: interval as never,
      });
      const result: OHLC[] = (chart.quotes ?? [])
        .map((q): OHLC | null => {
          const close = q.close;
          if (close == null) return null;
          return {
            t: Math.floor(new Date(q.date).getTime() / 1000),
            open: q.open ?? 0,
            high: q.high ?? 0,
            low: q.low ?? 0,
            close,
            volume: q.volume ?? 0,
          };
        })
        .filter((x): x is OHLC => x !== null);
      cache.set(key, result);
      return result;
    } catch (err) {
      throw new DataProviderError('YF_HISTORY_FAILED', `yfinance history 失敗: ${s.ticker}`, err);
    }
  }

  async getAnalystTargets(symbol: Symbol | string): Promise<AnalystTargets> {
    const s = this.resolve(symbol);
    const key = `analyst:${s.ticker}`;
    const hit = cache.get(key);
    if (hit) return hit as AnalystTargets;

    await throttle(this.rateMs);
    try {
      const sum = await yf.quoteSummary(s.ticker, {
        modules: ['financialData', 'recommendationTrend'],
      });
      const fin = sum.financialData as unknown as Record<string, unknown> | undefined;
      const trend = (sum.recommendationTrend?.trend ?? []) as Array<Record<string, unknown>>;
      const latest = trend[0];
      const num = (v: unknown): number | undefined =>
        typeof v === 'number' ? v : undefined;
      const ratings = latest
        ? {
            buy: (num(latest['strongBuy']) ?? 0) + (num(latest['buy']) ?? 0),
            hold: num(latest['hold']) ?? 0,
            sell: (num(latest['sell']) ?? 0) + (num(latest['strongSell']) ?? 0),
          }
        : undefined;
      const result: AnalystTargets = {
        symbol: s,
        low: num(fin?.['targetLowPrice']),
        mean: num(fin?.['targetMeanPrice']),
        median: num(fin?.['targetMedianPrice']),
        high: num(fin?.['targetHighPrice']),
        ratings,
        asOf: Math.floor(Date.now() / 1000),
      };
      cache.set(key, result);
      return result;
    } catch (err) {
      throw new DataProviderError('YF_ANALYST_FAILED', `yfinance analyst 失敗: ${s.ticker}`, err);
    }
  }

  private periodToDate(period: string): Date {
    const now = new Date();
    const map: Record<string, number> = {
      '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825, '10y': 3650,
    };
    const days = map[period] ?? 365;
    return new Date(now.getTime() - days * 86400 * 1000);
  }
}

export const dataProvider: DataProvider = new YFinanceProvider();

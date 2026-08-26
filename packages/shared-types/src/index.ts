/**
 * shared-types - 跨前後端的共享 TypeScript 型別
 *
 * 此 package 為「純型別」，不應包含任何 runtime 程式碼。
 * 前後端都從這裡 import 型別，避免重複定義導致不一致。
 *
 * ⚠️ 變更此檔會同時影響 api 與 web，屬於「跨邊界型別」，
 *    修改前請通知所有相關 agent，並先跑 pnpm typecheck。
 */

// === 市場 / 標的 ===

/** 支援的市場代碼 */
export type Market = 'US' | 'HK';

/** 股票代號（包含交易所後綴，如 "AAPL"、"0700.HK"） */
export interface Symbol {
  /** 顯示用的 ticker，例如 "AAPL"、"0700.HK" */
  ticker: string;
  /** 所屬市場 */
  market: Market;
  /** 公司名稱（可選，爬蟲抓到後補上） */
  name?: string;
  /** Yahoo Finance 用 symbol，例如 "AAPL"、"0700.HK" */
  yfSymbol?: string;
}

// === 行情 / K線 ===

/** OHLC K線單點 */
export interface OHLC {
  /** Unix timestamp（秒） */
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 成交量（股） */
  volume: number;
}

/** 即時報價 */
export interface Quote {
  symbol: Symbol;
  /** 最新成交價 */
  price: number;
  /** 漲跌（絕對值） */
  change?: number;
  /** 漲跌百分比（0.0123 表示 +1.23%） */
  changePct?: number;
  /** 報價時間 Unix timestamp（秒） */
  asOf: number;
  currency: 'USD' | 'HKD' | 'CNY';
}

// === 基本面 ===

export interface Fundamentals {
  symbol: Symbol;
  /** 市值 */
  marketCap?: number;
  /** 本益比 (TTM) */
  peRatio?: number;
  /** 股價淨值比 */
  pbRatio?: number;
  /** 股息殖利率 */
  dividendYield?: number;
  /** 每股盈餘 (TTM) */
  eps?: number;
  /** 每股淨值 */
  bookValue?: number;
  /** 營收 (TTM) */
  revenue?: number;
  /** 更新時間 */
  asOf: number;
}

// === 分析師目標價 ===

export interface AnalystTargets {
  symbol: Symbol;
  /** 目標價低點 */
  low?: number;
  /** 目標價平均 */
  mean?: number;
  /** 目標價中位數 */
  median?: number;
  /** 目標價高點 */
  high?: number;
  /** 評等：buy / hold / sell 票數 */
  ratings?: { buy: number; hold: number; sell: number };
  asOf: number;
}

// === 預測結果（由 LLM 或量化模型產出） ===

export type PredictionHorizon = '1w' | '1m' | '3m' | '12m';

export interface Prediction {
  symbol: Symbol;
  horizon: PredictionHorizon;
  /** 預測目標價（合理估值） */
  fairValue: number;
  /** 信心分數 0..1 */
  confidence: number;
  /** 預測依據 / 模型說明 */
  rationale?: string;
  /** 預測產生時間 */
  generatedAt: number;
  /** 使用的模型 / provider */
  model?: string;
}

// === 通用工具型別 ===

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface Pagination {
  page: number;
  pageSize: number;
}


/** /stocks/:sym/snapshot 端點的回傳型別（綜合 quote + fundamentals + analystTargets） */
export interface SnapshotResponse {
  symbol: Symbol;
  quote: Quote;
  fundamentals?: Fundamentals;
  analystTargets?: AnalystTargets;
  generatedAt?: number;
}

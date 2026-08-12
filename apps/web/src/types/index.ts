// 從 shared-types 引入真實型別，再加前端專屬擴充。
// workspace dep 已透過 apps/web/package.json 設定。
import type { Quote, Fundamentals, AnalystTargets, OHLC } from '@fair-value-radar/shared-types';

export type { Quote, Fundamentals, AnalystTargets, OHLC };

export type Sentiment = 'bullish' | 'neutral' | 'bearish';

export interface StockSnapshot {
  symbol: string;
  name?: string;
  price: number;
  change?: number;
  changePct?: number;
  fairValue?: number;
  deviationPct?: number;
  sentiment?: Sentiment;
}

export interface FairValueResult {
  low: number;
  mean: number;
  high: number;
  confidence: number;
  rationale: string;
  model?: string;
}

export interface PredictionResult {
  horizon: '1w' | '1m' | '3m' | '12m';
  sentiment: Sentiment;
  confidence: number;
  fairValue: number;
  rationale: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WatchlistAddPayload {
  symbol: string;
}
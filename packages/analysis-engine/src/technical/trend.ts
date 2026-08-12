/**
 * 走勢趨勢判定（Trend Judge）
 *
 * 根據收盤價序列、最新 MACD 與 RSI 訊號，給出看多（bullish）/
 * 看淡（bearish）/ 中性（neutral）標籤與信心度（0..1）。
 *
 * 規則（任務書定義）：
 *   bullish（加總每個符合條件 +1，max = 3）：
 *     - 收盤價 > 50 日均線
 *     - MACD > 0
 *     - RSI 介於 50..70
 *   bearish：
 *     - 收盤價 < 200 日均線
 *     - MACD < 0
 *     - RSI < 30
 *   其他皆為 neutral
 *
 * 信心度計算：
 *   - bullish：0.3 + 0.2 * 符合條件數（符合 3 個 = 0.9，2 個 = 0.7，1 個 = 0.5）
 *   - bearish：同上
 *   - neutral：0.5（除非技術指標完全中性，否則降為 0.3）
 *
 * reasons 為繁體中文，給下游 LLM 與 UI 直接使用。
 */

import type { MACDPoint } from './macd.js';

export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface TrendResult {
  sentiment: Sentiment;
  confidence: number;
  reasons: string[];
}

export interface TrendInput {
  closes: number[];
  macdSeries: MACDPoint[];
  rsiSeries: (number | undefined)[];
  /** 50 日均線；可由呼叫端預計算以避免重複 */
  ma50?: number;
  /** 200 日均線；同上 */
  ma200?: number;
}

export function judgeTrend(input: TrendInput): TrendResult {
  const { closes, macdSeries, rsiSeries, ma50, ma200 } = input;

  if (closes.length === 0) {
    return { sentiment: 'neutral', confidence: 0, reasons: ['收盤價序列為空，無法判定'] };
  }

  const lastClose = closes[closes.length - 1] as number;
  const lastMacd = macdSeries.length > 0 ? macdSeries[macdSeries.length - 1] : undefined;
  const lastRsi = rsiSeries[rsiSeries.length - 1];

  const reasons: string[] = [];

  // MA50 / MA200
  const computedMa50 = ma50 ?? simpleMA(closes, 50);
  const computedMa200 = ma200 ?? simpleMA(closes, 200);

  // === Bullish checks ===
  const bullishChecks = {
    aboveMa50: computedMa50 !== null && lastClose > computedMa50,
    macdPositive: lastMacd !== undefined && lastMacd.macd > 0,
    rsiStrong: lastRsi !== undefined && lastRsi >= 50 && lastRsi <= 70,
  };
  const bullishCount = Object.values(bullishChecks).filter(Boolean).length;

  // === Bearish checks ===
  const bearishChecks = {
    belowMa200: computedMa200 !== null && lastClose < computedMa200,
    macdNegative: lastMacd !== undefined && lastMacd.macd < 0,
    rsiWeak: lastRsi !== undefined && lastRsi < 30,
  };
  const bearishCount = Object.values(bearishChecks).filter(Boolean).length;

  // Build reasons in 繁中
  if (computedMa50 !== null) {
    if (bullishChecks.aboveMa50) {
      reasons.push(`收盤價 ${lastClose.toFixed(2)} 高於 50 日均線 ${computedMa50.toFixed(2)}`);
    } else if (computedMa50 > 0) {
      reasons.push(`收盤價 ${lastClose.toFixed(2)} 低於 50 日均線 ${computedMa50.toFixed(2)}`);
    }
  }
  if (lastMacd !== undefined) {
    if (bullishChecks.macdPositive) {
      reasons.push(`MACD 為 ${lastMacd.macd.toFixed(3)}，在零軸之上`);
    } else if (bearishChecks.macdNegative) {
      reasons.push(`MACD 為 ${lastMacd.macd.toFixed(3)}，在零軸之下`);
    } else {
      reasons.push(`MACD 為 ${lastMacd.macd.toFixed(3)}，接近零軸`);
    }
  }
  if (lastRsi !== undefined) {
    if (bullishChecks.rsiStrong) {
      reasons.push(`RSI 為 ${lastRsi.toFixed(1)}，介於強勢區間（50–70）`);
    } else if (lastRsi >= 70) {
      reasons.push(`RSI 為 ${lastRsi.toFixed(1)}，進入超買區`);
    } else if (bearishChecks.rsiWeak) {
      reasons.push(`RSI 為 ${lastRsi.toFixed(1)}，進入超賣區`);
    } else if (lastRsi > 30 && lastRsi < 50) {
      reasons.push(`RSI 為 ${lastRsi.toFixed(1)}，偏弱勢區間`);
    }
  }

  // 判斷最終情緒
  // 規則：bullish/bearish 任一邊條件數 ≥ 2 → 該邊勝出
  // 若兩邊都符合 1 個 → neutral
  if (bullishCount >= 2 && bullishCount > bearishCount) {
    const confidence = clampConfidence(0.3 + 0.2 * bullishCount);
    return { sentiment: 'bullish', confidence, reasons };
  }
  if (bearishCount >= 2 && bearishCount > bullishCount) {
    const confidence = clampConfidence(0.3 + 0.2 * bearishCount);
    return { sentiment: 'bearish', confidence, reasons };
  }
  // 其他情況：neutral。指標完全沒訊號時信心度較低
  const neutralConfidence =
    bullishCount === 0 && bearishCount === 0 && lastMacd === undefined && lastRsi === undefined
      ? 0.3
      : 0.5;
  return { sentiment: 'neutral', confidence: neutralConfidence, reasons };
}

function clampConfidence(c: number): number {
  if (c < 0) return 0;
  if (c > 1) return 1;
  return Number(c.toFixed(2));
}

function simpleMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  let sum = 0;
  for (const v of slice) sum += v;
  return sum / period;
}
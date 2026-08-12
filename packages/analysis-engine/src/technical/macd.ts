/**
 * MACD（Moving Average Convergence Divergence）指標
 *
 * 標準參數：fast = 12、slow = 26、signal = 9
 *
 * MACD(t)   = EMA_fast(t) - EMA_slow(t)
 * Signal(t) = EMA_signal(MACD, signal period)
 * Hist(t)   = MACD(t) - Signal(t)
 *
 * EMA 計算使用「標準型」（rolling）定義：
 *   EMA_seed = SMA(period)
 *   EMA_t    = α * price_t + (1 - α) * EMA_{t-1},   α = 2 / (period + 1)
 *
 * 由於 EMA 序列需要 warm-up，輸出長度小於輸入長度：
 *   從第 `slowPeriod` 點開始產生 MACD，從第 `slowPeriod + signalPeriod - 1` 點開始產生 signal。
 *
 * 純函式，無副作用。
 */

export interface MACDPoint {
  /** 對應原始數列的索引 */
  t: number;
  macd: number;
  signal: number;
  histogram: number;
}

export function computeMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDPoint[] {
  if (closes.length < slowPeriod) {
    return [];
  }
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    throw new Error('MACD: periods must be > 0');
  }
  if (fastPeriod >= slowPeriod) {
    throw new Error('MACD: fastPeriod must be < slowPeriod');
  }

  const fastEMA = ema(closes, fastPeriod);
  const slowEMA = ema(closes, slowPeriod);

  // MACD series starts at the index where slowEMA begins (i.e. slowPeriod - 1)
  const macdSeries: number[] = [];
  const macdIndexMap: number[] = [];
  for (let i = slowPeriod - 1; i < closes.length; i++) {
    const fastVal = fastEMA[i - (slowPeriod - fastPeriod)];
    const slowVal = slowEMA[i];
    if (fastVal === undefined || slowVal === undefined) continue;
    macdSeries.push(fastVal - slowVal);
    macdIndexMap.push(i);
  }

  // Signal EMA on macdSeries
  const signalSeries = ema(macdSeries, signalPeriod);
  const out: MACDPoint[] = [];

  // signalSeries is aligned with macdSeries from index (signalPeriod - 1) onward
  // map back to original t
  for (let i = 0; i < macdSeries.length; i++) {
    if (i < signalPeriod - 1) continue;
    const signal = signalSeries[i - (signalPeriod - 1)];
    const macd = macdSeries[i];
    if (macd === undefined || signal === undefined) continue;
    const t = macdIndexMap[i];
    if (t === undefined) continue;
    out.push({
      t,
      macd,
      signal,
      histogram: macd - signal,
    });
  }
  return out;
}

/**
 * 計算 EMA（指數移動平均）。
 *
 * @returns 長度與輸入相同，前 (period-1) 個元素為 undefined，直到第 period 個點開始填值。
 */
function ema(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (values.length < period) return out;

  // seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i] ?? 0;
  }
  let prev = sum / period;
  out[period - 1] = prev;

  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    prev = alpha * v + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}
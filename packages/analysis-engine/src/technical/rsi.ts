/**
 * RSI（Relative Strength Index）
 *
 * 標準 14 日 RSI，使用 Wilder 平滑法：
 *   gain_t = max(price_t - price_{t-1}, 0)
 *   loss_t = max(price_{t-1} - price_t, 0)
 *   avgGain_t = (avgGain_{t-1} * (n-1) + gain_t) / n
 *   avgLoss_t = (avgLoss_{t-1} * (n-1) + loss_t) / n
 *   RS_t = avgGain_t / avgLoss_t
 *   RSI_t = 100 - 100 / (1 + RS_t)
 *
 * 輸出陣列長度 = input.length，前 (n) 個元素為 undefined。
 *
 * 純函式，無副作用。
 */

export function computeRSI(closes: number[], period = 14): (number | undefined)[] {
  const n = closes.length;
  const out: (number | undefined)[] = new Array(n).fill(undefined);
  if (n <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff >= 0) gainSum += diff;
    else lossSum += -diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  out[period] = rsiFrom(avgGain, avgLoss);

  for (let i = period + 1; i < n; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFrom(avgGain, avgLoss);
  }

  return out;
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100;
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
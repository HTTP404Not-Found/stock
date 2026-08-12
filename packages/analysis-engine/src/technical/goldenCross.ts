/**
 * 黃金/死亡交叉偵測
 *
 * 標準 50 / 200 日均線交叉。
 *
 *   - 黃金交叉（Golden）：前日 shortMA ≤ longMA，今日 shortMA > longMA
 *   - 死亡交叉（Death） ：前日 shortMA ≥ longMA，今日 shortMA < longMA
 *
 * 從 `longPeriod` 點開始才能形成 longMA，因此輸出長度 ≤ input.length。
 * 每次事件帶入對應的時間戳 `date`（呼叫端傳入）。
 *
 * 純函式，無副作用。
 */

export type CrossSignal = 'golden' | 'death' | 'none';

export interface GoldenCrossEvent {
  /** 對應原始數列索引 */
  t: number;
  type: CrossSignal;
  shortMA: number;
  longMA: number;
  /** 對應日期（由呼叫端傳入的 dates 陣列） */
  date: number;
}

export function detectGoldenCross(
  closes: number[],
  dates: number[],
  shortPeriod = 50,
  longPeriod = 200,
): GoldenCrossEvent[] {
  const out: GoldenCrossEvent[] = [];
  if (closes.length < longPeriod) return out;
  if (shortPeriod <= 0 || longPeriod <= 0) {
    throw new Error('goldenCross: periods must be > 0');
  }
  if (shortPeriod >= longPeriod) {
    throw new Error('goldenCross: shortPeriod must be < longPeriod');
  }
  if (dates.length !== closes.length) {
    throw new Error('goldenCross: dates.length must equal closes.length');
  }

  // 滾動均線
  let shortSum = 0;
  for (let i = 0; i < shortPeriod; i++) shortSum += closes[i] ?? 0;
  let shortMA = shortSum / shortPeriod;

  let longSum = 0;
  for (let i = 0; i < longPeriod; i++) longSum += closes[i] ?? 0;
  let longMA = longSum / longPeriod;

  // 從 longPeriod 開始滾動
  for (let i = longPeriod; i < closes.length; i++) {
    const newShortMA = shortMA + ((closes[i] ?? 0) - (closes[i - shortPeriod] ?? 0)) / shortPeriod;
    const newLongMA = longMA + ((closes[i] ?? 0) - (closes[i - longPeriod] ?? 0)) / longPeriod;

    if (shortMA <= longMA && newShortMA > newLongMA) {
      const date = dates[i];
      if (date === undefined) continue;
      out.push({
        t: i,
        type: 'golden',
        shortMA: newShortMA,
        longMA: newLongMA,
        date,
      });
    } else if (shortMA >= longMA && newShortMA < newLongMA) {
      const date = dates[i];
      if (date === undefined) continue;
      out.push({
        t: i,
        type: 'death',
        shortMA: newShortMA,
        longMA: newLongMA,
        date,
      });
    }

    shortMA = newShortMA;
    longMA = newLongMA;
  }

  return out;
}
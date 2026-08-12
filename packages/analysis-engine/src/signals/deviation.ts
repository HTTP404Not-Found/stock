/**
 * 偏離公允價值計算（Deviation）
 *
 * 計算當前股價相對合理估值（fair value）的偏離幅度，並給出交易訊號。
 *
 * 規則：
 *   deviationPct = (current - fair) / fair
 *   direction：
 *     above  - 偏離 > +threshold
 *     below  - 偏離 < -threshold
 *     inline - |偏離| ≤ threshold
 *   tradingSignal：
 *     sell  - 偏離 > +threshold（股價過高）
 *     buy   - 偏離 < -threshold（股價過低）
 *     hold  - inline
 *
 * 純函式，無副作用。
 */

export interface DeviationResult {
  currentPrice: number;
  fairValue: number;
  deviationPct: number;
  direction: 'above' | 'below' | 'inline';
  tradingSignal: 'sell' | 'buy' | 'hold';
}

export function computeDeviation(
  currentPrice: number,
  fairValue: number,
  thresholdPct = 0.05,
): DeviationResult {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(fairValue)) {
    throw new Error('deviation: prices must be finite');
  }
  if (fairValue <= 0) {
    throw new Error('deviation: fairValue must be > 0');
  }
  if (thresholdPct <= 0 || thresholdPct >= 1) {
    throw new Error('deviation: thresholdPct must be in (0, 1)');
  }

  const deviationPct = (currentPrice - fairValue) / fairValue;
  let direction: DeviationResult['direction'];
  let tradingSignal: DeviationResult['tradingSignal'];

  if (deviationPct > thresholdPct) {
    direction = 'above';
    tradingSignal = 'sell';
  } else if (deviationPct < -thresholdPct) {
    direction = 'below';
    tradingSignal = 'buy';
  } else {
    direction = 'inline';
    tradingSignal = 'hold';
  }

  return {
    currentPrice,
    fairValue,
    deviationPct,
    direction,
    tradingSignal,
  };
}
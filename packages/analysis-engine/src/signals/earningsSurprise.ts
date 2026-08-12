/**
 * 季度財報 vs 分析師預期差異（Earnings Surprise）
 *
 * 公式：
 *   epsSurprisePct    = (epsActual    - epsEstimate)    / |epsEstimate|
 *   revenueSurprisePct = (revenueActual - revenueEstimate) / |revenueEstimate|
 *
 * 若 estimate 缺值，視為 0% surprise。
 * 「beat」條件：EPS 與營收 surprise 都 ≥ 0（即 actual ≥ estimate）。
 *
 * 純函式，無副作用。
 */

export interface EarningsEvent {
  /** 季度識別，例如 '2026Q1' */
  quarter: string;
  epsEstimate?: number;
  epsActual: number;
  revenueEstimate?: number;
  revenueActual: number;
}

export interface EarningsSurprise {
  event: EarningsEvent;
  epsSurprisePct: number;
  revenueSurprisePct: number;
  beat: boolean;
  /** 細項標籤，方便 UI 與 log */
  flags: {
    epsBeat: boolean;
    revenueBeat: boolean;
  };
}

export function computeEarningsSurprise(event: EarningsEvent): EarningsSurprise {
  if (!Number.isFinite(event.epsActual) || !Number.isFinite(event.revenueActual)) {
    throw new Error('earningsSurprise: actuals must be finite');
  }
  const epsSurprisePct =
    event.epsEstimate !== undefined && event.epsEstimate !== 0
      ? (event.epsActual - event.epsEstimate) / Math.abs(event.epsEstimate)
      : 0;
  const revenueSurprisePct =
    event.revenueEstimate !== undefined && event.revenueEstimate !== 0
      ? (event.revenueActual - event.revenueEstimate) / Math.abs(event.revenueEstimate)
      : 0;

  const epsBeat = event.epsActual >= (event.epsEstimate ?? event.epsActual);
  const revenueBeat = event.revenueActual >= (event.revenueEstimate ?? event.revenueActual);

  return {
    event,
    epsSurprisePct,
    revenueSurprisePct,
    beat: epsBeat && revenueBeat,
    flags: { epsBeat, revenueBeat },
  };
}
/**
 * 盈餘意外計算單元測試
 */
import { describe, it, expect } from 'vitest';
import { computeEarningsSurprise } from '../../signals/earningsSurprise.js';

describe('computeEarningsSurprise', () => {
  it('EPS 與營收都 beat：beat = true', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q1',
      epsEstimate: 1.0,
      epsActual: 1.2,
      revenueEstimate: 1000,
      revenueActual: 1100,
    });
    expect(r.epsSurprisePct).toBeCloseTo(0.2, 6);
    expect(r.revenueSurprisePct).toBeCloseTo(0.1, 6);
    expect(r.beat).toBe(true);
    expect(r.flags.epsBeat).toBe(true);
    expect(r.flags.revenueBeat).toBe(true);
  });

  it('EPS miss 但營收 beat：beat = false', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q1',
      epsEstimate: 1.0,
      epsActual: 0.8,
      revenueEstimate: 1000,
      revenueActual: 1100,
    });
    expect(r.epsSurprisePct).toBeCloseTo(-0.2, 6);
    expect(r.beat).toBe(false);
    expect(r.flags.epsBeat).toBe(false);
    expect(r.flags.revenueBeat).toBe(true);
  });

  it('負 estimate 仍正確計算百分比（用 abs）', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q2',
      epsEstimate: -1.0,
      epsActual: -0.5,
      revenueEstimate: -500,
      revenueActual: -400,
    });
    // eps: (-0.5 - -1.0) / |−1.0| = 0.5/1.0 = 0.5
    expect(r.epsSurprisePct).toBeCloseTo(0.5, 6);
    // revenue: (-400 - -500)/|−500| = 100/500 = 0.2
    expect(r.revenueSurprisePct).toBeCloseTo(0.2, 6);
  });

  it('estimate 缺值：surprise 為 0', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q3',
      epsActual: 1.5,
      revenueActual: 2000,
    });
    expect(r.epsSurprisePct).toBe(0);
    expect(r.revenueSurprisePct).toBe(0);
    // actual >= estimate（undefined）→ beat = true
    expect(r.beat).toBe(true);
  });

  it('estimate = 0：surprise 為 0，避免除以零', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q4',
      epsEstimate: 0,
      epsActual: 0.5,
      revenueEstimate: 0,
      revenueActual: 100,
    });
    expect(r.epsSurprisePct).toBe(0);
    expect(r.revenueSurprisePct).toBe(0);
  });

  it('actual 完全等於 estimate：beat 邊界', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q1',
      epsEstimate: 1.0,
      epsActual: 1.0,
      revenueEstimate: 1000,
      revenueActual: 1000,
    });
    expect(r.epsSurprisePct).toBe(0);
    expect(r.revenueSurprisePct).toBe(0);
    expect(r.beat).toBe(true); // ≥ 視為 beat
  });

  it('event 完整保留在 result', () => {
    const r = computeEarningsSurprise({
      quarter: '2026Q1',
      epsEstimate: 1.0,
      epsActual: 1.2,
      revenueEstimate: 1000,
      revenueActual: 1100,
    });
    expect(r.event.quarter).toBe('2026Q1');
    expect(r.event.epsActual).toBe(1.2);
  });

  it('非有限 actual 應丟錯', () => {
    expect(() =>
      computeEarningsSurprise({
        quarter: '2026Q1',
        epsActual: Number.NaN,
        revenueActual: 100,
      }),
    ).toThrow(/finite/);
  });
});
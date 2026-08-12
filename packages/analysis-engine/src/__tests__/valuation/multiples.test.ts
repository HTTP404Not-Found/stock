/**
 * 倍數估值單元測試
 */
import { describe, it, expect } from 'vitest';
import { computeMultiples } from '../../valuation/multiples.js';

describe('computeMultiples', () => {
  it('大型股 + 未指定同業：合理 PE = 18、合理 PB = 2', () => {
    const result = computeMultiples({
      eps: 5,
      bookValuePerShare: 20,
      marketCapTier: 'large',
    });
    expect(result.reasonablePE).toBe(18);
    expect(result.reasonablePB).toBe(2);
    expect(result.peBasedValue).toBe(90);
    expect(result.pbBasedValue).toBe(40);
    // blended = 0.6 * 90 + 0.4 * 40 = 54 + 16 = 70
    expect(result.blended).toBe(70);
  });

  it('中小型股 + 未指定同業：合理 PE = 25', () => {
    const result = computeMultiples({
      eps: 4,
      bookValuePerShare: 10,
      marketCapTier: 'mid',
    });
    expect(result.reasonablePE).toBe(25);
    expect(result.peBasedValue).toBe(100);
    expect(result.pbBasedValue).toBe(20);
    expect(result.blended).toBe(0.6 * 100 + 0.4 * 20);
  });

  it('small tier 與 mid tier 同樣預設 25', () => {
    const mid = computeMultiples({ eps: 1, bookValuePerShare: 5, marketCapTier: 'mid' });
    const small = computeMultiples({ eps: 1, bookValuePerShare: 5, marketCapTier: 'small' });
    expect(mid.reasonablePE).toBe(25);
    expect(small.reasonablePE).toBe(25);
  });

  it('industryPE 覆寫預設', () => {
    const result = computeMultiples({
      eps: 2,
      bookValuePerShare: 30,
      industryPE: 30,
      marketCapTier: 'large',
    });
    expect(result.reasonablePE).toBe(30);
    expect(result.peBasedValue).toBe(60);
  });

  it('industryPB 覆寫預設', () => {
    const result = computeMultiples({
      eps: 2,
      bookValuePerShare: 30,
      industryPB: 1.5,
    });
    expect(result.reasonablePB).toBe(1.5);
    expect(result.pbBasedValue).toBe(45);
  });

  it('EPS = 0 時 PE-based = 0', () => {
    const result = computeMultiples({ eps: 0, bookValuePerShare: 100 });
    expect(result.peBasedValue).toBe(0);
    expect(result.pbBasedValue).toBe(200);
    expect(result.blended).toBe(0.6 * 0 + 0.4 * 200);
  });

  it('負 BVPS 應丟錯', () => {
    expect(() =>
      computeMultiples({ eps: 1, bookValuePerShare: -10 }),
    ).toThrow(/bookValuePerShare/);
  });

  it('industryPE ≤ 0 應丟錯', () => {
    expect(() =>
      computeMultiples({ eps: 1, bookValuePerShare: 10, industryPE: 0 }),
    ).toThrow(/industryPE/);
  });

  it('industryPB ≤ 0 應丟錯', () => {
    expect(() =>
      computeMultiples({ eps: 1, bookValuePerShare: 10, industryPB: -1 }),
    ).toThrow(/industryPB/);
  });

  it('非有限數字應丟錯', () => {
    expect(() =>
      computeMultiples({ eps: Number.NaN, bookValuePerShare: 10 }),
    ).toThrow(/finite/);
  });
});
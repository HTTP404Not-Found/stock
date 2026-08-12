/**
 * 綜合估值單元測試
 */
import { describe, it, expect } from 'vitest';
import { computeDCF } from '../../valuation/dcf.js';
import { computeMultiples } from '../../valuation/multiples.js';
import { computeComposite } from '../../valuation/composite.js';

const baseDCFInput = {
  freeCashFlow: 100,
  growthRate5y: 0.1,
  terminalGrowthRate: 0.025,
  discountRate: 0.1,
  sharesOutstanding: 10,
} as const;

const baseMultInput = {
  eps: 5,
  bookValuePerShare: 20,
  marketCapTier: 'large' as const,
};

describe('computeComposite', () => {
  it('預設 dcfWeight = 0.6：mean 偏向 DCF', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    const result = computeComposite({ dcf, multiples: mult });

    const expectedMean = dcf.intrinsicValue * 0.6 + mult.blended * 0.4;
    expect(result.mean).toBeCloseTo(expectedMean, 6);
    expect(result.weights).toEqual({ dcf: 0.6, multiples: 0.4 });
    expect(result.method).toBe('dcf+multiples');
  });

  it('low 取兩種方法 * 0.9 的較低者；high 取較高者', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    const result = computeComposite({ dcf, multiples: mult });

    const candidatesLow = [dcf.intrinsicValue * 0.9, mult.blended * 0.9];
    const candidatesHigh = [dcf.intrinsicValue * 1.1, mult.blended * 1.1];
    expect(result.low).toBeCloseTo(Math.min(...candidatesLow), 6);
    expect(result.high).toBeCloseTo(Math.max(...candidatesHigh), 6);
    expect(result.low).toBeLessThanOrEqual(result.mean);
    expect(result.mean).toBeLessThanOrEqual(result.high);
  });

  it('dcfWeight = 1 時 mean = dcf.intrinsicValue', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    const result = computeComposite({ dcf, multiples: mult, dcfWeight: 1 });
    expect(result.mean).toBeCloseTo(dcf.intrinsicValue, 6);
    expect(result.weights).toEqual({ dcf: 1, multiples: 0 });
  });

  it('dcfWeight = 0 時 mean = multiples.blended', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    const result = computeComposite({ dcf, multiples: mult, dcfWeight: 0 });
    expect(result.mean).toBeCloseTo(mult.blended, 6);
    expect(result.weights).toEqual({ dcf: 0, multiples: 1 });
  });

  it('dcfWeight 被 clamp 在 [0, 1]', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    expect(computeComposite({ dcf, multiples: mult, dcfWeight: -1 }).weights.dcf).toBe(0);
    expect(computeComposite({ dcf, multiples: mult, dcfWeight: 2 }).weights.dcf).toBe(1);
    expect(computeComposite({ dcf, multiples: mult, dcfWeight: 0.5 }).weights.dcf).toBe(0.5);
  });

  it('spreadPct = (high-low)/mean', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    const result = computeComposite({ dcf, multiples: mult });
    expect(result.spreadPct).toBeCloseTo((result.high - result.low) / result.mean, 6);
  });

  it('components 帶入原始 dcf 與 multiples 數值', () => {
    const dcf = computeDCF(baseDCFInput);
    const mult = computeMultiples(baseMultInput);
    const result = computeComposite({ dcf, multiples: mult });
    expect(result.components.dcfValue).toBeCloseTo(dcf.intrinsicValue, 6);
    expect(result.components.multiplesValue).toBeCloseTo(mult.blended, 6);
  });
});
/**
 * 偏離度計算單元測試
 */
import { describe, it, expect } from 'vitest';
import { computeDeviation } from '../../signals/deviation.js';

describe('computeDeviation', () => {
  it('股價高於公允價值 10%：above + sell', () => {
    const r = computeDeviation(110, 100);
    expect(r.deviationPct).toBeCloseTo(0.1, 6);
    expect(r.direction).toBe('above');
    expect(r.tradingSignal).toBe('sell');
  });

  it('股價低於公允價值 10%：below + buy', () => {
    const r = computeDeviation(90, 100);
    expect(r.deviationPct).toBeCloseTo(-0.1, 6);
    expect(r.direction).toBe('below');
    expect(r.tradingSignal).toBe('buy');
  });

  it('±3%（預設 5% threshold）：inline + hold', () => {
    const aboveInline = computeDeviation(103, 100);
    expect(aboveInline.direction).toBe('inline');
    expect(aboveInline.tradingSignal).toBe('hold');

    const belowInline = computeDeviation(97, 100);
    expect(belowInline.direction).toBe('inline');
    expect(belowInline.tradingSignal).toBe('hold');
  });

  it('threshold 邊界：剛好 ±5% 為 inline', () => {
    // threshold = 0.05 預設；剛好 5% 應為 inline（嚴格大於才 above/below）
    expect(computeDeviation(105, 100).direction).toBe('inline');
    expect(computeDeviation(95, 100).direction).toBe('inline');
    // 5.1% 應觸發
    expect(computeDeviation(105.1, 100).direction).toBe('above');
    expect(computeDeviation(94.9, 100).direction).toBe('below');
  });

  it('自訂 threshold = 0.10', () => {
    // 8% 在 10% 內 → inline
    expect(computeDeviation(108, 100, 0.10).direction).toBe('inline');
    // 11% → above
    expect(computeDeviation(111, 100, 0.10).direction).toBe('above');
  });

  it('公平價值 = 股價：deviation = 0', () => {
    const r = computeDeviation(100, 100);
    expect(r.deviationPct).toBe(0);
    expect(r.direction).toBe('inline');
    expect(r.tradingSignal).toBe('hold');
  });

  it('非有限輸入應丟錯', () => {
    expect(() => computeDeviation(Number.NaN, 100)).toThrow(/finite/);
    expect(() => computeDeviation(100, Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it('fairValue <= 0 應丟錯', () => {
    expect(() => computeDeviation(100, 0)).toThrow(/fairValue/);
    expect(() => computeDeviation(100, -10)).toThrow(/fairValue/);
  });

  it('thresholdPct 非法值應丟錯', () => {
    expect(() => computeDeviation(100, 100, 0)).toThrow(/thresholdPct/);
    expect(() => computeDeviation(100, 100, 1)).toThrow(/thresholdPct/);
    expect(() => computeDeviation(100, 100, -0.1)).toThrow(/thresholdPct/);
  });

  it('回傳 fairValue 與 currentPrice 與輸入一致', () => {
    const r = computeDeviation(120, 95);
    expect(r.currentPrice).toBe(120);
    expect(r.fairValue).toBe(95);
  });
});
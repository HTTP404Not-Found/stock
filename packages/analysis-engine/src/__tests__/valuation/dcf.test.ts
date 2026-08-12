/**
 * DCF 計算單元測試
 *
 * 對照案例：
 *   freeCashFlow=100, growthRate5y=0.10, terminalGrowthRate=0.025,
 *   discountRate=0.10, sharesOutstanding=10, netDebt=0
 *
 *   FCF_i = 100 * (1.10)^i
 *     FCF_1 = 110
 *     FCF_2 = 121
 *     FCF_3 = 133.1
 *     FCF_4 = 146.41
 *     FCF_5 = 161.051
 *
 *   PV(stage1) = Σ FCF_i / (1.10)^i
 *     = 110/1.1 + 121/1.21 + 133.1/1.331 + 146.41/1.4641 + 161.051/1.61051
 *     = 100 + 100 + 100 + 100 + 100 = 500
 *
 *   PV(stage2) = (FCF_5 * 1.025) / (0.10 - 0.025) / (1.10)^5
 *              = (161.051 * 1.025) / 0.075 / 1.61051
 *              = 165.077 / 0.075 / 1.61051
 *              = 2201.03 / 1.61051
 *              = 1366.605...
 *
 *   EV ≈ 500 + 1366.605 = 1866.605
 *   PerShare = 1866.605 / 10 = 186.6605
 */
import { describe, it, expect } from 'vitest';
import { computeDCF } from '../../valuation/dcf.js';

describe('computeDCF', () => {
  it('基本 5 年成長 + Gordon tail：PerShare ≈ 186.66', () => {
    const result = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.1,
      terminalGrowthRate: 0.025,
      discountRate: 0.1,
      sharesOutstanding: 10,
      netDebt: 0,
    });

    expect(result.pvStage1).toBeCloseTo(500, 3);
    expect(result.pvStage2).toBeCloseTo(1366.667, 1);
    expect(result.enterpriseValue).toBeCloseTo(1866.667, 1);
    expect(result.equityValue).toBeCloseTo(1866.667, 1);
    expect(result.intrinsicValue).toBeCloseTo(186.67, 1);
    expect(result.projectedFcf).toHaveLength(5);
    expect(result.projectedFcf[0]).toBeCloseTo(110, 6);
    expect(result.projectedFcf[4]).toBeCloseTo(161.051, 3);
  });

  it('淨負債從企業價值中扣除', () => {
    const noDebt = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.05,
      terminalGrowthRate: 0.02,
      discountRate: 0.08,
      sharesOutstanding: 50,
    });
    const withDebt = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.05,
      terminalGrowthRate: 0.02,
      discountRate: 0.08,
      sharesOutstanding: 50,
      netDebt: 500,
    });

    expect(withDebt.equityValue).toBeCloseTo(noDebt.equityValue - 500, 4);
    expect(withDebt.intrinsicValue).toBeCloseTo(noDebt.intrinsicValue - 10, 4);
  });

  it('netDebt 預設為 0', () => {
    const result = computeDCF({
      freeCashFlow: 50,
      growthRate5y: 0.0,
      terminalGrowthRate: 0.02,
      discountRate: 0.1,
      sharesOutstanding: 5,
    });
    expect(result.assumptions.netDebt).toBe(0);
    expect(result.equityValue).toBeCloseTo(result.enterpriseValue, 6);
  });

  it('成長率為 0 時，第一階段 PV 等於 5 年 FCF 折現', () => {
    const result = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0,
      terminalGrowthRate: 0.02,
      discountRate: 0.1,
      sharesOutstanding: 10,
    });

    // PV(stage1) when growth = 0: 100/1.1 + 100/1.21 + 100/1.331 + 100/1.4641 + 100/1.61051
    const expectedPV1 =
      100 / 1.1 +
      100 / 1.21 +
      100 / 1.331 +
      100 / 1.4641 +
      100 / 1.61051;
    expect(result.pvStage1).toBeCloseTo(expectedPV1, 3);
    expect(result.projectedFcf.every((v) => v === 100)).toBe(true);
  });

  it('高成長率顯著提升估值', () => {
    const low = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.05,
      terminalGrowthRate: 0.02,
      discountRate: 0.1,
      sharesOutstanding: 10,
    });
    const high = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.25,
      terminalGrowthRate: 0.025,
      discountRate: 0.1,
      sharesOutstanding: 10,
    });
    expect(high.intrinsicValue).toBeGreaterThan(low.intrinsicValue);
  });

  it('折現率越高，估值越低', () => {
    const lowRate = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.1,
      terminalGrowthRate: 0.025,
      discountRate: 0.08,
      sharesOutstanding: 10,
    });
    const highRate = computeDCF({
      freeCashFlow: 100,
      growthRate5y: 0.1,
      terminalGrowthRate: 0.025,
      discountRate: 0.12,
      sharesOutstanding: 10,
    });
    expect(highRate.intrinsicValue).toBeLessThan(lowRate.intrinsicValue);
  });

  it('當 discountRate <= terminalGrowthRate 應丟錯', () => {
    expect(() =>
      computeDCF({
        freeCashFlow: 100,
        growthRate5y: 0.1,
        terminalGrowthRate: 0.1,
        discountRate: 0.1,
        sharesOutstanding: 10,
      }),
    ).toThrow(/discountRate.*terminalGrowthRate/);
  });

  it('sharesOutstanding = 0 應丟錯', () => {
    expect(() =>
      computeDCF({
        freeCashFlow: 100,
        growthRate5y: 0.1,
        terminalGrowthRate: 0.025,
        discountRate: 0.1,
        sharesOutstanding: 0,
      }),
    ).toThrow(/sharesOutstanding/);
  });

  it('negative discountRate 應丟錯', () => {
    expect(() =>
      computeDCF({
        freeCashFlow: 100,
        growthRate5y: 0.1,
        terminalGrowthRate: 0.025,
        discountRate: -0.05,
        sharesOutstanding: 10,
      }),
    ).toThrow(/discountRate/);
  });

  it('assumptions 回填所有欄位', () => {
    const result = computeDCF({
      freeCashFlow: 80,
      growthRate5y: 0.07,
      terminalGrowthRate: 0.02,
      discountRate: 0.09,
      sharesOutstanding: 20,
      netDebt: 50,
    });
    expect(result.assumptions).toEqual({
      freeCashFlow: 80,
      growthRate5y: 0.07,
      terminalGrowthRate: 0.02,
      discountRate: 0.09,
      sharesOutstanding: 20,
      netDebt: 50,
    });
  });
});
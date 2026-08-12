/**
 * DCF（Discounted Cash Flow）估值模組
 *
 * 採用兩階段自由現金流折現模型：
 *   - 第一階段：未來 5 年以 `growthRate5y` 成長
 *   - 第二階段：以 `terminalGrowthRate` 永續成長（Gordon Growth Model）
 *
 * 數學公式：
 *   FCF_i = FCF_0 * (1 + g5)^i    for i = 1..5
 *   PV(stage1) = Σ FCF_i / (1 + r)^i
 *   PV(stage2) = FCF_5 * (1 + g_t) / (r - g_t) / (1 + r)^5
 *   EV = PV(stage1) + PV(stage2)
 *   Equity = EV - netDebt
 *   PerShare = Equity / sharesOutstanding
 *
 * 純函式，無副作用。
 */

export interface DCFInput {
  /** 最近一期自由現金流（美元或港幣，皆為同單位） */
  freeCashFlow: number;
  /** 未來 5 年年增率（小數，0.10 = 10%） */
  growthRate5y: number;
  /** 永續成長率（建議 0.025 = 2.5%，不得 ≥ 折現率） */
  terminalGrowthRate: number;
  /** 折現率 / WACC（建議 0.10 = 10%） */
  discountRate: number;
  /** 流通股數 */
  sharesOutstanding: number;
  /** 淨負債（可選；預設 0） */
  netDebt?: number;
}

export interface DCFResult {
  /** 每股內在價值（同輸入單位） */
  intrinsicValue: number;
  /** 企業價值 EV */
  enterpriseValue: number;
  /** 股權價值 = EV - 淨負債 */
  equityValue: number;
  /** 第一階段折現合計 */
  pvStage1: number;
  /** 第二階段折現合計（Gordon tail value 的 PV） */
  pvStage2: number;
  /** 預測的 5 年現金流序列（用於除錯與測試） */
  projectedFcf: number[];
  /** 使用的假設（內嵌方便下游 trace） */
  assumptions: RequiredInput<DCFInput>;
}

export type RequiredInput<T> = {
  [K in keyof T]-?: T[K];
};

/**
 * 計算兩階段 DCF 內在價值。
 *
 * @throws 當輸入不合理（負股數、零股數、折現率 ≤ 終值成長率、負初始 FCF 等）
 */
export function computeDCF(input: DCFInput): DCFResult {
  const fcf0 = input.freeCashFlow;
  const g5 = input.growthRate5y;
  const gT = input.terminalGrowthRate;
  const r = input.discountRate;
  const shares = input.sharesOutstanding;
  const netDebt = input.netDebt ?? 0;

  if (!Number.isFinite(fcf0)) {
    throw new Error('DCF: freeCashFlow must be a finite number');
  }
  if (shares <= 0 || !Number.isFinite(shares)) {
    throw new Error('DCF: sharesOutstanding must be > 0');
  }
  if (r <= gT) {
    throw new Error(
      `DCF: discountRate (${r}) must be > terminalGrowthRate (${gT}) for Gordon model`,
    );
  }
  if (!Number.isFinite(r) || r <= 0) {
    throw new Error('DCF: discountRate must be > 0');
  }
  if (!Number.isFinite(g5)) {
    throw new Error('DCF: growthRate5y must be finite');
  }
  if (!Number.isFinite(gT)) {
    throw new Error('DCF: terminalGrowthRate must be finite');
  }

  const projectedFcf: number[] = [];
  let pvStage1 = 0;
  for (let i = 1; i <= 5; i++) {
    const fcfI = fcf0 * Math.pow(1 + g5, i);
    projectedFcf.push(fcfI);
    pvStage1 += fcfI / Math.pow(1 + r, i);
  }

  // Gordon tail value at end of year 5
  const fcf5 = projectedFcf[projectedFcf.length - 1] ?? fcf0 * Math.pow(1 + g5, 5);
  const terminalValue = (fcf5 * (1 + gT)) / (r - gT);
  const pvStage2 = terminalValue / Math.pow(1 + r, 5);

  const enterpriseValue = pvStage1 + pvStage2;
  const equityValue = enterpriseValue - netDebt;
  const intrinsicValue = equityValue / shares;

  const assumptions: RequiredInput<DCFInput> = {
    freeCashFlow: fcf0,
    growthRate5y: g5,
    terminalGrowthRate: gT,
    discountRate: r,
    sharesOutstanding: shares,
    netDebt,
  };

  return {
    intrinsicValue,
    enterpriseValue,
    equityValue,
    pvStage1,
    pvStage2,
    projectedFcf,
    assumptions,
  };
}
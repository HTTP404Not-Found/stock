/**
 * 倍數估值模組（Multiples Valuation）
 *
 * 使用 P/E 與 P/B 倍數對標同業，得到每股合理價值。
 *
 * 啟發式合理倍數：
 *   - 若使用者提供 `industryPE`，使用該值；否則依 `marketCapTier` 決定
 *     - 'large'  → 18
 *     - 'mid' / 'small' → 25
 *   - 合理 P/B 預設 2.0，可被 `industryPB` 覆寫
 *
 * blended = 0.6 * PE_value + 0.4 * PB_value（產業特性：獲利穩定者偏重 PE；
 *                                            資產密集 / 重資產偏重 PB）
 *
 * 純函式，無副作用。
 */

export type MarketCapTier = 'large' | 'mid' | 'small';

export interface MultiplesInput {
  /** Trailing-Twelve-Months EPS（最近四季合計或推算年化） */
  eps: number;
  /** 每股淨值 Book Value Per Share */
  bookValuePerShare: number;
  /** 同業平均 P/E；省略時以 tier 推算 */
  industryPE?: number;
  /** 同業平均 P/B；省略時用預設 2.0 */
  industryPB?: number;
  /** 股本規模 tier，用於選擇合理 PE 預設值 */
  marketCapTier?: MarketCapTier;
}

export interface MultiplesResult {
  peBasedValue: number;
  pbBasedValue: number;
  /** PE/PB 加權平均（PE 0.6、PB 0.4） */
  blended: number;
  /** 實際採用的合理 PE / PB（供下游 log） */
  reasonablePE: number;
  reasonablePB: number;
}

const DEFAULT_PB = 2.0;
const LARGE_PE = 18;
const MID_SMALL_PE = 25;

export function computeMultiples(input: MultiplesInput): MultiplesResult {
  const { eps, bookValuePerShare, industryPE, industryPB, marketCapTier } = input;

  if (!Number.isFinite(eps) || !Number.isFinite(bookValuePerShare)) {
    throw new Error('multiples: eps and bookValuePerShare must be finite numbers');
  }
  if (bookValuePerShare < 0) {
    throw new Error('multiples: bookValuePerShare must be >= 0');
  }

  let reasonablePE: number;
  if (industryPE !== undefined) {
    if (industryPE <= 0) {
      throw new Error('multiples: industryPE must be > 0');
    }
    reasonablePE = industryPE;
  } else {
    reasonablePE =
      marketCapTier === 'large' || marketCapTier === undefined ? LARGE_PE : MID_SMALL_PE;
  }

  const reasonablePB = industryPB !== undefined ? industryPB : DEFAULT_PB;
  if (reasonablePB <= 0) {
    throw new Error('multiples: industryPB must be > 0');
  }

  const peBasedValue = eps * reasonablePE;
  const pbBasedValue = bookValuePerShare * reasonablePB;
  const blended = peBasedValue * 0.6 + pbBasedValue * 0.4;

  return {
    peBasedValue,
    pbBasedValue,
    blended,
    reasonablePE,
    reasonablePB,
  };
}
/**
 * 綜合估值（Composite Fair Value）
 *
 * 把 DCF 與倍數估值加權平均，並輸出一個合理的 [low, mean, high] 區間。
 *
 * 規則（任務書定義）：
 *   - mean = dcf.intrinsicValue * dcfWeight + multiples.blended * (1 - dcfWeight)
 *   - low  = min(dcf.intrinsicValue * 0.9, multiples.blended * 0.9)
 *   - high = max(dcf.intrinsicValue * 1.1, multiples.blended * 1.1)
 *
 * 當只有 DCF 結果可用（multiples 為 null）或反之時，仍能合理輸出區間。
 *
 * 純函式，無副作用。
 */

import type { DCFResult } from './dcf.js';
import type { MultiplesResult } from './multiples.js';

export interface CompositeInput {
  dcf: DCFResult;
  multiples: MultiplesResult;
  /** DCF 權重，預設 0.6（DCF 偏重，但倍數仍扮演 sanity check） */
  dcfWeight?: number;
}

export interface CompositeResult {
  low: number;
  mean: number;
  high: number;
  /** 區間寬度，方便下游評估信心度 */
  spreadPct: number;
  /** 採用的加權 */
  weights: { dcf: number; multiples: number };
  method: 'dcf+multiples';
  /** 區間的個股依據數值（原始） */
  components: { dcfValue: number; multiplesValue: number };
}

export function computeComposite(input: CompositeInput): CompositeResult {
  const { dcf, multiples } = input;
  const w = clampWeight(input.dcfWeight ?? 0.6);

  const dcfValue = dcf.intrinsicValue;
  const multValue = multiples.blended;
  const mean = dcfValue * w + multValue * (1 - w);

  // 低緣：兩種方法估值的 0.9 倍中取較低者；高緣則取較高者
  const lowCandidates = [dcfValue * 0.9, multValue * 0.9];
  const highCandidates = [dcfValue * 1.1, multValue * 1.1];
  const low = Math.min(...lowCandidates);
  const high = Math.max(...highCandidates);

  const spreadPct = mean > 0 ? (high - low) / mean : 0;

  return {
    low,
    mean,
    high,
    spreadPct,
    weights: { dcf: w, multiples: 1 - w },
    method: 'dcf+multiples',
    components: { dcfValue, multiplesValue: multValue },
  };
}

function clampWeight(w: number): number {
  if (!Number.isFinite(w)) return 0.6;
  if (w < 0) return 0;
  if (w > 1) return 1;
  return w;
}
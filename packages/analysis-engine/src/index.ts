/**
 * analysis-engine - 分析引擎
 *
 * 職責：
 *   - 純計算模組（DCF / 倍數 / 綜合估值）
 *   - 技術指標（MACD / RSI / 黃金交叉 / 走勢判定）
 *   - 訊號（盈餘意外 / 偏離度）
 *   - LLM prompt 模板（給後端組裝字串，不打 API）
 *
 * 本套件遵守：
 *   - 無副作用（純函式為主）
 *   - 無外部 HTTP / API 呼叫
 *   - 無 LLM 呼叫（只產 prompt 字串）
 *   - TypeScript strict，無 any
 */

// === 版本資訊 ===
export const ANALYSIS_ENGINE_VERSION = '0.2.0';

// === Valuation ===
export {
  computeDCF,
  type DCFInput,
  type DCFResult,
  type RequiredInput,
} from './valuation/dcf.js';

export {
  computeMultiples,
  type MultiplesInput,
  type MultiplesResult,
  type MarketCapTier,
} from './valuation/multiples.js';

export {
  computeComposite,
  type CompositeInput,
  type CompositeResult,
} from './valuation/composite.js';

// === Technical ===
export {
  computeMACD,
  type MACDPoint,
} from './technical/macd.js';

export {
  computeRSI,
} from './technical/rsi.js';

export {
  detectGoldenCross,
  type CrossSignal,
  type GoldenCrossEvent,
} from './technical/goldenCross.js';

export {
  judgeTrend,
  type TrendInput,
  type TrendResult,
  type Sentiment,
} from './technical/trend.js';

// === Signals ===
export {
  computeEarningsSurprise,
  type EarningsEvent,
  type EarningsSurprise,
} from './signals/earningsSurprise.js';

export {
  computeDeviation,
  type DeviationResult,
} from './signals/deviation.js';

// === Prompts ===
export {
  FAIR_VALUE_SYSTEM_PROMPT,
  buildFairValueUserPrompt,
  type FairValueUserPromptInput,
} from './prompts/fairValue.js';

export {
  PREDICTION_SYSTEM_PROMPT,
  buildPredictionUserPrompt,
  type PredictionUserPromptInput,
} from './prompts/prediction.js';

export {
  CHAT_SYSTEM_PROMPT,
  buildChatUserPrompt,
  type ChatContext,
} from './prompts/chat.js';

export {
  NEWS_INTERPRETATION_SYSTEM_PROMPT,
  buildNewsInterpretationUserPrompt,
  type NewsItem,
  type NewsInterpretationInput,
} from './prompts/news.js';
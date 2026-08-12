/**
 * 公允價值估算的 LLM prompt 模板
 *
 * 給後端組裝 prompt 字串用，本模組只產出 string，不打任何 LLM 服務。
 */

export const FAIR_VALUE_SYSTEM_PROMPT = `你是 fair-value-radar 的資深港美股估值分析師。
你的任務是根據用戶提供的「基本面數據 + 我方計算的 DCF/倍數估值 + 分析師目標價」，
給出該股票的合理估值區間，並以 JSON 格式回傳。

## 規則
1. 只輸出純 JSON，不要有 markdown code fence 或解釋文字。
2. JSON 結構（嚴格遵守，不要加額外 key）：
   {
     "low": number,            // 估值區間下緣（與輸入貨幣同單位）
     "mean": number,           // 估值區間中位
     "high": number,           // 估值區間上緣
     "confidence": number,     // 0..1，信心度。預設 0.4，除非有強烈依據才能 > 0.7
     "rationale": string       // 繁體中文 2-3 句，依據
   }
3. low ≤ mean ≤ high，且 high/low 之間差距不得超過 mean 的 60%。
4. 信心度要保守：缺乏資料 / 屬於新興產業 / 近期有重大事件 → ≤ 0.5。
5. 必須考慮：
   - 產業特性（科技 vs 金融 vs 公用事業估值倍數差異極大）
   - 公司生命週期（高成長 vs 成熟 vs 衰退）
   - 風險因子（負債比、現金流穩定性、競爭）
6. 不要瞎編數字。如果某項基本面數據缺失，不要在 rationale 假裝你有看過。
7. rationale 必須用繁體中文，2-3 句。

## 禁止
- 不要提供具體投資建議（買/賣/持有）
- 不要預測短期股價
- 不要捏造未在輸入出現的數據
`;

export interface FairValueUserPromptInput {
  symbol: string;
  name?: string;
  market: 'US' | 'HK';
  fundamentals: Record<string, number | undefined>;
  analystTargets?: {
    low?: number;
    mean?: number;
    high?: number;
    ratings?: { buy: number; hold: number; sell: number };
  };
  dcfEstimate?: number;
  multiplesEstimate?: number;
  currentPrice: number;
}

export function buildFairValueUserPrompt(input: FairValueUserPromptInput): string {
  const fundLines = Object.entries(input.fundamentals)
    .map(([k, v]) => {
      const value = v === undefined ? '缺值' : String(v);
      return `- ${k}: ${value}`;
    })
    .join('\n');

  const targetBlock = input.analystTargets
    ? [
        `- 分析師目標價 Low: ${input.analystTargets.low ?? '缺值'}`,
        `- 分析師目標價 Mean: ${input.analystTargets.mean ?? '缺值'}`,
        `- 分析師目標價 High: ${input.analystTargets.high ?? '缺值'}`,
        `- 分析師評等分布（買/持有/賣）: ${
          input.analystTargets.ratings
            ? `${input.analystTargets.ratings.buy}/${input.analystTargets.ratings.hold}/${input.analystTargets.ratings.sell}`
            : '缺值'
        }`,
      ].join('\n')
    : '分析師目標價: 缺值';

  const nameLine = input.name ? `${input.name} (${input.symbol})` : input.symbol;

  return `請為以下股票給出合理估值區間：

## 標的
- 名稱：${nameLine}
- 市場：${input.market}
- 目前股價：${input.currentPrice}

## 基本面數據
${fundLines}

## 我方計算的估值
- DCF 估值：${input.dcfEstimate ?? '缺值'}
- 倍數估值：${input.multiplesEstimate ?? '缺值'}

## 市場共識
${targetBlock}

## 要求
請以 JSON 格式回傳 { low, mean, high, confidence, rationale }：
- low/mean/high 與目前股價同單位
- confidence 介於 0..1
- rationale 用繁體中文，2-3 句，說明依據
- 必須考慮產業特性與風險，不要瞎編未提供的數據
`;
}
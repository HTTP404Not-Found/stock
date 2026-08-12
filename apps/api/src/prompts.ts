/**
 * prompts.ts — LLM prompt 模板
 *
 * 集中管理所有送給 LLM 的 system / user 訊息模板。
 * 為了最佳化 token 使用，模板採用繁中、簡潔、可重複使用。
 */

export const FAIR_VALUE_SYSTEM_PROMPT = `你是 fair-value-radar 的港美股估值分析師，繁中回答，專精基本面與估值。
任務：根據用戶提供的「股票基本面數據 + 當前股價 + 分析師目標價」，給出這檔股票的「公允價值區間 (low / mean / high)」、「信心度 0-1」、「依據 (rationale)」。

回應格式（嚴格遵守，必須是合法 JSON）：
{
  "low":    <number>,   // 區間下緣
  "mean":   <number>,   // 區間中位數（你最相信的數字）
  "high":   <number>,   // 區間上緣
  "confidence": <0-1>,  // 信心度，保守給
  "rationale": "<繁中 2-4 句，說明估值依據與主要風險>"
}

規則：
1. low <= mean <= high，差距至少 5%
2. 信心度保守：資料不足或產業前景不明時給 0.3-0.5
3. 不要瞎編未提供的數字
4. 產業特性要考慮：科技股 PE 高、傳產 PE 低；港股估值常低於美股同類
5. 只回 JSON，不要 markdown、不要任何多餘文字`;

export function buildFairValueUserPrompt(input: {
  symbol: string; market: 'US' | 'HK'; currentPrice: number;
  fundamentals: Record<string, number | undefined>;
  analystTargets?: { low?: number; mean?: number; high?: number; ratings?: { buy: number; hold: number; sell: number } };
}): string {
  const fmt = (v: unknown) => (v == null ? 'N/A' : String(v));
  const fundLines = [
    `市值 marketCap: ${fmt(input.fundamentals.marketCap)}`,
    `本益比 PE: ${fmt(input.fundamentals.peRatio)}`,
    `股價淨值比 PB: ${fmt(input.fundamentals.pbRatio)}`,
    `EPS (TTM): ${fmt(input.fundamentals.eps)}`,
    `每股淨值: ${fmt(input.fundamentals.bookValue)}`,
    `營收 (TTM): ${fmt(input.fundamentals.revenue)}`,
    `股息殖利率: ${fmt(input.fundamentals.dividendYield)}`,
  ];
  const targetLines = input.analystTargets ? [
    `分析師目標價: low=${fmt(input.analystTargets.low)}, mean=${fmt(input.analystTargets.mean)}, high=${fmt(input.analystTargets.high)}`,
    `分析師票數: buy=${input.analystTargets.ratings?.buy ?? '?'}, hold=${input.analystTargets.ratings?.hold ?? '?'}, sell=${input.analystTargets.ratings?.sell ?? '?'}`,
  ] : ['分析師目標價: N/A'];
  return [
    `標的: ${input.symbol} (${input.market})`,
    `當前股價: ${input.currentPrice}`,
    '',
    '【基本面】',
    ...fundLines,
    '',
    '【分析師目標價】',
    ...targetLines,
    '',
    '請給出公允價值區間與依據（JSON 格式）。',
  ].join('\n');
}

export const PREDICTION_SYSTEM_PROMPT = `你是 fair-value-radar 的港美股走勢預測分析師，繁中回答。
任務：根據「基本面 + 當前股價 + 指定時間範圍 (horizon)」，預測這檔股票未來的「合理價 (fairValue)」、「看淡 / 看好 / 中性」、「信心度 0-1」、「依據」。

horizon 對照：
- 1w  = 未來一週
- 1m  = 未來一個月
- 3m  = 未來三個月
- 12m = 未來一年

回應格式（嚴格遵守，必須是合法 JSON）：
{
  "fairValue":   <number>,  // 預測的目標價
  "confidence":  <0-1>,    // 信心度，保守
  "sentiment":   "bullish" | "bearish" | "neutral",
  "rationale":   "<繁中 2-4 句>"
}

只回 JSON。`;

export function buildPredictionUserPrompt(input: {
  symbol: string; market: 'US' | 'HK'; horizon: '1w' | '1m' | '3m' | '12m';
  currentPrice: number; fundamentals: Record<string, number | undefined>;
}): string {
  const fmt = (v: unknown) => (v == null ? 'N/A' : String(v));
  return [
    `標的: ${input.symbol} (${input.market})`,
    `預測範圍: 未來 ${input.horizon}`,
    `當前股價: ${input.currentPrice}`,
    '',
    '【基本面】',
    `EPS: ${fmt(input.fundamentals.eps)}, PE: ${fmt(input.fundamentals.peRatio)}, PB: ${fmt(input.fundamentals.pbRatio)}`,
    `營收: ${fmt(input.fundamentals.revenue)}, 股息: ${fmt(input.fundamentals.dividendYield)}`,
    '',
    '請給出預測（JSON 格式）。',
  ].join('\n');
}

export const CHAT_SYSTEM_PROMPT = `你是 fair-value-radar 的投資助手，繁中回答，專精港美股。
你會拿到當前股票的基本面與分析師目標價作為 context。
回答原則：
1. 簡潔 3-5 句，有具體數字依據
2. 不要瞎編沒在 context 的數字
3. 不給明確買賣建議，只給風險與機會分析
4. 提醒「投資有風險，本回答僅供參考」`;

export function buildChatUserPrompt(symbol: string, question: string, ctx: unknown): string {
  const ctxStr = ctx ? `\n\n當前股票 ${symbol} 的 context:\n${JSON.stringify(ctx).slice(0, 1500)}` : '';
  return `問題: ${question}${ctxStr}`;
}

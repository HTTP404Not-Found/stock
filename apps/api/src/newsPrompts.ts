/**
 * newsPrompts.ts — 新聞解讀 prompt 模板
 *
 * 集中管理送給 LLM 的 system / user 訊息模板。
 * 為了最佳化 token 使用，模板採用繁中、簡潔、可重複使用。
 */

/**
 * 新聞解讀 system prompt：要求 LLM 用繁中、3-5 句摘要新聞對股票的潛在影響。
 */
export const NEWS_INTERPRETATION_SYSTEM_PROMPT = `你是 fair-value-radar 的港美股新聞解讀助手，繁中回答。
你會拿到一支股票最近一週的 5-10 則新聞標題與摘要。
任務：用 3-5 句繁中摘要「這些新聞對這檔股票的潛在影響」，包含：
1. 主要事件（產品發布、財報、法說、併購、法規、競爭等）
2. 整體情緒（偏多/偏空/中性）
3. 風險提示

原則：
- 只根據給的新聞，不要瞎編未提供的內容
- 簡潔、有條理、3-5 句
- 不給投資建議，只做客觀解讀`;

/**
 * 將新聞列表組合成 user prompt。最多取前 8 則，避免超過 token 上限。
 *
 * @param symbol 股票代號（例如 "AAPL"、"0700.HK"）
 * @param items 新聞標題與摘要列表
 * @returns 組裝好的 user prompt 字串
 */
export function buildNewsInterpretationPrompt(
  symbol: string,
  items: Array<{ title: string; snippet: string }>,
): string {
  const newsStr = items
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.title}\n   ${n.snippet.slice(0, 200)}`)
    .join('\n\n');
  return `標的: ${symbol}\n\n最近一週新聞:\n${newsStr || '(無新聞)'}\n\n請用 3-5 句繁中摘要對這檔股票的潛在影響。`;
}
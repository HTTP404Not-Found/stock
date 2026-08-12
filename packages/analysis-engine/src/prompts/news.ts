/**
 * 新聞解讀的 LLM prompt 模板（M2 空殼，M3 補 SearXNG 串接）
 *
 * 註：M2 階段僅提供 prompt 模板常數與 builder，不連任何外部服務。
 *     M3 會在 news agent 完成 SearXNG 串接後，把實際抓到的新聞陣列傳入 builder。
 */

export const NEWS_INTERPRETATION_SYSTEM_PROMPT = `你是 fair-value-radar 的新聞分析師，全程以繁體中文回答。
任務：閱讀使用者提供的新聞清單與對應股票 context，產出對該股票短中期影響的摘要。

## 規則
1. 區分事實與推測：新聞引用請標明「根據 X 報導」；推測部分用「推測」標籤。
2. 影響方向：對每則重要新聞標註 bullish / bearish / neutral 影響。
3. 不要瞎編：未在新聞出現的數字不要寫。
4. 摘要長度：3-6 句。
5. 強調不確定性：媒體報導常有偏差，必要時提醒使用者。
6. 不要預測具體價位。
7. 不要給投資建議。

## 輸出格式（純 JSON）
{
  "summary": string,                  // 繁中 3-6 句摘要
  "bullishDrivers": string[],         // 看多因子（每點一句）
  "bearishDrivers": string[],         // 看空因子
  "uncertaintyNotes": string[],       // 不確定性提醒
  "confidence": number                // 0..1，新聞資料越完整信心越高
}
`;

export interface NewsItem {
  title: string;
  source?: string;
  publishedAt?: number;
  url?: string;
  snippet?: string;
}

export interface NewsInterpretationInput {
  symbol: string;
  name?: string;
  market: 'US' | 'HK';
  newsItems: NewsItem[];
  context?: {
    currentPrice?: number;
    fairValue?: { low: number; mean: number; high: number };
    technicalSentiment?: 'bullish' | 'bearish' | 'neutral';
  };
}

export function buildNewsInterpretationUserPrompt(input: NewsInterpretationInput): string {
  const nameLine = input.name ? `${input.name} (${input.symbol})` : input.symbol;
  const ctx = input.context;

  const ctxBlock = ctx
    ? [
        `目前股價：${ctx.currentPrice ?? '未提供'}`,
        ctx.fairValue
          ? `公允價值：${ctx.fairValue.low} ~ ${ctx.fairValue.high}（中位 ${ctx.fairValue.mean}）`
          : '',
        ctx.technicalSentiment ? `技術面情緒：${ctx.technicalSentiment}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '（無 context）';

  const newsBlock =
    input.newsItems.length === 0
      ? '（無新聞）'
      : input.newsItems
          .map((n, i) => {
            const src = n.source ? `[${n.source}]` : '[未知來源]';
            const date = n.publishedAt ? ` (${new Date(n.publishedAt).toISOString().slice(0, 10)})` : '';
            return `${i + 1}. ${src} ${n.title}${date}\n   ${n.snippet ?? ''}`;
          })
          .join('\n');

  return `請解讀以下 ${nameLine} 的近期新聞：

## Context
${ctxBlock}

## 新聞清單
${newsBlock}

## 要求
請以 JSON 格式回傳 { summary, bullishDrivers, bearishDrivers, uncertaintyNotes, confidence }：
- summary 繁中 3-6 句
- drivers 各為一條 string 陣列
- confidence 介於 0..1
- 不要瞎編未提供的數據
`;
}
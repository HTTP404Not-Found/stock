/**
 * 對話問股的 LLM prompt 模板
 *
 * 給後端組裝 system + user prompt 用，本模組只產出 string。
 */

export const CHAT_SYSTEM_PROMPT = `你是 fair-value-radar 的投資助手，全程以繁體中文回答，專精港美股。

你會拿到當前股票的：
  - 財報數據（基本面）
  - 分析師目標價與評等
  - 技術指標摘要（MACD、RSI、均線、黃金/死亡交叉）
  - 新聞摘要

回答規則：
1. 簡潔：3-5 句為上限。
2. 有依據：每個觀點都要對應到輸入資料中提供的具體數字。
3. 不要瞎編數字：若 context 沒給，就明說「資料未提供」。
4. 不給投資建議：禁用「建議買入/賣出/加碼/減碼」等詞，改用「以目前資訊看來...」、「值得持續觀察」。
5. 強調風險：每次回答至少點出一個風險因子（產業循環、估值偏高、宏觀風險等）。
6. 不要超過 5 句。
7. 繁體中文回答。
`;

export interface ChatContext {
  symbol: string;
  name?: string;
  market?: 'US' | 'HK';
  currentPrice?: number;
  fundamentals?: Record<string, number | string | undefined>;
  analystTargets?: {
    low?: number;
    mean?: number;
    high?: number;
    ratings?: { buy: number; hold: number; sell: number };
  };
  fairValue?: { low: number; mean: number; high: number; method?: string };
  technical?: {
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    confidence?: number;
    macdSummary?: string;
    rsiValue?: number;
    ma50?: number;
    ma200?: number;
  };
  recentNews?: string[];
}

export function buildChatUserPrompt(
  symbol: string,
  question: string,
  context: ChatContext,
): string {
  const ctxLines: string[] = [`- 標的：${context.name ? `${context.name} (${symbol})` : symbol}`];

  if (context.market) ctxLines.push(`- 市場：${context.market}`);
  if (context.currentPrice !== undefined) ctxLines.push(`- 目前股價：${context.currentPrice}`);

  if (context.fairValue) {
    ctxLines.push(
      `- 公允價值區間：${context.fairValue.low} ~ ${context.fairValue.high}（中位 ${context.fairValue.mean}）${
        context.fairValue.method ? `，方法 ${context.fairValue.method}` : ''
      }`,
    );
  }

  if (context.analystTargets) {
    const t = context.analystTargets;
    const rating = t.ratings ? `（買/持/賣 = ${t.ratings.buy}/${t.ratings.hold}/${t.ratings.sell}）` : '';
    ctxLines.push(
      `- 分析師目標價：低 ${t.low ?? '?'} / 中 ${t.mean ?? '?'} / 高 ${t.high ?? '?'}${rating}`,
    );
  }

  if (context.fundamentals && Object.keys(context.fundamentals).length > 0) {
    ctxLines.push('- 基本面：');
    for (const [k, v] of Object.entries(context.fundamentals)) {
      ctxLines.push(`    - ${k}: ${v ?? '缺值'}`);
    }
  }

  if (context.technical) {
    const t = context.technical;
    const techLines: string[] = [];
    if (t.sentiment) techLines.push(`情緒=${t.sentiment}（信心 ${t.confidence ?? '?'}）`);
    if (t.macdSummary) techLines.push(`MACD: ${t.macdSummary}`);
    if (t.rsiValue !== undefined) techLines.push(`RSI=${t.rsiValue}`);
    if (t.ma50 !== undefined) techLines.push(`50MA=${t.ma50}`);
    if (t.ma200 !== undefined) techLines.push(`200MA=${t.ma200}`);
    if (techLines.length > 0) ctxLines.push(`- 技術：${techLines.join('，')}`);
  }

  if (context.recentNews && context.recentNews.length > 0) {
    ctxLines.push('- 近期新聞：');
    for (const n of context.recentNews) ctxLines.push(`    - ${n}`);
  }

  const ctxBlock = ctxLines.join('\n');

  return `以下是 ${symbol} 的最新 context：

${ctxBlock}

使用者問題：
${question}

請用 3-5 句繁體中文回答，且至少點出一個風險因子。`;
}
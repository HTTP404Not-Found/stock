/**
 * 走勢預測的 LLM prompt 模板
 *
 * 給後端組裝 prompt 字串用，本模組只產出 string，不打任何 LLM 服務。
 */

export const PREDICTION_SYSTEM_PROMPT = `你是 fair-value-radar 的港美股技術面/籌碼面分析師。
你的任務是根據用戶提供的「技術指標 + 基本面摘要 + 我方公允價值」，
給出該股票的短期走勢預測，並以 JSON 格式回傳。

## 規則
1. 只輸出純 JSON，不要有 markdown code fence 或解釋文字。
2. JSON 結構（嚴格遵守，不要加額外 key）：
   {
     "sentiment": "bullish" | "bearish" | "neutral",
     "confidence": number,     // 0..1
     "fairValue": number,      // 你認定的合理價值（可與輸入略不同）
     "rationale": string,      // 繁體中文 2-3 句
     "horizon": "短期(1-2週)" | "中期(1-3月)" | "長期(>3月)"
   }
3. sentiment 三選一：
   - bullish：趨勢向上、指標有利、未來 1-3 個月偏多
   - bearish：趨勢向下、指標不利、未來 1-3 個月偏空
   - neutral：盤整或指標矛盾、無明顯方向
4. 信心度：
   - 三個時間維度指標（短/中/長期）一致 → confidence 可達 0.6-0.8
   - 指標互相矛盾 → ≤ 0.4
   - 缺乏任何技術指標 → ≤ 0.3
5. rationale 必須用繁體中文，2-3 句。
6. horizon 必須從給定的三個值中選一個，不要自創。
7. 不要預測具體價位（不要寫「會漲到 X 元」）。
8. 不要給投資建議。

## 禁止
- 不要捏造指標數據
- 不要提供買賣建議
- 不要超過 horizon 定義的時間範圍
`;

export interface PredictionUserPromptInput {
  symbol: string;
  name?: string;
  market: 'US' | 'HK';
  currentPrice: number;
  fairValue: number;
  fundamentalsSummary?: string;
  technicalSignals: {
    macd?: { value: number; signal: number; histogram: number; interpretation: string };
    rsi?: { value: number; interpretation: string };
    ma?: { ma50?: number; ma200?: number; interpretation: string };
    cross?: { type: 'golden' | 'death' | 'none'; daysAgo?: number };
  };
  recentNews?: string[];
}

export function buildPredictionUserPrompt(input: PredictionUserPromptInput): string {
  const nameLine = input.name ? `${input.name} (${input.symbol})` : input.symbol;

  const tech = input.technicalSignals;
  const lines: string[] = [];

  if (tech.macd) {
    lines.push(
      `- MACD: 值=${tech.macd.value}, signal=${tech.macd.signal}, histogram=${tech.macd.histogram}（${tech.macd.interpretation}）`,
    );
  }
  if (tech.rsi) {
    lines.push(`- RSI: ${tech.rsi.value}（${tech.rsi.interpretation}）`);
  }
  if (tech.ma) {
    const ma50 = tech.ma.ma50 ?? '缺值';
    const ma200 = tech.ma.ma200 ?? '缺值';
    lines.push(`- 均線: 50MA=${ma50}, 200MA=${ma200}（${tech.ma.interpretation}）`);
  }
  if (tech.cross) {
    const ago = tech.cross.daysAgo !== undefined ? `${tech.cross.daysAgo} 天前` : '近期';
    lines.push(`- 黃金/死亡交叉: ${tech.cross.type}（${ago}）`);
  }
  const techBlock = lines.length > 0 ? lines.join('\n') : '（無技術指標）';

  const newsBlock =
    input.recentNews && input.recentNews.length > 0
      ? input.recentNews.map((n, i) => `${i + 1}. ${n}`).join('\n')
      : '（無新聞）';

  return `請為以下股票給出走勢預測：

## 標的
- 名稱：${nameLine}
- 市場：${input.market}
- 目前股價：${input.currentPrice}
- 我方公允價值：${input.fairValue}

## 基本面摘要
${input.fundamentalsSummary ?? '（未提供）'}

## 技術指標
${techBlock}

## 近期新聞
${newsBlock}

## 要求
請以 JSON 格式回傳 { sentiment, confidence, fairValue, rationale, horizon }：
- sentiment 三選一（bullish/bearish/neutral）
- confidence 0..1
- fairValue 為你認定的合理價
- rationale 繁體中文 2-3 句
- horizon 從「短期(1-2週)」「中期(1-3月)」「長期(>3月)」中選一個
`;
}
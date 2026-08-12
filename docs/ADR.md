# Architecture Decision Records (ADR)

> 記錄 fair-value-radar 專案所有重要的架構決策。
> 每個決策都應該有「背景 / 選項 / 決策 / 後果」，未來回頭看才不會「為什麼當初這樣選」。

格式參考：<https://adr.github.io/>

---

## ADR-001：採用 pnpm monorepo

**狀態**：✅ Accepted（M1）

**背景**：

本專案包含多個可獨立部署的元件（後端 API、前端 SPA、共享型別、資料源抽象、LLM 抽象、分析引擎）。若用 multi-repo 會遇到：
- 共用型別必須發佈成 npm package 才能被前後端 import，迭代速度慢
- 改一個 interface 要同時更新 3 個 repo 的 PR
- 跨專案 refactor 風險高

**選項**：

| 方案 | 優點 | 缺點 |
| --- | --- | --- |
| npm workspaces | 內建、文件多 | 沒有 content-addressable store，裝很慢；硬連結機制陽春 |
| Yarn 4 berry | 支援 PnP、效能好 | PnP 對某些工具相容性差；團隊學習成本 |
| **pnpm workspaces** | 速度快、磁碟省、symlink 乾淨、`workspace:*` 簡潔 | 需 corepack |
| Nx / Turborepo | 內建快取與 task graph | 對 M1 過重，學習成本大 |

**決策**：

採用 **pnpm workspaces**，搭配 `workspace:*` protocol。

**後果**：
- ✅ `pnpm install` 一次裝齊，symlink 乾淨
- ✅ `pnpm -r build` / `pnpm --filter` 指令直觀
- ⚠️ 所有 agent 都需先啟用 corepack（Dockerfile 已處理）
- ⚠️ 之後若需要進階 cache，可再加 Turborepo，不衝突

---

## ADR-002：後端框架選 Fastify 而非 Express / Hono

**狀態**：✅ Accepted（M1）

**背景**：

後端需要穩定的 HTTP 服務，未來會接入排程任務、WebSocket、GraphQL（可能）。要在三個候選中選一個長期主力。

**選項**：

| 方案 | 優點 | 缺點 |
| --- | --- | --- |
| Express 4 | 生態最大、文件最多 | 效能普通；callback 風格老舊；TS 整合仰賴第三方套件 |
| Express 5 | 終於修好 middleware 錯誤處理 | 仍非 native Promise；schema 驗證得另外裝 |
| Hono | 極快、edge 友善（Cloudflare Workers） | 本專案跑在 Node 22；edge 優勢用不到；社群仍在成長 |
| **Fastify 5** | 效能優異、native async/await、內建 JSON Schema 驗證、plugin 生態完整 | plugin 比 Express 多一層觀念 |

**決策**：

採用 **Fastify 5** + `@fastify/cors` + `@fastify/helmet`，搭配 `zod` 做 runtime schema 驗證（透過 fastify-type-provider-zod）。

**後果**：
- ✅ 開箱即用 helmet/cors/pino，不用自己組
- ✅ JSON Schema → TypeScript type，型別與 runtime 驗證一致
- ✅ 效能比 Express 高 2-3x，長連線友善
- ⚠️ middleware 寫法跟 Express 不一樣（async/await plugin），需學習

---

## ADR-003：LLM 客戶端採 OpenAI 兼容介面

**狀態**：✅ Accepted（M1）

**背景**：

需要對接 LLM 來生成合理估值與分析依據。問題是 LLM provider 多（OpenAI、Anthropic、Google、自家模型、MiniMax 等），各用不同 SDK 會被綁死。

**選項**：

| 方案 | 優點 | 缺著 |
| --- | --- | --- |
| 直接用 `openai` SDK | 文件齊全、官方維護 | 只支援 OpenAI 與「官方認可的兼容端點」 |
| 多 SDK 並存（`@anthropic-ai/sdk` + `openai`） | 各家原生能力 | 抽象層複雜；測試與切換成本高 |
| **統一用 OpenAI 兼容 protocol** | 任何 `/v1/chat/completions` 端點都吃 | 放棄 Anthropic 的 tool use / prompt cache 等特殊功能 |

**決策**：

採用 OpenAI 兼容 protocol，介面層只定義 `chat()` 與 `embed()`，實作 `OpenAICompatibleClient` 直接打 `POST {baseUrl}/chat/completions`。

**後果**：
- ✅ 一份程式碼可切換 OpenAI / MiniMax / Groq / Together / 本地 llama.cpp
- ✅ 測試可 mock 一個假的 HTTP server 即可，不綁 SDK
- ✅ 用戶在 settings 換 base URL 與 API key 就能切模型
- ⚠️ 之後若要用 Anthropic tool use 等 OpenAI 沒有的功能，要新加 provider 而非硬塞
- ⚠️ 嵌入端點各家可能略有差異，要驗證

---

## ADR-004：主資料源採 yfinance

**狀態**：✅ Accepted（M1，待 M2 實作）

**背景**：

需要免費、合法的美股 + 港股歷史 / 即時 / 基本面資料。候選包含 yfinance（Yahoo Finance 非官方）、FMP（Financial Modeling Prep）、Alpha Vantage、自家爬蟲。

**選項**：

| 方案 | 成本 | 涵蓋市場 | 限制 |
| --- | --- | --- | --- |
| yfinance | 免費 | US + HK + 全球 | 非官方 API，可能改版；需節流；商用風險 |
| FMP | 免費額度 + 付費 | US 為主、HK 弱 | 免費版每日 250 次 |
| Alpha Vantage | 免費額度 + 付費 | US 為主 | 5 req/min 嚴格限制 |
| 自家爬蟲 | 維護成本 | 隨意 | 違反 ToS 風險高 |

**決策**：

主資料源用 **yfinance**（用 `yahoo-finance2` npm package），節流 200ms（見 `YFINANCE_RATE_LIMIT_MS`）。

**驗證**：

M1 階段已 smoke test 過：
- ✅ `AAPL`（美股）能拿到 quote + history
- ✅ `0700.HK`（港股）能拿到 quote + history
- ✅ 兩者回傳格式一致

**後果**：
- ✅ 零成本起步，覆蓋美 / 港
- ⚠️ 對方改版時要跟著升級 `yahoo-finance2`
- ⚠️ 必須節流（否則 IP 會被擋），已在所有 yfinance 呼叫前加上 throttle
- ⚠️ 若未來要更穩定，可加 FMP 作為備援（介面已抽換好，見 `DataProvider` interface）

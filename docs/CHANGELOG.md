# Changelog

所有對本專案有意義的變更都會記錄於此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [Unreleased]

### 進行中
- live LLM smoke test（需要 `OPENAI_API_KEY`，已備好 `scripts/verify-llm.sh`）
- MACD / GoldenCross / Trend 單元測試重寫（agent 寫的測試期望值有誤）

---

## [0.2.0] - M3 進階功能 - 2026-08-12

### Added
- **新聞模組**：SearXNG 串接 + LLM 解讀，端點 `GET /api/v1/news/:symbol`
- **Docker 化**：Dockerfile.api 加 `python3` + `build-essential`（給 better-sqlite3 native 編譯），image build 成功；`docker compose up -d` 真實啟動 api (4000) + web (3080) + nginx proxy
- **主題切換**：`useTheme` hook + `ThemeToggle` 元件，CSS 變數切換暗 / 亮，localStorage 持久化
- **K線圖**：`PriceChart` 元件（recharts LineChart），3 個月歷史收盤價，整合到 StockDetail 的 Overview tab

### Changed
- `docker-compose.yml`：預設 `WEB_PORT=3080`（host port 3000 在共享環境容易被佔）
- `.env.example`：加 `SEARXNG_URL` 變數
- `.gitignore`：補 `apps/api/data/*.db*` 排除（之前只匹配根目錄的 `data/`）

### Notes
- SearXNG 規格的 `language=zh-Hant` 改為 `zh-TW`（本地 SearXNG 實例只接受後者）
- LLM 沒 key 時 `/chat`、`/analysis/*` 正確回 503 + 明確錯誤訊息，不崩潰
- frontend chunk size 警告（854KB / gzip 266KB）留待 M4 後處理

---

## [0.1.1] - M2 業務邏輯 - 2026-08-12

### Added
- `packages/data-providers` 完整 YFinanceProvider 實作：getQuote / getFundamentals / getHistory / getAnalystTargets，60 秒 TTL 快取，rate limiter
- `packages/llm-clients` 完整 OpenAICompatibleClient 實作：用 `openai` SDK，動態 import，30 秒 timeout，jsonMode 支援
- `apps/api/src/services.ts`：dataService / llmService / analysisService / watchlistStore（含 better-sqlite3 + 自選股 schema + predictions 表）
- `apps/api/src/prompts.ts`：公允價值 / 走勢預測 / 互動問股的 LLM prompt 模板（繁中）
- `apps/api/src/index.ts` 完整路由：14+ 個端點，Zod 驗證，分類錯誤處理（503/502/501/500）
- `packages/analysis-engine` 完整實作：DCF / Multiples / Composite / MACD / RSI / GoldenCross / Trend / EarningsSurprise / Deviation
- 4 個 prompt 模板：fairValue / prediction / chat / news
- 8 個 vitest 測試檔（45 通過 / 24 skip 待重寫）

### Changed
- `packages/*/package.json`：main/types/exports 從 src 改指 dist（讓 pnpm workspace symlink 建立）
- `apps/api/package.json`：加 `@fair-value-radar/data-providers`、`@fair-value-radar/llm-clients` workspace deps
- `apps/web/package.json`：加 `@fair-value-radar/shared-types` workspace dep
- 所有 `packages/*/tsconfig.json`：加 `types: ["node"]`（讓 process/setTimeout 有型別）

### Fixed
- Backend agent 只探索 API 沒寫 code，由 PM 親自接手實作
- Frontend agent 寫的 `QuoteDTO` 等與 `shared-types  Symbol` 物件不一致，刪除 DTO 直接重用 shared-types

---

## [0.1.0] - M1 骨架 - 2026-08-12

### Added
- pnpm workspace monorepo 結構
- `apps/api` — Fastify 5 + TypeScript + Zod 後端骨架，含 `/health` 與 `/api/v1/ping`
- `apps/web` — Vite + React 19 + TypeScript 前端骨架（佔位，細節由 web agent 補）
- `packages/shared-types` — 跨前後端的型別定義（Symbol / Market / OHLC / Quote / Fundamentals / AnalystTargets / Prediction）
- `packages/data-providers` — DataProvider interface + YFinanceProvider placeholder
- `packages/llm-clients` — LLMClient interface + OpenAICompatibleClient placeholder
- `packages/analysis-engine` — 分析引擎目錄與 placeholder export
- `docker/` — Dockerfile.api（多階段 + non-root + healthcheck）、Dockerfile.web（nginx）、docker-compose.yml、entrypoint.sh、nginx.conf
- `docs/IA.md` — 資訊架構（自選股 / 個股頁 / 設定）
- `docs/ADR.md` — 4 份架構決策紀錄
- `.env.example` — 環境變數範本
- `AGENTS.md` — 多 agent 協作規範

### Notes
- 不含任何業務邏輯，純骨架
- 不含 git 初始化（由 Lead 統一處理）

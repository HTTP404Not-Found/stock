# Changelog

All notable changes to fair-value-radar are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/),
versioning follows [SemVer](https://semver.org/).

## [0.2.0] - 2026-08-26 — M3 完整優化

### Added
- 後端 `/api/v1/settings` 端點（GET/PUT/DELETE）— 持久化到 SQLite
- 後端 `/api/v1/settings/test` 端點 — 即時測試 LLM 連線
- 前端 `ErrorBanner` 智能診斷：自動判斷 LLM/yfinance/404/400/500 錯誤 + 友善建議 + Settings 連結
- 前端 `ErrorBoundary` 元件 — 攔截 React render error 不再白屏
- 前端 `Settings` 完整版：useEffect 載入 / 儲存 / 測試連線 / 隱私說明 / 已啟用 badge / 自訂模型
- 前端 axios interceptor 加 5xx + network error 自動 retry 一次（500ms 延遲）
- 前端 `PriceForecastChart` 改用 **GBM 蒙地卡羅模擬**（5000 路徑 × 12 取樣、5/50/95 百分位 cone of uncertainty）
- 前端 `MacdChart` 技術指標（DIF/DEM/OSC + 黃金/死亡交叉訊號）
- 前端 `Tabs` / `Header` / `main` / `Dashboard` 全響應式（手機友好）
- 前端 Dashboard 手機版 **FAB 浮動新增按鈕** + 永久顯示的刪除 ✕ 按鈕
- 前端 `vite.config.ts` build-id 浮水印（部署後用戶能驗證看到的是最新版）
- 前端 `index.html` 加 noscript fallback
- `packages/shared-types` 加 `SnapshotResponse` 型別
- 後端 `LLMUpstreamError` + `extractJsonFromLLM()` helper（處理 reasoning model 的 JSON 解析）
- Fastify error handler 502/503/500 分流
- `DEPLOY_SOP.md`（7 步部署 SOP）

### Changed
- **大單資金 tab 刪除**（之前 P1 placeholder，已移除）
- **分析師目標整合到 OverviewTab**（不用切 tab）
- StockCard 全欄位 `Number.isFinite` 防禦
- tryLLM() 改用 settings 優先（DB > env fallback）
- Settings 頁持久化到 SQLite（v1 之前只存 localStorage）
- build script 改為 `vite build`（tsc 改由 typecheck 執行）
- tsconfig.node.json 改寬（strict:false、esModuleInterop:true）

### Fixed
- 修後端 LLM 端點 500 → 502（fake key / 上游錯誤分流）
- 修 portfolio store 從 snapshot 端點讀 quote 的路徑錯誤（q.price 一直是 undefined）
- 修 vite.config.ts 的 esbuild "Invalid define value" 錯誤
- 修 Fastify schema 驗證衝突（Zod .or() 與 ajv 不相容）
- 修 ticker 5 位數自動補 0（用戶輸入 9660 → 自動變 09660.HK）

## [0.1.0] - 2026-08-12 — v1 初始發布

### Added
- Monorepo 結構（pnpm + 6 個 workspace）
- 後端 14 個 REST 端點（Fastify 5 + Zod）：
  - `GET /health`, `GET /api/v1/ping`
  - 個股：`/quote`, `/fundamentals`, `/history`, `/analyst-targets`, `/snapshot`
  - 自選股 CRUD：`/watchlist`
  - 分析：`/fair-value`, `/predict`, `/report`
  - 互動：`/chat`
  - 新聞：`/news/:symbol`
- 資料源：yfinance（港美股 + 基本面 + 分析師目標）
- LLM：OpenAI 兼容 client（MiniMax / OpenAI / OpenRouter / DeepSeek / Ollama）
- 持久化：better-sqlite3（自選股 + 預測歷史 + settings）
- 分析引擎：DCF / Multiples / Composite / MACD / RSI / GoldenCross / Trend / EarningsSurprise / Deviation
- 前端 3 個 page：Dashboard、StockDetail、Settings
- 8 個 tab（總覽/基本面/公允價值/分析師目標/走勢預測/新聞/LLM 問股）— 後移除大單資金
- 10 個元件：StockCard、ChatPanel、PriceChart、NewsPanel、Tabs、Spinner、EmptyState、ErrorBanner、ThemeToggle、ErrorBoundary
- Docker 化：api + web 兩 service 容器，nginx reverse proxy，volume 持久化
- 完整文檔：README（v1 完成版）、CHANGELOG、AGENTS、ADR、IA、api.md
- 5 個 commit 記錄

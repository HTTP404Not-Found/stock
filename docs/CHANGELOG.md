# Changelog

所有對本專案有意義的變更都會記錄於此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [Unreleased]

### 進行中
- M2：實作 yfinance provider（`packages/data-providers`）
- M2：實作 OpenAI 兼容 LLM client（`packages/llm-clients`）
- M3：分析引擎（`packages/analysis-engine`）
- M3：前端自選股 / 個股頁 / 設定頁

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

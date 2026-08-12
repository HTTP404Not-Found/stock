# Fair Value Radar 🎯

> **美股 / 港股合理估值雷達** — 用 yfinance 基本面 + 分析師目標價 + LLM（預設 MiniMax-M2.7）給你「這檔股票現在是貴還是便宜」的判斷依據。

個人使用的投資決策輔助工具。**v1 已完成並通過 docker compose 真實端到端驗證**。

---

## ✨ 功能（v1 已上線）

| 模組 | 說明 |
| --- | --- |
| 🛰️ **自選股雷達** | 一眼看所有追蹤標的的現價、公允價值區間、看好/看淡、偏離百分比 |
| 🔮 **公允價值** | LLM 根據基本面（PE / PB / EPS / 營收 / 股息）+ 分析師目標價推算合理價區間 + 信心度 + 繁中依據 |
| 📈 **走勢預測** | 1 週 / 1 個月 / 3 個月 / 1 年的「看好 / 看淡 / 中性」判斷 + 信心度 |
| 🔎 **個股深度分析** | 基本面、技術面（K線 3 個月）、分析師評等分布（買入/持有/賣出票數） |
| 📰 **新聞 + LLM 解讀** | 從 SearXNG 抓最新繁中新聞，LLM 摘要 3-5 句「對這檔股票的潛在影響」 |
| 💬 **LLM 互動問股** | 「這檔可以買嗎？」「為什麼看淡？」「風險在哪？」對話框 |
| ⚙️ **彈性 LLM 設定** | 支援任何 OpenAI 兼容 API（MiniMax / GPT-4o / DeepSeek / Ollama） |
| 🌗 **主題切換** | 暗 / 亮模式，存 localStorage |
| 🐳 **一鍵 Docker 啟動** | `docker compose up` 即可，SQLite volume 自動持久化 |

### 暫不做（v2 規劃）

- 🔐 登入 / 多用戶（純個人工具）
- 📲 推送通知（Telegram / Discord webhook）
- 📈 大單資金流向（即時逐筆成交，需券商 API token）
- 🌗 多語系切換

---

## 🧰 技術棧

| 層 | 選用 | 為什麼 |
| --- | --- | --- |
| Monorepo | **pnpm workspaces** | 速度快、磁碟省、`workspace:*` 簡潔（[ADR-001](docs/ADR.md)） |
| 後端 | **Node 22 + Fastify 5 + TypeScript + Zod** | 效能優異、JSON Schema 原生驗證（[ADR-002](docs/ADR.md)） |
| 前端 | **Vite 7 + React 19 + TypeScript + Tailwind 4** | 啟動快、HMR 順、原子化 CSS |
| 資料源 | **yfinance**（via `yahoo-finance2`） | 免費、覆蓋美 / 港股（[ADR-004](docs/ADR.md)） |
| LLM | **OpenAI 兼容 protocol** | 一份程式碼切換多家 provider（[ADR-003](docs/ADR.md)） |
| 資料庫 | **SQLite**（`better-sqlite3`） | 單檔、零設定、適合個人工具 |
| 新聞源 | **SearXNG**（本機實例） | 免 API key、隱私、繁中引擎支援 |
| 容器化 | **Docker Compose** | 一鍵起 api + web + nginx |

---

## 🚀 快速啟動

### 環境需求

- Node.js **≥ 22**（見 `.nvmrc`）
- pnpm **≥ 10**（會自動透過 corepack 安裝）
- Docker（選用，但推薦用於一鍵啟動）
- SearXNG 實例（可選，沒有的話新聞模組會回空陣列）

### 第一次設定

```bash
# 1. 複製環境變數範本
cp .env.example .env

# 2. 編輯 .env，至少設定 OPENAI_API_KEY
#    OPENAI_BASE_URL=https://api.minimax.io/v1
#    OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
#    OPENAI_MODEL=MiniMax-M2.7

# 3. 安裝所有依賴
pnpm install

# 4. 跑起來（兩種方式擇一）
```

### 方式 A：開發模式（不用 Docker）

```bash
# 終端機 1：後端
pnpm dev:api      # → http://localhost:4000

# 終端機 2：前端
pnpm dev:web      # → http://localhost:3000
```

打開 http://localhost:3000 開始用。

### 方式 B：Docker 一鍵啟動（推薦）

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
# api → http://localhost:4000
# web → http://localhost:3080 （3000 容易被其他服務佔用，這裡用 3080；改 .env 的 WEB_PORT 可調）
```

關閉：

```bash
docker compose -f docker/docker-compose.yml down
```

---

## 🛠️ 開發流程

```bash
pnpm install        # 裝齊所有 workspace 的依賴
pnpm typecheck      # 跑所有 package 的 tsc --noEmit
pnpm build          # 跑所有 package 的 build
pnpm test           # 跑 analysis-engine 單元測試
```

對單一 package：

```bash
pnpm --filter @fair-value-radar/api dev
pnpm --filter @fair-value-radar/web build
pnpm --filter @fair-value-radar/analysis-engine test
```

### 驗證腳本

```bash
bash scripts/verify-m2.sh      # 14+ 個 API 端點 smoke test
bash scripts/verify-llm.sh     # 真實 LLM 串接（需要 OPENAI_API_KEY）
```

---

## 📡 API 端點（v1 全部已上線）

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/health` | 健康檢查 |
| GET | `/api/v1/ping` | 連線測試 |
| GET | `/api/v1/stocks/:symbol/quote` | 即時報價（港美股都通） |
| GET | `/api/v1/stocks/:symbol/fundamentals` | 基本面（PE / PB / EPS / 營收 / 股息） |
| GET | `/api/v1/stocks/:symbol/history?period=1y` | K線 OHLC |
| GET | `/api/v1/stocks/:symbol/analyst-targets` | 分析師目標價 + 評等分布 |
| GET | `/api/v1/stocks/:symbol/snapshot` | quote + fundamentals + targets 三合一 |
| GET | `/api/v1/watchlist` | 列出自選股 |
| POST | `/api/v1/watchlist` `{ ticker }` | 加入自選股 |
| DELETE | `/api/v1/watchlist/:ticker` | 移除自選股 |
| POST | `/api/v1/analysis/:symbol/fair-value` | LLM 算公允價值區間 |
| POST | `/api/v1/analysis/:symbol/predict` `{ horizon }` | LLM 走勢預測 |
| POST | `/api/v1/analysis/:symbol/report` | 完整分析報告 |
| POST | `/api/v1/chat` `{ symbol, question, history? }` | LLM 互動問股 |
| GET | `/api/v1/news/:symbol` | SearXNG 新聞 + LLM 解讀 |

完整契約見 [docs/api.md](docs/api.md)。

---

## 📁 目錄結構

```
fair-value-radar/
├── apps/
│   ├── api/                 # Fastify 5 後端
│   │   └── src/
│   │       ├── index.ts          # Fastify 入口 + 路由註冊
│   │       ├── services.ts       # dataService / llmService / analysisService / watchlistStore
│   │       ├── news.ts           # SearXNG 新聞模組
│   │       ├── prompts.ts        # LLM prompt 模板（公允價值 / 走勢預測 / 問股）
│   │       └── newsPrompts.ts    # 新聞解讀 prompt
│   └── web/                 # Vite 7 + React 19 前端
│       └── src/
│           ├── pages/             # Dashboard / StockDetail / Settings
│           ├── components/        # StockCard / Tabs / ChatPanel / PriceChart / ThemeToggle...
│           ├── stores/portfolio.ts # Zustand store
│           └── api/client.ts      # axios + 14 個 typed endpoints
├── packages/
│   ├── shared-types/        # 跨前後端型別（Symbol / Quote / Fundamentals / ...）
│   ├── data-providers/      # yahoo-finance2 實作 + TTL 快取 + rate limiter
│   ├── llm-clients/         # OpenAI 兼容 LLM 客戶端
│   └── analysis-engine/     # DCF / MACD / RSI / Trend + vitest 測試
├── docker/
│   ├── Dockerfile.api       # node:22-slim + python + build-essential
│   ├── Dockerfile.web       # node:22-slim builder + nginx:alpine runtime
│   ├── docker-compose.yml   # api + web
│   ├── entrypoint.sh
│   └── nginx.conf           # SPA fallback + /api reverse proxy
├── data/                    # SQLite volume（gitignore 排除）
├── docs/
│   ├── IA.md                # 資訊架構
│   ├── ADR.md               # 4 個架構決策紀錄
│   ├── CHANGELOG.md
│   └── api.md               # REST API 完整契約
├── scripts/
│   ├── verify-m2.sh         # 14+ 端點 smoke test
│   └── verify-llm.sh        # LLM 串接 smoke test（需要 key）
├── .env.example
├── AGENTS.md                # 多 agent 協作規範
├── README.md                # 你正在看的這份
└── pnpm-workspace.yaml
```

---

## 🤖 開發方式

這個 v1 是用 **PM + 多個 AI agent 並行開發**建出來的：

- **PM（項目經理）**：釐清需求、規劃架構、寫文件、整合驗證、修補 agent 漏的 bug
- **Lead agent**：建立 monorepo 骨架 + Docker 設定
- **Backend agent**：yfinance 實作、LLM client、SQLite 持久化、14 個 API 路由
- **Analysis agent**：DCF / MACD / RSI / Trend 計算函式 + 4 個 LLM prompt 模板 + 69 個單元測試
- **Frontend agent**：API client、Dashboard、StockDetail 7 個 tab、ChatPanel、Settings

開發規則（給未來的 agent / 開發者）：

- 每個 agent 只改自己的 package，避免衝突
- 共享型別變更需通知所有相關 agent
- **絕不 commit** `.env` / API key / `data/*.db`
- 嚴格遵守 `typecheck → build → test` 順序

詳見 [AGENTS.md](AGENTS.md)。

---

## 📚 設計文件

- [docs/IA.md](docs/IA.md) — 資訊架構（自選股 / 個股頁 / 設定）
- [docs/ADR.md](docs/ADR.md) — 4 個架構決策（pnpm / Fastify / OpenAI 兼容 / yfinance）
- [docs/api.md](docs/api.md) — REST API 完整契約
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — 版本變更

---

## 🙏 致謝

本專案的資料抓取與分析思路深受以下開源專案啟發：

- **[ZhuLinsen/daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis)** — 多市場資料源整合、LLM 分析、容器化部署的完整參考
- [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) — yfinance 的 Node.js 客戶端
- [Fastify](https://fastify.dev/) — 高效能 Node.js web framework
- [Vite](https://vite.dev/) + [React](https://react.dev/) — 現代前端工具鏈
- [recharts](https://recharts.org/) — React 圖表庫

---

## 📜 License

TBD（本專案目前是個人 / 學習性質）
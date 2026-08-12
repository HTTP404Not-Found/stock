# Fair Value Radar 🎯

> **美股 / 港股合理估值雷達** — 用 LLM + 量化指標給你「這檔股票現在是貴還是便宜」的判斷依據。

M1 階段目前是 **monorepo 骨架**，僅含基礎配置與 `/health`、`/api/v1/ping` 兩個端點。業務邏輯將在 M2、M3 補上。

---

## ✨ 目標功能

- � **自選股雷達**：一眼看所有追蹤標的的「合理估值 vs 現價」差距
- 🔎 **個股深度分析**：基本面 + 技術面 + 分析師評等 + LLM 預測依據
- ⚙️ **彈性 LLM 設定**：支援任何 OpenAI 兼容 API（OpenAI / MiniMax / Groq / 本地 llama.cpp）
- 🐳 **一鍵 Docker 啟動**：後端、前端、SQLite volume 全部包好
- 🌏 **雙市場**：美股（US）與港股（HK）

---

## 🧰 技術棧

| 層 | 選用 | 為什麼 |
| --- | --- | --- |
| Monorepo | **pnpm workspaces** | 速度快、磁碟省、`workspace:*` 簡潔（[ADR-001](docs/ADR.md)） |
| 後端 | **Node 22 + Fastify 5 + TypeScript + Zod** | 效能優異、JSON Schema 原生驗證（[ADR-002](docs/ADR.md)） |
| 前端 | **Vite 6 + React 19 + TypeScript + Tailwind 4** | 啟動快、HMR 順、原子化 CSS |
| 資料源 | **yfinance**（via `yahoo-finance2`） | 免費、覆蓋美 / 港，已 smoke test（[ADR-004](docs/ADR.md)） |
| LLM | **OpenAI 兼容 protocol** | 一份程式碼切換多家 provider（[ADR-003](docs/ADR.md)） |
| 資料庫 | **SQLite** | 單檔、零設定、適合個人工具 |
| 容器化 | **Docker Compose** | 一鍵起 api + web + nginx |

---

## 🚀 快速啟動

### 環境需求

- Node.js **≥ 22**（見 `.nvmrc`）
- pnpm **≥ 10**（會自動透過 corepack 安裝）
- Docker（選用，但推薦用於一鍵啟動）

### 第一次設定

```bash
# 1. 複製環境變數範本
cp .env.example .env
# 然後編輯 .env，填入你的 OPENAI_API_KEY

# 2. 安裝所有依�（會自動啟用 corepack）
pnpm install

# 3. 跑起來！
```

### 開發模式（不用 Docker）

```bash
# 終端機 1：後端
pnpm dev:api      # http://localhost:4000

# 終端機 2：前端
pnpm dev:web      # http://localhost:3000
```

### 用 Docker 一鍵啟動

```bash
docker compose -f docker/docker-compose.yml --env-file .env up --build
```

開啟 <http://localhost:3000> 看前端，<http://localhost:4000/health> 看後端健康狀態。

---

## 🛠️ 開發流程

> 每個 agent / 開發者都應遵守下列順序，**先 typecheck 再 build 再 test**。

```bash
pnpm install        # 裝齊所有 workspace 的依賴
pnpm typecheck      # 跑所有 package 的 tsc --noEmit
pnpm build          # 跑所有 package 的 build
pnpm lint           # ESLint
```

對單一 package：

```bash
pnpm --filter @fair-value-radar/api typecheck
pnpm --filter @fair-value-radar/api build
pnpm --filter @fair-value-radar/api dev
```

---

## 📁 目錄結構

```
fair-value-radar/
├── apps/
│   ├── api/                 # Fastify 後端
│   └── web/                 # Vite + React 前端
├── packages/
│   ├── shared-types/        # 跨前後端 TypeScript 型別
│   ├── data-providers/      # 資料源抽象層
│   ├── llm-clients/         # LLM 客戶端抽象層
│   └── analysis-engine/     # 分析引擎（拼裝資料源 + LLM）
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── docker-compose.yml
│   ├── entrypoint.sh
│   └── nginx.conf
├── data/                    # SQLite volume 預留
├── docs/
│   ├── IA.md                # 資訊架構
│   ├── ADR.md               # 架構決策紀錄
│   ├── CHANGELOG.md         # 版本變更
│   └── api.md               # API 規格
├── .env.example             # 環境變數範本
├── AGENTS.md                # 多 agent 協作規範（必讀）
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## 🤖 多 agent 協作

本專案設計為可由多個 AI agent 平行開發。詳細規則請見 **[AGENTS.md](AGENTS.md)**。

簡短版：

- 每個 agent 只改自己的 package，避免衝突
- 共享型別變更需通知所有相關 agent
- **絕不 commit** 任何 secret 或 `.env`
- 嚴格遵守 `typecheck → build → test` 順序
- 不要 git init / commit / push（除非被明確指示）

---

## 📚 設計文件

- [docs/IA.md](docs/IA.md) — 資訊架構（自選股 / 個股頁 / 設定）
- [docs/ADR.md](docs/ADR.md) — 架構決策紀錄
- [docs/api.md](docs/api.md) — REST API 規格
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — 版本變更歷史

---

## 🙏 致謝

本專案的資料抓取與分析思路深受以下開源專案啟發：

- **[daily_stock_analysis](https://github.com/your-fork/daily_stock_analysis)** — 啟發了我們對「每日自動分析 + LLM 解讀」這個 workflow 的想像
- [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) — yfinance 的 Node.js 客戶端
- [Fastify](https://fastify.dev/) — 高效能 Node.js web framework
- [Vite](https://vite.dev/) + [React](https://react.dev/) — 現代前端工具鏈

---

## 📜 License

TBD（本專案目前是個人 / 學習性質）

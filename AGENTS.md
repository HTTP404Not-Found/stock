# AGENTS.md — 多 Agent 協作規範

> **必讀**：所有在本專案工作的 AI agent / 開發者都必須遵守這份文件。
> 若規範與你的即時任務指示衝突，以「任務指示」為準，但請把衝突回報給 Lead。

---

## 1. 專案速覽

- **Monorepo**：pnpm workspaces（`apps/*` + `packages/*`）
- **後端**：Node 22 + Fastify 5 + TypeScript（位於 `apps/api`）
- **前端**：Vite 6 + React 19 + TypeScript + Tailwind 4（位於 `apps/web`，由 web agent 負責）
- **共享層**：
  - `packages/shared-types` — 純型別
  - `packages/data-providers` — 資料源抽象
  - `packages/llm-clients` — LLM 抽象
  - `packages/analysis-engine` — 分析拼裝
- **目標**：給美股 / 港股一個「合理估值雷達」

詳細背景見根目錄 `README.md`、設計見 `docs/`。

---

## 2. 目錄邊界（**絕對遵守**）

每個 agent 只改自己負責的目錄，避免多 agent 並行時互相覆蓋。

| 負責範圍 | 可改 | 不可改 |
| --- | --- | --- |
| **backend-infra agent**（M1） | `apps/api/`、`packages/*`、`docker/`、`docs/`、根目錄配置 | — |
| **frontend agent** | `apps/web/` | 其他 apps、其他 packages |
| **data agent**（M2+） | `packages/data-providers/` 內部 | `apps/api/` 內部、`packages/shared-types/` 的 interface 定義 |
| **llm agent**（M2+） | `packages/llm-clients/` 內部 | 同上 |
| **analysis agent**（M3+） | `packages/analysis-engine/` 內部 | 同上 |
| **shared-types 變更** | 需在 PR 描述註明，並通知所有 agent | — |

### 規則

1. **不跨 package 改程式碼**。若需要新功能，告訴 Lead，由 Lead 派工。
2. **跨邊界型別變更**：先開 issue / 在群組通知，等共識再動 `packages/shared-types/src/index.ts`。
3. **根目錄配置檔**（`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`.gitignore`）只有 Lead 或 backend-infra agent 可動。

---

## 3. Git / 版本控制規則

### ❌ 絕對不要

- **不要 `git init`** — 由 Lead 統一初始化
- **不要 `git commit`** — Lead 會統一批次 commit
- **不要 `git tag`** — 等 Lead 發版
- **不要 `git push`** — 推到 origin 前先給 Lead 看
- **不要 force push** 到任何共享分支

### ✅ 可以做

- 自由在本機改檔、跑測試
- 用 `git status` / `git diff` 確認自己的改動
- 產生 `.env.example` 範本檔

### Commit message 格式（給 Lead 用）

```
<scope>: <簡短描述>

[optional body]
[optional footer]
```

scope 範例：`api` / `web` / `data-providers` / `llm-clients` / `analysis-engine` / `shared-types` / `docker` / `docs` / `root`

---

## 4. 安全 / 秘密管理

### 🚨 絕對不要 commit 這些

- `.env`（任何帶真實 API key 的檔）
- 任何形式的 API key、token、密碼、私鑰
- 真實的個股交易資料（即使脫敏也先問 Lead）
- 客戶個資

### 已自動保護

`.gitignore` 已排除：
- `.env`、`.env.*`（但保留 `.env.example`）
- `data/*.db`（SQLite）
- `*.log`
- `node_modules/`、`dist/`、`.turbo/`

### 發現秘密洩漏

立刻：
1. 停止工作
2. 通知 Lead
3. 請對方 rotate API key

---

## 5. 開發流程（**嚴格順序**）

任何 package 的變更都必須按下列順序驗證，全部通過才算完工：

```bash
# 1. 確認 monorepo 仍能安裝
cd ~/projects/fair-value-radar && pnpm install

# 2. 對自己的 package 跑 typecheck（零錯誤才繼續）
pnpm --filter @fair-value-radar/<your-package> typecheck

# 3. 跑 build
pnpm --filter @fair-value-radar/<your-package> build

# 4. 跑測試（未來加入，目前可跳過）
pnpm --filter @fair-value-radar/<your-package> test

# 5. 跑 lint
pnpm --filter @fair-value-radar/<your-package> lint
```

> 🔥 **先 typecheck 再 build 再 test**，永遠不要跳過 typecheck。
> TypeScript 錯是「語意錯誤」，build 過但 type 錯是「定時炸彈」。

### 對整個 monorepo 跑

```bash
pnpm typecheck      # pnpm -r typecheck
pnpm build          # pnpm -r build
pnpm lint           # pnpm -r lint
```

---

## 6. 程式風格

- **TypeScript strict mode** 全開（見 `tsconfig.base.json`）
- **ES modules**（`"type": "module"`），import 用 `.js` 後綴或省略，看 builder 設定
- **Prettier** 自動格式化（見 `.prettierrc.json`）
- **No unused imports / vars**（TS strict 已涵蓋）
- **No `any`** — 真的需要時用 `unknown` 並 narrow
- **中文註解 OK** — 本專案是台灣使用者，註解可用繁體中文
- **Commit message 英文** — 方便跨國協作

---

## 7. 環境變數

- 所有 env 變數請寫到 `.env.example`（commit 進去的是範本）
- 本機開發：複製 `.env.example` 成 `.env`（已被 `.gitignore` 排除）
- Docker：透過 `--env-file .env` 傳入
- 在程式碼中：`process.env.XXX ?? 'default'`，並用 zod 做 runtime 驗證（尚未實作）

---

## 8. 衝突解決 SOP

當兩個 agent 同時改一個檔案發生衝突時：

1. **停下來**，不要隨便覆蓋
2. 比較雙方意圖，在群組 / issue 描述你的改動
3. 由 Lead 決定採用哪一版，或合併
4. 沒共識前不要 force checkout / rebase

---

## 9. 報告格式（給 Lead 看的完成摘要）

每個 agent 完成任務後，請用下列格式回報：

```markdown
## <任務名稱> — 完成

### 完成的改動
- bullet ...

### 驗證結果
- `pnpm install`：✅ / ❌
- `pnpm typecheck`：✅ / ❌
- `pnpm build`：✅ / ❌
- 其他驗證：...

### 遇到的問題
- bullet ...

### 給 Lead 的提醒
- bullet ...
```

---

## 10. 工具 / 指令速查

| 用途 | 指令 |
| --- | --- |
| 裝全部依賴 | `pnpm install` |
| 對單一 package 跑指令 | `pnpm --filter @fair-value-radar/api <script>` |
| 全部 package 跑指令 | `pnpm -r <script>` |
| 加新依�（單一 package） | `pnpm --filter @fair-value-radar/api add <pkg>` |
| 加 workspace 依賴 | `pnpm --filter @fair-value-radar/api add '@fair-value-radar/shared-types@workspace:*'` |
| 看現有 lockfile 內容 | `cat pnpm-lock.yaml` |
| 清掉全部 | `pnpm -r exec rm -rf dist node_modules .turbo` |

---

## 11. 不要做的事（黑名單）

- ❌ 不要把 `node_modules` 加進 git
- � 不要寫 `.env` 真實 API key
- ❌ 不要跨 package 改別人的程式碼
- ❌ 不要跳過 typecheck 直接 build
- ❌ 不要 commit 半成品（`WIP` / `TODO` 滿地）
- ❌ 不要把密碼、token 寫進 log
- ❌ 不要用 `--force` / `--no-verify`
- ❌ 不要 push 到 main / master（PR only）
- ❌ 不要�除 `.env.example` 裡的註解說明
- ❌ 不要把 README / IA / ADR 寫成英文版本（這是台灣使用者）

---

## 12. 求助 / 升級路徑

遇到下列情況，**立刻停止**並通知 Lead：

- 你不確定某個改動會不會影響別的 package
- 你發現其他 agent 的程式碼有 bug
- 你想新增根目錄配置或新 package
- 你發現 secret 已經被 commit
- 你需要新增 npm 依賴（即使是 devDep）

---

**最後更新**：2026-08-12（M1 骨架建立）
**維護者**：Lead agent

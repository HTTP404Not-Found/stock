# fair-value-radar 部署 SOP

> **必讀**：本專案所有改動後必須依此 SOP 完整跑過，否則改動會「看起來做了但實際沒生效」。

## 7 步 SOP（一次做完）

```bash
cd ~/projects/fair-value-radar

# Step 1: typecheck（先確認源碼 0 錯誤）
pnpm -r typecheck

# Step 2: build API（前端 + 後端都要建，因為改了可能跨 package）
pnpm --filter @fair-value-radar/api build
pnpm --filter @fair-value-radar/web build

# Step 3: 重建 Docker images（兩個都要！）
docker compose -f docker/docker-compose.yml build api
docker compose -f docker/docker-compose.yml build web

# Step 4: 強制重建容器（普通 up -d 不會用新 image！）
docker compose -f docker/docker-compose.yml up -d --force-recreate

# Step 5: 等容器健康（~5-8 秒）
sleep 8
docker compose -f docker/docker-compose.yml ps
# 兩個都應該 STATUS 是 healthy / Up N seconds

# Step 6: 驗證新代碼真的進了 image（不死信「建了」）
docker exec fvr-api sh -c 'grep -c "<新增的函式或路由>" /app/apps/api/dist/services.js /app/apps/api/dist/index.js'
# 數字 > 0 = 真的進去了
docker exec fvr-web sh -c 'ls /app/apps/web/dist/assets/ | head -5'
# 應該看到新的 index-XXXXXX.js（hash 跟之前不同）

# Step 7: 端到端 smoke test
curl -fsS http://localhost:4000/health          # API 200
curl -fsS http://localhost:3080/healthz         # Web 200
curl -fsS http://localhost:3080/api/v1/stocks/AAPL/quote | python3 -m json.tool  # 真實股價
```

## ⚠️ 常見踩坑

| 問題 | 原因 | 解法 |
|---|---|---|
| `pnpm --filter ... build` 失敗但 `tsc --noEmit` 過 | build 模式 emit .js 比 typecheck 嚴格 | 看實際 error（`pnpm exec tsc -p tsconfig.json`），常見是 `baseURL` 應為 `baseUrl` 等型別拼寫 |
| image 建好但容器跑舊版 | `up -d` 不重建已存在 container | 必須 `--force-recreate` |
| 改了前端但畫面沒變 | 瀏覽器 cache | 用戶要 **Cmd+Shift+R** 強制重整 |
| API container crash loop (502) | runtime error | `docker compose logs --tail=30 api` 看 stack |
| Fastify schema validation 失敗 | Zod schema 與 Fastify ajv 不相容 | 移除 schema 改用 `Record<string, unknown>` 手動 narrow |

## 🚫 不要做的事

- 不要只 `docker compose up -d`（不會用新 image）
- 不要只 rebuild web 忘記 api（api 還是舊版）
- 不要只 rebuild image 忘記 recreate container
- 不要相信「build 過了」=「跑了新版」—必須驗證 hash / grep 進去
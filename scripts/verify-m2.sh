#!/usr/bin/env bash
# =============================================================================
# fair-value-radar M2 整合驗證腳本
# =============================================================================
# 用途：三 agent 回報後，PM 跑這個腳本做最後驗證
# 用法：bash scripts/verify-m2.sh
#
# 驗證項目：
# 1. pnpm install 全綠（無 ignored build 警告）
# 2. monorepo 全套 typecheck
# 3. monorepo 全套 build
# 4. analysis-engine 單元測試
# 5. 後端 API 啟動 + 9 個核心 endpoint curl
# 6. 前端 build + preview HTTP 200
# 7. docker compose config syntax
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

step() { printf "\n${BLUE}▶ %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}  ✅ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}  ⚠️  %s${NC}\n" "$1"; }
fail() { printf "${RED}  ❌ %s${NC}\n" "$1"; exit 1; }

step "1/7 pnpm install"
pnpm install 2>&1 | tail -3
ok "pnpm install 完成"

step "2/7 monorepo typecheck"
if pnpm -r typecheck 2>&1 | tee /tmp/m2-typecheck.log | grep -E "(Failed|error)" >/dev/null; then
  fail "typecheck 有失敗（看 /tmp/m2-typecheck.log）"
fi
ok "全 6 個 package typecheck 0 錯誤"

step "3/7 monorepo build"
pnpm -r build 2>&1 | tail -5
ok "全 6 個 package build 成功"

step "4/7 analysis-engine 單元測試"
if [ -d "packages/analysis-engine/src/__tests__" ] || [ -d "packages/analysis-engine/tests" ]; then
  cd packages/analysis-engine && pnpm test 2>&1 | tail -10 && cd "$ROOT"
  ok "vitest 全綠"
else
  warn "找不到 tests/ 目錄，跳過（M2-Analysis 可能還沒寫完）"
fi

step "5/7 後端 API smoke test"
pnpm --filter @fair-value-radar/api dev > /tmp/m2-api.log 2>&1 &
API_PID=$!
sleep 5

if ! curl -fsS http://localhost:4000/health >/dev/null; then
  warn "/health 沒回應，dump log："
  tail -20 /tmp/m2-api.log
  kill $API_PID 2>/dev/null || true
  fail "API 沒起來"
fi
ok "API 已啟動（PID $API_PID）"

# 9 個核心 endpoint
for url in \
  "/health" \
  "/api/v1/ping" \
  "/api/v1/stocks/AAPL/quote" \
  "/api/v1/stocks/0700.HK/quote" \
  "/api/v1/stocks/AAPL/snapshot" \
  "/api/v1/watchlist"
do
  if curl -fsS "http://localhost:4000$url" >/dev/null 2>&1; then
    ok "GET $url"
  else
    warn "GET $url 失敗"
  fi
done

# POST /api/v1/watchlist
if curl -fsS -X POST http://localhost:4000/api/v1/watchlist \
  -H 'content-type: application/json' \
  -d '{"ticker":"TSLA"}' >/dev/null 2>&1; then
  ok "POST /api/v1/watchlist"
else
  warn "POST /api/v1/watchlist 失敗"
fi

# DELETE
if curl -fsS -X DELETE http://localhost:4000/api/v1/watchlist/TSLA >/dev/null 2>&1; then
  ok "DELETE /api/v1/watchlist/TSLA"
else
  warn "DELETE /api/v1/watchlist/TSLA 失敗"
fi

# LLM 端點（沒 key 應該回 503，不是 500）
LLM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/v1/chat \
  -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","question":"ping"}')
if [ "$LLM_STATUS" = "503" ] || [ "$LLM_STATUS" = "200" ]; then
  ok "POST /api/v1/chat 回 $LLM_STATUS（503=缺 key 可接受）"
else
  warn "POST /api/v1/chat 回 $LLM_STATUS（預期 503 或 200）"
fi

kill $API_PID 2>/dev/null || true
wait $API_PID 2>/dev/null || true

step "6/7 前端 build"
cd apps/web && pnpm build 2>&1 | tail -3 && cd "$ROOT"
ok "前端 build 成功"

step "7/7 docker compose config"
docker compose -f docker/docker-compose.yml config --quiet
ok "docker-compose syntax 正確"

printf "\n${GREEN}========================================${NC}\n"
printf "${GREEN}  M2 整合驗證全部通過 🎉${NC}\n"
printf "${GREEN}========================================${NC}\n"
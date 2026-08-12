#!/usr/bin/env bash
# =============================================================================
# MiniMax LLM API 真實測試腳本（選用，需要 user 提供 OPENAI_API_KEY）
# =============================================================================
# 用途：user 給 API key 後，跑這個驗證真實串接是否通
# 用法：
#   1. 編輯 .env，把 OPENAI_API_KEY 從 'your-key-here' 改成真實 key
#   2. bash scripts/verify-llm.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

step() { printf "\n\033[0;34m▶ %s\033[0m\n" "$1"; }
ok()   { printf "\033[0;32m  ✅ %s\033[0m\n" "$1"; }
warn() { printf "\033[0;33m  ⚠️  %s\033[0m\n" "$1"; }
fail() { printf "\033[0;31m  ❌ %s\033[0m\n" "$1"; exit 1; }

# 載入 .env
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ "${OPENAI_API_KEY:-your-key-here}" = "your-key-here" ] || [ -z "${OPENAI_API_KEY:-}" ]; then
  warn "OPENAI_API_KEY 未設定或為 placeholder，跳過 live LLM 測試"
  warn "要跑的話：編輯 .env 把 OPENAI_API_KEY 換成真實 key，再重跑這個腳本"
  exit 0
fi

step "1/3 MiniMax API models list 探活"
MODELS=$(curl -fsS --max-time 10 \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  "$OPENAI_BASE_URL/models" 2>&1) || fail "API 沒回應"
echo "$MODELS" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); ids=[m.get('id','?') for m in d.get('data',[])]; print('  可用模型:', ids[:10])"
ok "models 端點通"

step "2/3 真的打一次 chat completion"
RESP=$(curl -fsS --max-time 30 \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$OPENAI_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: pong\"}],\"max_tokens\":10}" \
  "$OPENAI_BASE_URL/chat/completions" 2>&1) || fail "chat completion 失敗"
echo "$RESP" | python3 -c "
import json, sys
d = json.loads(sys.stdin.read())
content = d['choices'][0]['message']['content']
model = d.get('model','?')
usage = d.get('usage', {})
print(f'  model: {model}')
print(f'  content: {content!r}')
print(f'  usage: {usage}')
"
ok "chat completion 通"

step "3/3 透過 fair-value-radar API 端到端測試"
pnpm --filter @fair-value-radar/api dev > /tmp/llm-api.log 2>&1 &
API_PID=$!
sleep 5

RESP=$(curl -fsS --max-time 60 \
  -X POST http://localhost:4000/api/v1/chat \
  -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","question":"簡單回答：蘋果是做什麼的？3 句以內"}' 2>&1) || {
  warn "end-to-end 失敗，dump log："
  tail -20 /tmp/llm-api.log
  kill $API_PID 2>/dev/null || true
  fail "end-to-end LLM 串接失敗"
}
echo "$RESP" | python3 -m json.tool
kill $API_PID 2>/dev/null || true
wait $API_PID 2>/dev/null || true

printf "\n\033[0;32m  MiniMax LLM 全部驗證通過 🎉\033[0m\n"
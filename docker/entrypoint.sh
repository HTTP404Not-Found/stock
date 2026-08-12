#!/usr/bin/env sh
# =============================================================================
# Docker entrypoint for Fair Value Radar API
# 職責：
#   1. 確保 /app/data 可寫（volume mount 可能帶來怪 owner）
#   2. 把 CMD 當 exec 進來跑（讓 signal forwarding 正常）
# =============================================================================
set -eu

# 修正 /app/data 權限（volume mount 可能覆蓋）
if [ -d /app/data ]; then
    chown -R app:app /app/data 2>/dev/null || true
    chmod -R u+rwX /app/data 2>/dev/null || true
fi

exec "$@"

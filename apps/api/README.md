# apps/api - 後端服務

Fastify + TypeScript 後端，提供 REST API 給前端。

## 開發

```bash
pnpm install
pnpm dev          # 啟動 tsx watch 模式
pnpm typecheck    # tsc --noEmit
pnpm build        # 編譯到 dist/
pnpm start        # 執行 dist/index.js
```

## 環境變數

請參考根目錄 `.env.example`。Docker 容器會自動載入 `docker/.env`。

## API 端點

| Method | Path             | 說明          |
| ------ | ---------------- | ------------- |
| GET    | `/health`        | 健康檢查      |
| GET    | `/api/v1/ping`   | 連線測試      |

更多端點將在後續 milestone 加入。

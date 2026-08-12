# API 規格（草案）

> M1 階段只實作了 `/health` 與 `/api/v1/ping`。下面列出預計在 M2~M3 會陸續加入的端點，供前端開發時對齊。

## 通用約定

- Base URL（容器內）：`http://api:4000`
- Base URL（host 直接開發）：`http://localhost:4000`
- 所有回應皆為 JSON
- 錯誤格式：
  ```json
  { "error": "NotFoundError", "message": "..." }
  ```
- 時區：所有時間欄位皆為 Unix timestamp（秒），顯示端負責轉 `Asia/Taipei`

## 已實作（M1）

### `GET /health`
健康檢查，給 Docker / K8s liveness probe。

**Response 200**
```json
{ "status": "ok", "uptime": 12.345 }
```

### `GET /api/v1/ping`
連線測試，回傳版本。

**Response 200**
```json
{ "message": "pong", "version": "0.1.0" }
```

---

## 規劃中（M2 起）

### `GET /api/v1/symbol/:ticker/:market`
個股完整分析（quote + fundamentals + analyst + prediction）。

**Params**
- `ticker` — 股票代號（不含市場後綴）
- `market` — `US` | `HK`

**Response 200**
```json
{
  "quote": { "price": 182.45, "changePct": 0.0123, "asOf": 1755000000 },
  "fundamentals": { "peRatio": 28.4, "pbRatio": 45.2, "dividendYield": 0.005 },
  "analystTargets": { "low": 160, "mean": 195, "high": 220, "ratings": { "buy": 24, "hold": 8, "sell": 2 } },
  "prediction": { "fairValue": 195, "confidence": 0.78, "horizon": "12m", "rationale": "..." }
}
```

### `GET /api/v1/watchlist`
取得自選股清單與最新估值快照。

### `POST /api/v1/watchlist`
加入自選股。

**Body**
```json
{ "ticker": "AAPL", "market": "US" }
```

### `DELETE /api/v1/watchlist/:ticker/:market`
移除自選股。

### `GET /api/v1/settings` / `POST /api/v1/settings`
讀寫使用者設定（LLM base URL / API key / 模型 / 節流參數）。

### `GET /api/v1/health/llm`
測試 LLM 連線（用當前設定打一次小請求，回傳延遲與是否成功）。

---

## 錯誤代碼

| HTTP | error 名稱             | 意義                       |
| ---- | ---------------------- | -------------------------- |
| 400  | `ValidationError`      | 參數驗證失敗（zod）        |
| 404  | `NotFoundError`        | 找不到標的                  |
| 429  | `RateLimitError`       | 被 yfinance / LLM 限流     |
| 502  | `UpstreamError`        | 上游（yfinance / LLM）錯誤 |
| 500  | `InternalError`        | 未預期錯誤                  |

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { stocksApi, watchlistApi } from '@/api/client';
import type { SnapshotResponse } from '@fair-value-radar/shared-types';
import type { Sentiment, StockSnapshot } from '@/types';

interface PortfolioState {
  watchlist: string[];
  snapshots: Record<string, StockSnapshot | null>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** 從 API 抓整份自選股清單 */
  loadWatchlist: () => Promise<void>;
  /** 新增到後端；成功才更新本地 state */
  addSymbol: (ticker: string) => Promise<void>;
  /** 從後端移除 */
  removeSymbol: (ticker: string) => Promise<void>;
  /** 對每檔 snapshot() 一次，刷新本地 cache */
  refreshAll: () => Promise<void>;
  clearError: () => void;
}

/**
 * 從 quote 推回 StockSnapshot：
 *   price 是必填，其他都是 optional，
 *   sentiment 預設 neutral（等有 fairValue 再算）。
 */
/** 從 /stocks/:sym/snapshot 端點的 Response 物件抽出 quote 部分 */
function snapshotResponseToSnapshot(data: SnapshotResponse): StockSnapshot {
  const q = data.quote;
  const snap: StockSnapshot = {
    symbol: q.symbol.ticker,
    name: undefined,
    price: q.price,
    change: q.change,
    changePct: q.changePct,
    fairValue: undefined,
    deviationPct: undefined,
    sentiment: 'neutral',
  };
  // analystTargets?.mean 可以當 fairValue（如果沒單獨跑 LLM 公允價值）
  const targets = data.analystTargets as { mean?: number; low?: number; high?: number } | undefined;
  if (targets?.mean) {
    snap.fairValue = targets.mean;
    if (q.price && targets.low != null && targets.high != null) {
      snap.deviationPct = ((q.price - targets.mean) / targets.mean) * 100;
    }
  }
  return snap;
}

function sentimentFromDeviation(deviationPct: number | undefined): Sentiment {
  if (deviationPct === undefined || Number.isNaN(deviationPct)) return 'neutral';
  if (deviationPct <= -5) return 'bullish';
  if (deviationPct >= 5) return 'bearish';
  return 'neutral';
}

export const usePortfolioStore = create<PortfolioState>()(
  devtools(
    (set, get) => ({
      watchlist: [],
      snapshots: {},
      loading: false,
      refreshing: false,
      error: null,

      loadWatchlist: async () => {
        set({ loading: true, error: null });
        try {
          const list = await watchlistApi.list();
          const cleaned = (list ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean);
          set({
            watchlist: cleaned,
            // 重置 snapshots（之後 refreshAll 會補回來）
            snapshots: Object.fromEntries(cleaned.map((s) => [s, null])),
            loading: false,
          });
        } catch (err: unknown) {
          const e = err as { message?: string };
          set({ loading: false, error: e.message ?? '載入自選股失敗' });
        }
      },

      addSymbol: async (ticker: string) => {
        const cleaned = ticker.trim().toUpperCase();
        if (!cleaned) {
          set({ error: '請輸入股票代號' });
          return;
        }
        const { watchlist } = get();
        if (watchlist.includes(cleaned)) {
          set({ error: `${cleaned} 已在自選股中` });
          return;
        }

        // 樂觀更新：先放進清單
        const prev = watchlist;
        set({
          watchlist: [...watchlist, cleaned],
          snapshots: { ...get().snapshots, [cleaned]: null },
          error: null,
        });

        try {
          await watchlistApi.add(cleaned);
        } catch (err: unknown) {
          const e = err as { message?: string };
          // rollback
          set({
            watchlist: prev,
            error: e.message ?? `新增 ${cleaned} 失敗`,
          });
        }
      },

      removeSymbol: async (ticker: string) => {
        const cleaned = ticker.trim().toUpperCase();
        const { watchlist, snapshots } = get();
        if (!watchlist.includes(cleaned)) return;

        const prevList = watchlist;
        const prevSnap = snapshots[cleaned];
        const nextSnap = { ...snapshots };
        delete nextSnap[cleaned];
        set({ watchlist: watchlist.filter((s) => s !== cleaned), snapshots: nextSnap });

        try {
          await watchlistApi.remove(cleaned);
        } catch (err: unknown) {
          const e = err as { message?: string };
          // rollback
          set({
            watchlist: prevList,
            snapshots: { ...get().snapshots, [cleaned]: prevSnap ?? null },
            error: e.message ?? `移除 ${cleaned} 失敗`,
          });
        }
      },

      refreshAll: async () => {
        const { watchlist } = get();
        if (watchlist.length === 0) return;
        set({ refreshing: true, error: null });
        try {
          const results = await Promise.allSettled(
            watchlist.map(async (sym) => {
              const data = await stocksApi.snapshot(sym);
              return [sym, data] as const;
            }),
          );

          const next: Record<string, StockSnapshot | null> = { ...get().snapshots };
          const partialErrors: string[] = [];

          for (const r of results) {
            if (r.status === 'fulfilled') {
              const [sym, data] = r.value;
              const snap = snapshotResponseToSnapshot(data);
              next[sym] = snap;
            } else {
              const reason = r.reason as { message?: string };
              partialErrors.push(reason?.message ?? 'fetch failed');
            }
          }

          // 後端若回 fairValue（在 snapshot 內），由後續 page 自己抓；此處只更新 quote
          set({ snapshots: next, refreshing: false });
        } catch (err: unknown) {
          const e = err as { message?: string };
          set({ refreshing: false, error: e.message ?? '刷新失敗' });
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'fvr-portfolio' },
  ),
);

/** utility for components */
export function getDeviation(snap: StockSnapshot | null | undefined): number | undefined {
  if (!snap) return undefined;
  if (snap.deviationPct !== undefined) return snap.deviationPct;
  if (snap.fairValue && snap.fairValue > 0 && snap.price) {
    return ((snap.price - snap.fairValue) / snap.fairValue) * 100;
  }
  return undefined;
}

export function deriveSentiment(snap: StockSnapshot | null | undefined): Sentiment {
  return sentimentFromDeviation(getDeviation(snap));
}
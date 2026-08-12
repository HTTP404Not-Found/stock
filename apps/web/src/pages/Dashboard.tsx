import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCcw, Settings as SettingsIcon, Satellite, X } from 'lucide-react';
import StockCard from '@/components/StockCard';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import ThemeToggle from '@/components/ThemeToggle';
import {
  usePortfolioStore,
  deriveSentiment,
  getDeviation,
} from '@/stores/portfolio';
import type { Sentiment } from '@/types';

function StockCardSkeleton() {
  return (
    <div className="rounded-2xl border border-app bg-elev p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-5 w-16 animate-pulse rounded bg-app" />
          <div className="h-3 w-24 animate-pulse rounded bg-app" />
        </div>
        <div className="h-5 w-12 animate-pulse rounded-full bg-app" />
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-7 w-28 animate-pulse rounded bg-app" />
        <div className="h-4 w-20 animate-pulse rounded bg-app" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <div className="h-12 animate-pulse rounded-lg bg-app/60" />
        <div className="h-12 animate-pulse rounded-lg bg-app/60" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const watchlist = usePortfolioStore((s) => s.watchlist);
  const snapshots = usePortfolioStore((s) => s.snapshots);
  const loading = usePortfolioStore((s) => s.loading);
  const refreshing = usePortfolioStore((s) => s.refreshing);
  const error = usePortfolioStore((s) => s.error);
  const loadWatchlist = usePortfolioStore((s) => s.loadWatchlist);
  const refreshAll = usePortfolioStore((s) => s.refreshAll);
  const addSymbol = usePortfolioStore((s) => s.addSymbol);
  const removeSymbol = usePortfolioStore((s) => s.removeSymbol);
  const clearError = usePortfolioStore((s) => s.clearError);

  const [showAddForm, setShowAddForm] = useState(false);
  const [draftTicker, setDraftTicker] = useState('');

  // 開頁時：先抓清單 → 抓每檔 snapshot
  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    if (watchlist.length > 0) {
      void refreshAll();
    }
    // 只在 watchlist 變化時重新 refresh（避免 render loop）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.length]);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = draftTicker.trim();
    if (!v) return;
    try {
      await addSymbol(v);
      setDraftTicker('');
      setShowAddForm(false);
    } catch {
      // store 內已設 error，這裡關掉即可
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-3 border-b border-app pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Satellite className="h-7 w-7 text-sky-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fair Value Radar</h1>
            <p className="text-sm text-fg-muted">港美股公允價值雷達 · 自動估值追蹤</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-app bg-elev px-3 py-2 text-sm hover:border-sky-500/40"
          >
            <SettingsIcon className="h-4 w-4" />
            <span>設定</span>
          </Link>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={refreshing || watchlist.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app bg-elev px-3 py-2 text-sm hover:border-sky-500/40 disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? '刷新中…' : '刷新'}</span>
          </button>
        </div>
      </header>

      {/* ---------- Error banner ---------- */}
      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} onDismiss={clearError} />
        </div>
      )}

      {/* ---------- Section title ---------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">我的自選股</h2>
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" />
              <span>新增</span>
            </button>
          ) : (
            <form
              onSubmit={(e) => void handleAdd(e)}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                type="text"
                value={draftTicker}
                onChange={(e) => setDraftTicker(e.target.value)}
                placeholder="例如 AAPL、0700.HK"
                className="w-40 rounded-lg border border-app bg-elev px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="submit"
                disabled={!draftTicker.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                <span>加入</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setDraftTicker('');
                }}
                className="rounded-lg border border-app bg-elev p-2 text-fg-muted hover:text-fg"
                aria-label="取消"
              >
                <X className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {/* ---------- Card grid ---------- */}
        {loading && watchlist.length === 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StockCardSkeleton />
            <StockCardSkeleton />
            <StockCardSkeleton />
          </div>
        ) : watchlist.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="尚未加入任何自選股"
            description="點「新增」開始追蹤美股 / 港股的公允價值走勢"
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((sym) => {
              const snap = snapshots[sym];
              const sentiment: Sentiment = deriveSentiment(snap);
              const deviation = getDeviation(snap);

              return (
                <div key={sym} className="relative group">
                  {snap ? (
                    <StockCard
                      symbol={snap.symbol}
                      name={snap.name}
                      price={snap.price}
                      change={snap.change ?? 0}
                      changePct={snap.changePct ?? 0}
                      fairValue={snap.fairValue ?? 0}
                      deviationPct={deviation ?? 0}
                      sentiment={sentiment}
                    />
                  ) : (
                    <StockCardSkeleton />
                  )}
                  <button
                    type="button"
                    onClick={() => void removeSymbol(sym)}
                    className="absolute right-2 top-2 rounded-md bg-elev/80 px-1.5 py-0.5 text-xs text-fg-muted opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                    aria-label={`移除 ${sym}`}
                  >
                    ✕
                  </button>
                  {snap === null && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-app/40 text-xs text-fg-muted backdrop-blur-sm">
                      <Spinner label="載入報價…" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-right">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300"
          >
            設定資料源與排程 <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ---------- Footer hint ---------- */}
      <footer className="mt-12 border-t border-app pt-4 text-xs text-fg-muted">
        ※ 報價 / 公允價值由後端聚合，計算結果僅供研究參考，不構成投資建議。
      </footer>
    </main>
  );
}
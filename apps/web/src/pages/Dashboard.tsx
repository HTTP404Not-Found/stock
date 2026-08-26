import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCcw, Settings as SettingsIcon, Satellite, X } from 'lucide-react';
import StockCard from '@/components/StockCard';

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
    const v = draftTicker.trim().toUpperCase();
    if (!v) return;
    // 簡單格式驗證：只允許英文字母、數字、點、連字號（Yahoo Finance ticker 規則）
    if (!/^[A-Z0-9.\-]{1,15}$/.test(v)) {
      alert(`代碼格式無效：${v}（請用英文字母、數字、點或連字號，例如 AAPL 或 0700.HK）`);
      return;
    }
    try {
      // 自動補 0：3-5 位數港股代碼 → 自動補成 5 位 + .HK（用戶輸入 9660 → 09660.HK）
      let normalized = v;
      if (/^\d{3,5}$/.test(v)) {
        normalized = v.padStart(5, '0') + '.HK';
      }
      await addSymbol(normalized);
      setDraftTicker('');
      setShowAddForm(false);
    } catch {
      // store 內已設 error，這裡關掉即可
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:px-8">
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
              <span className="hidden sm:inline">新增</span>
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
                  {snap && Number.isFinite(snap.price) && snap.price > 0 ? (
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
                  ) : refreshing && !snap ? (
                    <StockCardSkeleton />
                  ) : (
                    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-center text-sm text-rose-300">
                      <span className="font-medium">⚠️ {sym} 抓不到資料</span>
                      <span className="text-xs text-fg-muted">代碼可能不存在（9660.HK 應為 09660.HK），按 ✕ 移除</span>
                    </div>
                  )}
                  {/* 永久顯示的刪除按鈕：mobile 必看、desktop 會更亮 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`從自選股移除「${sym}」？`)) void removeSymbol(sym);
                    }}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-500/30 bg-elev/80 text-xs text-rose-400 shadow-sm transition-colors hover:bg-rose-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`移除 ${sym}`}
                    title="移除"
                  >
                    ✕
                  </button>
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

      {/* 手機版浮動新增按鈕（FAB） */}
      {!showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          aria-label="新增自選股"
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30 hover:bg-sky-400 sm:hidden"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* ---------- Footer hint ---------- */}
      <footer className="mt-12 border-t border-app pt-4 text-xs text-fg-muted">
        ※ 報價 / 公允價值由後端聚合，計算結果僅供研究參考，不構成投資建議。
      </footer>
    </main>
  );
}

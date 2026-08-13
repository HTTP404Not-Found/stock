import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, Calculator, LineChart,
  MessageSquareMore, Newspaper,
} from 'lucide-react';
import Tabs, { type TabItem } from '@/components/Tabs';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import ChatPanel from '@/components/ChatPanel';
import PriceForecastChart from '@/components/PriceForecastChart';
import MacdChart from '@/components/MacdChart';
import { stocksApi, analysisApi } from '@/api/client';
import type { Fundamentals, AnalystTargets, FairValueResult, PredictionResult, Quote } from '@/types';

type TabId = 'overview' | 'fundamentals' | 'fairvalue' | 'forecast' | 'llm';

const TABS: TabItem[] = [
  { id: 'overview', label: '總覽', icon: <LineChart className="h-4 w-4" /> },
  { id: 'fundamentals', label: '基本面', icon: <Building2 className="h-4 w-4" /> },
  { id: 'fairvalue', label: '公允價值', icon: <Calculator className="h-4 w-4" /> },
  { id: 'forecast', label: '走勢預測', icon: <LineChart className="h-4 w-4" /> },
  { id: 'llm', label: 'LLM 問股', icon: <MessageSquareMore className="h-4 w-4" /> },
];

export default function StockDetail() {
  const { symbol = '' } = useParams<{ symbol: string }>();
  const [activeId, setActiveId] = useState<TabId>('overview');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [targets, setTargets] = useState<AnalystTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      stocksApi.quote(symbol),
      stocksApi.fundamentals(symbol),
      stocksApi.analystTargets(symbol),
    ])
      .then(([q, f, t]) => {
        if (cancelled) return;
        if (q.status === 'fulfilled') setQuote(q.value);
        if (f.status === 'fulfilled') setFundamentals(f.value);
        if (t.status === 'fulfilled') setTargets(t.value);
        const allFailed = [q, f, t].every((p) => p.status === 'rejected');
        if (allFailed) setError('無法取得股票資料，請確認代碼是否正確');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" />返回自選股
      </Link>

      <header className="mt-3 flex flex-col gap-3 border-b border-app pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-xl font-bold tracking-tight sm:text-2xl">
            <span>{symbol || '—'}</span>
            {quote && (
              <span className="text-base font-normal text-fg-muted sm:text-lg">
                {quote.currency === 'HKD' ? 'HK$' : '$'}{quote.price.toFixed(2)}
                {quote.changePct != null && (
                  <span className={quote.changePct >= 0 ? 'ml-2 text-emerald-400' : 'ml-2 text-rose-400'}>
                    {quote.changePct >= 0 ? '▲' : '▼'} {(quote.changePct * 100).toFixed(2)}%
                  </span>
                )}
              </span>
            )}
          </h1>
          <p className="text-xs text-fg-muted sm:text-sm">即時行情 / 公允價值 / 風險指標</p>
        </div>
        <div className="hidden items-center gap-2 text-xs text-fg-muted sm:flex">
          <Newspaper className="h-4 w-4" /><span>資料來源：yfinance</span>
        </div>
      </header>

      {error && <div className="mt-4"><ErrorBanner message={error} onDismiss={() => setError(null)} /></div>}

      <section className="mt-6">
        <Tabs items={TABS} activeId={activeId} onChange={(id) => setActiveId(id as TabId)} />

        <div className="rounded-b-xl border border-t-0 border-app bg-elev/30 p-3 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <>
              {activeId === 'overview' && <OverviewTab quote={quote} symbol={symbol} targets={targets} />}
              {activeId === 'fundamentals' && <FundamentalsTab fundamentals={fundamentals} />}
              {activeId === 'fairvalue' && <FairValueTab symbol={symbol} />}
              
              {activeId === 'forecast' && <ForecastTab symbol={symbol} />}
              {activeId === 'llm' && <ChatPanel symbol={symbol} />}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

// ===== 各 Tab 子元件 =====

function OverviewTab({ quote, symbol, targets }: { quote: Quote | null; symbol: string; targets: AnalystTargets | null }) {
  if (!quote) return <EmptyState title="尚無報價" description="無法取得當前行情。" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="現價" value={quote.price.toFixed(2)} suffix={quote.currency === 'HKD' ? 'HKD' : 'USD'} />
        <Metric label="漲跌" value={(quote.change ?? 0).toFixed(2)} tone={quote.change != null && quote.change >= 0 ? 'up' : 'down'} />
        <Metric label="漲跌%" value={quote.changePct != null ? `${(quote.changePct * 100).toFixed(2)}%` : '—'} tone={quote.changePct != null && quote.changePct >= 0 ? 'up' : 'down'} />
        <Metric label="報價時間" value={new Date(quote.asOf).toLocaleString('zh-TW')} />
      </div>

      {targets && (
        <div className="rounded-xl border border-app bg-elev/20 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">分析師目標價</h3>
            
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <Metric label="低點" value={(targets.low ?? 0).toFixed(2)} tone="down" />
            <Metric label="平均" value={(targets.mean ?? 0).toFixed(2)} />
            <Metric label="中位" value={targets.median?.toFixed(2) ?? '—'} />
            <Metric label="高點" value={(targets.high ?? 0).toFixed(2)} tone="up" />
          </div>
          {targets.ratings && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="text-emerald-400">買入 {targets.ratings.buy}</span>
              <span className="text-amber-400">持有 {targets.ratings.hold}</span>
              <span className="text-rose-400">賣出 {targets.ratings.sell}</span>
            </div>
          )}
        </div>
      )}

      <PriceForecastChart symbol={symbol} historyPeriod="1y" />
      <MacdChart symbol={symbol} period="6mo" />
    </div>
  );
}

function FundamentalsTab({ fundamentals }: { fundamentals: Fundamentals | null }) {
  if (!fundamentals) return <EmptyState title="尚無基本面" description="無法取得財報數據。" />;
  // 額外欄位：毛利率 / 淨利率 / ROE / 市場預期（從 LLM 計算出來後會補上）
  const f = fundamentals as Fundamentals & {
    grossMargin?: number;
    netMargin?: number;
    roe?: number;
    epsEstimate?: number;    // 市場預期 EPS（分析師共識）
    revenueEstimate?: number; // 市場預期營收
  };
  const items: Array<[string, string]> = [
    ['市值', num(f.marketCap)],
    ['本益比 PE', num(f.peRatio)],
    ['股價淨值比 PB', num(f.pbRatio)],
    ['EPS (TTM)', num(f.eps)],
    ['市場預期 EPS', num(f.epsEstimate)],
    ['每股淨值', num(f.bookValue)],
    ['營收 (TTM)', num(f.revenue)],
    ['市場預期營收', num(f.revenueEstimate)],
    ['毛利率', f.grossMargin != null ? `${(f.grossMargin * 100).toFixed(1)}%` : '—'],
    ['淨利率', f.netMargin != null ? `${(f.netMargin * 100).toFixed(1)}%` : '—'],
    ['ROE 股東權益報酬', f.roe != null ? `${(f.roe * 100).toFixed(1)}%` : '—'],
    ['股息殖利率', num(f.dividendYield)],
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
        💡 毛利率 / 淨利率 / ROE 與市場預期欄位需後端 LLM 計算後補上；目前 yfinance 僅回傳基本欄位。
      </div>
      <table className="w-full text-sm">
        <tbody>
          {items.map(([k, v]) => (
            <tr key={k} className="border-b border-app/50">
              <td className="py-2 text-fg-muted">{k}</td>
              <td className="py-2 text-right font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FairValueTab({ symbol }: { symbol: string }) {
  const [data, setData] = useState<FairValueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFairValue = async () => {
    setLoading(true); setError(null);
    try {
      const result = await analysisApi.fairValue(symbol);
      setData(result as FairValueResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知錯誤');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={fetchFairValue} disabled={loading} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50">
          {loading ? '計算中…' : '🔮 計算公允價值'}
        </button>
        {data?.model && <span className="text-xs text-fg-muted">model: {data.model}</span>}
      </div>
      {error && <ErrorBanner message={error} />}
      {data && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="下緣" value={data.low.toFixed(2)} tone="down" />
            <Metric label="中位" value={data.mean.toFixed(2)} />
            <Metric label="上緣" value={data.high.toFixed(2)} tone="up" />
          </div>
          <Metric label="信心度" value={`${(data.confidence * 100).toFixed(0)}%`} />
          <p className="rounded-lg border border-app bg-elev p-3 text-sm">{data.rationale}</p>
        </div>
      )}
    </div>
  );
}

function ForecastTab({ symbol }: { symbol: string }) {
  const [horizon, setHorizon] = useState<'1w' | '1m' | '3m' | '12m'>('1m');
  const [data, setData] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async (h: '1w' | '1m' | '3m' | '12m') => {
    setHorizon(h); setLoading(true); setError(null); setData(null);
    try {
      const r = await analysisApi.predict(symbol, h);
      setData(r as unknown as PredictionResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知錯誤');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['1w', '1m', '3m', '12m'] as const).map((h) => (
          <button key={h} onClick={() => fetch(h)} disabled={loading} className={`rounded-lg border px-3 py-2 text-sm ${horizon === h ? 'border-sky-500 bg-sky-500/20 text-sky-300' : 'border-app text-fg-muted hover:text-fg'}`}>
            {h === '1w' ? '一週' : h === '1m' ? '一個月' : h === '3m' ? '三個月' : '一年'}
          </button>
        ))}
      </div>
      {loading && <Spinner />}
      {error && <ErrorBanner message={error} />}
      {data && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${data.sentiment === 'bullish' ? 'bg-emerald-500/20 text-emerald-400' : data.sentiment === 'bearish' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {data.sentiment === 'bullish' ? '看好' : data.sentiment === 'bearish' ? '看淡' : '中性'}
            </span>
            <span className="text-sm text-fg-muted">信心度 {(data.confidence * 100).toFixed(0)}%</span>
            <span className="text-sm">目標價 {data.fairValue.toFixed(2)}</span>
          </div>
          <p className="rounded-lg border border-app bg-elev p-3 text-sm">{data.rationale}</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone?: 'up' | 'down' }) {
  const toneClass = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : '';
  return (
    <div className="rounded-lg border border-app bg-elev p-3">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg ${toneClass}`}>{value}{suffix && <span className="ml-1 text-xs text-fg-muted">{suffix}</span>}</div>
    </div>
  );
}

function num(v: number | undefined | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
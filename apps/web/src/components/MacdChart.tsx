import { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Activity } from 'lucide-react';
import { stocksApi } from '@/api/client';
import Spinner from '@/components/Spinner';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { formatNumber } from '@/lib/utils';

interface Props {
  symbol: string;
  /** 取多久的歷史（預設 6 個月，MACD 需要 ~26 + 9 天資料） */
  period?: '3mo' | '6mo' | '1y';
}

interface MacdRow {
  date: string;
  close: number | null;
  ema12: number | null;
  ema26: number | null;
  dif: number | null;
  dem: number | null;
  osc: number | null;
}

/**
 * 計算指數移動平均 (EMA)
 * seed: 第一個值用首日收盤價，後續用 close
 */
function calcEma(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  // 第一個 EMA = 首日收盤價
  ema[0] = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * 取得最新的 MACD 訊號
 */
function getMacdSignal(latest: MacdRow): {
  signal: 'bullish' | 'bearish' | 'neutral';
  label: string;
  description: string;
} {
  if (latest.dif == null || latest.dem == null || latest.osc == null) {
    return { signal: 'neutral', label: '—', description: 'MACD 資料不足' };
  }
  const isGolden = latest.dif > latest.dem && latest.osc > 0;
  const isDeath = latest.dif < latest.dem && latest.osc < 0;
  // 用振幅決定強弱（osc 絕對值 / close）
  const amplitude = latest.close ? Math.abs(latest.osc) / latest.close : 0;
  const strength = amplitude > 0.03 ? '強' : amplitude > 0.01 ? '中' : '弱';

  if (isGolden && latest.osc > 0) {
    return {
      signal: 'bullish',
      label: `${strength}黃金交叉`,
      description: `DIF (${formatNumber(latest.dif, 4)}) 高於 DEM (${formatNumber(latest.dem, 4)})，柱狀圖為正（${formatNumber(latest.osc, 4)}），多頭訊號。`,
    };
  }
  if (isDeath && latest.osc < 0) {
    return {
      signal: 'bearish',
      label: `${strength}死亡交叉`,
      description: `DIF (${formatNumber(latest.dif, 4)}) 低於 DEM (${formatNumber(latest.dem, 4)})，柱狀圖為負（${formatNumber(latest.osc, 4)}），空頭訊號。`,
    };
  }
  return {
    signal: 'neutral',
    label: '盤整',
    description: `DIF=${formatNumber(latest.dif, 4)}, DEM=${formatNumber(latest.dem, 4)}，無明顯趨勢。`,
  };
}

/**
 * MACD 技術指標圖
 *  - 上半：收盤價 + EMA12 + EMA26 三條線
 *  - 下半：柱狀圖（DIF − DEM）× 2 + DEM 線
 *  - 右下：當前訊號（黃金交叉 / 死亡交叉 / 盤整）
 */
export default function MacdChart({ symbol, period = '6mo' }: Props) {
  const [closes, setCloses] = useState<number[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      stocksApi.history(symbol, period),
      stocksApi.quote(symbol),
    ])
      .then(([h, q]) => {
        if (cancelled) return;
        if (h.status === 'fulfilled') {
          const ts = h.value.filter((d) => Number.isFinite(d.close));
          setCloses(ts.map((d) => d.close));
          setDates(ts.map((d) => new Date(d.t * 1000).toISOString().slice(2, 10)));
        } else {
          setError('無法取得歷史價格');
        }
        if (q.status === 'fulfilled') setCurrentPrice(q.value.price);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '未知錯誤'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, period]);

  const { chartData, signal } = useMemo(() => {
    if (closes.length < 30) return { chartData: [] as MacdRow[], signal: null };
    const ema12 = calcEma(closes, 12);
    const ema26 = calcEma(closes, 26);
    // DIF 從第 26 個開始有值（EMA26 seed 後需要 26 天）
    // DEM 是 DIF 的 EMA(9)，從第 26+9 = 35 個開始有值
    const dif = closes.map((_, i) => ema12[i] - ema26[i]);
    const demFull = calcEma(dif.slice(25).filter((v) => Number.isFinite(v)), 9);
    const dem: (number | null)[] = new Array(closes.length).fill(null);
    for (let i = 25; i < closes.length; i++) {
      dem[i] = demFull[i - 25];
    }
    const rows: MacdRow[] = closes.map((close, i) => {
      const osc = dif[i] != null && dem[i] != null ? (dif[i] - (dem[i] as number)) * 2 : null;
      return {
        date: dates[i] ?? '',
        close,
        ema12: ema12[i] ?? null,
        ema26: ema26[i] ?? null,
        dif: dif[i] ?? null,
        dem: dem[i],
        osc,
      };
    });
    // 只取 DIF/DEM 都有值之後的資料（避免前段全 null）
    const usable = rows.filter((r) => r.dif != null && r.dem != null);
    const latest = usable[usable.length - 1];
    return {
      chartData: usable,
      signal: latest ? getMacdSignal(latest) : null,
    };
  }, [closes, dates]);

  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} />;
  if (chartData.length === 0 || !signal) {
    return <EmptyState title="歷史資料不足" description="MACD 需要至少 35 天收盤價才能計算。" icon={<Activity className="h-8 w-8" />} />;
  }

  const sigColor = signal.signal === 'bullish' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    : signal.signal === 'bearish' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
    : 'border-app bg-elev/40 text-fg-muted';

  return (
    <div className="rounded-xl border border-app bg-elev/20 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">MACD 技術指標</h3>
        <span className="text-xs text-fg-muted">DIF / DEM / OSC（基於日收盤價）</span>
      </header>

      {/* 上半：價格 + EMA12 + EMA26 */}
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-fg-muted)' }} interval="preserveStartEnd" tickFormatter={(v) => (typeof v === 'string' ? v.slice(3) : v)} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--color-fg-muted)' }} domain={['auto', 'auto']} width={45} tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(0) : String(v))} />
            <Tooltip
              contentStyle={{ background: 'var(--color-bg-elev)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'var(--color-fg-muted)' }}
              formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))}
            />
            <Line type="monotone" dataKey="close" stroke="#94a3b8" strokeWidth={1} dot={false} name="收盤" />
            <Line type="monotone" dataKey="ema12" stroke="#38bdf8" strokeWidth={1.2} dot={false} name="EMA12" />
            <Line type="monotone" dataKey="ema26" stroke="#f59e0b" strokeWidth={1.2} dot={false} name="EMA26" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 下半：OSC 柱狀圖 + DEM 線 */}
      <div className="mt-2 h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-fg-muted)' }} interval="preserveStartEnd" tickFormatter={(v) => (typeof v === 'string' ? v.slice(3) : v)} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--color-fg-muted)' }} width={45} tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} />
            <Tooltip
              contentStyle={{ background: 'var(--color-bg-elev)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'var(--color-fg-muted)' }}
              formatter={(v) => (typeof v === 'number' ? v.toFixed(4) : String(v ?? ''))}
            />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
            {/* OSC 柱狀圖：DIF - DEM × 2（正綠、負紅） */}
            <Bar
              dataKey="osc"
              // recharts 用 Cell 來個別上色
              // 簡化版：整體用綠紅漸層
              fill="#10b981"
              isAnimationActive={false}
            />
            <Line type="monotone" dataKey="dif" stroke="#38bdf8" strokeWidth={1.2} dot={false} name="DIF" />
            <Line type="monotone" dataKey="dem" stroke="#f59e0b" strokeWidth={1.2} dot={false} name="DEM" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 訊號 */}
      <div className={`mt-3 rounded-lg border p-3 ${sigColor}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{signal.label}</span>
          {currentPrice != null && (
            <span className="text-xs text-fg-muted">現價 {formatNumber(currentPrice)}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-fg-muted">{signal.description}</p>
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        ※ MACD = EMA12 − EMA26（黃金交叉 = 買進訊號 / 死亡交叉 = 賣出訊號），僅供技術研究參考
      </p>
    </div>
  );
}
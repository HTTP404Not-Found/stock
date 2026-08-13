import { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { stocksApi } from '@/api/client';
import Spinner from '@/components/Spinner';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { formatNumber } from '@/lib/utils';

interface Props {
  symbol: string;
  historyPeriod?: '6mo' | '1y' | '2y';
  forecastDays?: number;
}

interface ChartRow {
  date: string;
  t: number;
  past: number | null;
  future: number | null;
  upper: number | null;
  lower: number | null;
  avg: number | null;
}

/**
 * 目標價預測圖：
 *  - 左半：藍色實線 = 過去真實收盤價
 *  - 右半：綠/紅 band = 未來最高~最低區間、灰色虛線 = 平均預測
 *  - 中央：現價圓點
 *
 * 預測模型：歷史波動率（σ）±1.5σ 線性外推 + 過去 30 日線性趨勢
 */
export default function PriceForecastChart({
  symbol,
  historyPeriod = '1y',
  forecastDays = 365,
}: Props) {
  const [history, setHistory] = useState<{ t: number; close: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      stocksApi.history(symbol, historyPeriod),
      stocksApi.quote(symbol),
    ])
      .then(([h, q]) => {
        if (cancelled) return;
        if (h.status === 'fulfilled') {
          setHistory(
            h.value
              .map((d) => ({ t: d.t, close: d.close }))
              .filter((d) => Number.isFinite(d.close))
          );
        } else {
          setError('無法取得歷史價格');
        }
        if (q.status === 'fulfilled') setCurrentPrice(q.value.price);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '未知錯誤'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, historyPeriod]);

  const { chartData, optimistic, pessimistic, average } = useMemo(() => {
    if (history.length < 30) return { chartData: [] as ChartRow[], optimistic: 0, pessimistic: 0, average: 0, bandMedian: 0, };
    const closes = history.map((d) => d.close).filter((v) => Number.isFinite(v) && v > 0);
    if (closes.length < 30) return { chartData: [] as ChartRow[], optimistic: 0, pessimistic: 0, average: 0, bandMedian: 0, };

    // 1. 日對數收益率 ln(S_t / S_{t-1})
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const r = Math.log(closes[i] / closes[i - 1]);
      if (Number.isFinite(r)) logReturns.push(r);
    }
    const last = closes[closes.length - 1];
    if (logReturns.length < 20) return { chartData: [] as ChartRow[], optimistic: 0, pessimistic: 0, average: 0, bandMedian: 0, };

    // 2. μ（年化漂移）與 σ（年化波動率）
    const meanR = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const varR = logReturns.reduce((a, b) => a + (b - meanR) ** 2, 0) / (logReturns.length - 1);
    const stdR = Math.sqrt(varR);
    const muAnnual = meanR * 252;       // 252 交易日/年
    const sigmaAnnual = stdR * Math.sqrt(252);

    // 3. GBM 蒙地卡羅模擬
    //    每天：S_t+dt = S_t * exp((μ - σ²/2)dt + σ√dt * Z)
    //    取 5000 路徑、12 個取樣點（每年約 1 個）
    const NUM_PATHS = 5000;
    const NUM_POINTS = 12;
    const dt = 1 / 252; // 步進 = 1 交易日
    const totalDays = forecastDays;

    // Box-Muller transform（給標準常態亂數 Z）
    function randn(): number {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
    }

    // 預計算每個取樣點的所有路徑價格
    const daysPerPoint = Math.max(1, Math.floor(totalDays / NUM_POINTS));
    const sampleDays: number[] = [];
    for (let i = 1; i <= NUM_POINTS; i++) sampleDays.push(Math.min(i * daysPerPoint, totalDays));

    // pathPrices[pointIdx][pathIdx] = S at that point
    const pathPrices: number[][] = [];
    for (let p = 0; p < NUM_POINTS; p++) {
      pathPrices.push(new Array(NUM_PATHS).fill(0));
    }

    // 對每條路徑模擬
    for (let path = 0; path < NUM_PATHS; path++) {
      let S = last;
      let day = 0;
      for (let p = 0; p < NUM_POINTS; p++) {
        const targetDay = sampleDays[p];
        // 跑到 targetDay（每天一步）
        while (day < targetDay) {
          const z = randn();
          S = S * Math.exp((muAnnual - sigmaAnnual * sigmaAnnual / 2) * dt + sigmaAnnual * Math.sqrt(dt) * z);
          day++;
        }
        pathPrices[p][path] = S;
      }
    }

    // 4. 對每個取樣點取 5/50/95 百分位
    const percentile = (sorted: number[], p: number): number => {
      const idx = Math.floor((sorted.length - 1) * p);
      return sorted[idx];
    };
    const sampleStats: { day: number; upper: number; avg: number; lower: number }[] = [];
    for (let p = 0; p < NUM_POINTS; p++) {
      const sortedPrices = [...pathPrices[p]].sort((a, b) => a - b);
      sampleStats.push({
        day: sampleDays[p],
        upper: percentile(sortedPrices, 0.95),
        avg: percentile(sortedPrices, 0.50),
        lower: percentile(sortedPrices, 0.05),
      });
    }

    // 5. 左半：歷史
    const past: ChartRow[] = history.map((d) => ({
      date: new Date(d.t * 1000).toISOString().slice(2, 10),
      t: d.t,
      past: d.close,
      future: null,
      upper: null,
      lower: null,
      avg: null,
    }));

    // 6. 右半：GBM 預測（平滑曲線）
    const lastMs = history[history.length - 1].t * 1000;
    const future: ChartRow[] = sampleStats.map((s) => {
      const t = lastMs + s.day * 86400 * 1000;
      return {
        date: new Date(t).toISOString().slice(2, 10),
        t: t / 1000,
        past: null,
        future: s.avg,
        upper: s.upper,
        lower: s.lower,
        avg: s.avg,
      };
    });

    const lastSample = sampleStats[sampleStats.length - 1];
    return {
      chartData: [...past, ...future] as ChartRow[],
      optimistic: lastSample.upper,
      pessimistic: lastSample.lower,
      average: lastSample.avg,
    };
  }, [history, forecastDays]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }
  if (error) return <ErrorBanner message={error} />;
  if (chartData.length === 0 || currentPrice == null) {
    return (
      <EmptyState
        title="歷史資料不足"
        description="這檔股票歷史太短，無法繪製預測圖。"
        icon={<TrendingUp className="h-8 w-8" />}
      />
    );
  }

  let lastRow: ChartRow | null = null;
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (chartData[i] && chartData[i]!.past != null) { lastRow = chartData[i]!; break; }
  }

  return (
    <div className="rounded-xl border border-app bg-elev/20 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold">目標價預測</h3>
          <span className="text-xs text-fg-muted">更新：{new Date().toLocaleDateString('zh-TW')}</span>
        </div>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bullBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="bearBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.25} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
              interval="equidistantPreserveStart"
              minTickGap={32}
              tickFormatter={(v) => (typeof v === 'string' ? v.slice(2) : String(v))}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
              domain={['auto', 'auto']}
              width={50}
              tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(0) : String(v))}
            />

            <Tooltip
              contentStyle={{ background: 'var(--color-bg-elev)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--color-fg-muted)' }}
              formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))}
            />

            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#bullBand)" isAnimationActive={false} />
            <Area type="monotone" dataKey="lower" stroke="none" fill="url(#bearBand)" isAnimationActive={false} />

            <Line type="monotone" dataKey="past" stroke="#38bdf8" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
            <Line type="monotone" dataKey="future" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />

            {lastRow && (
              <ReferenceDot
                x={lastRow.date}
                y={currentPrice}
                r={5}
                fill="#38bdf8"
                stroke="#fff"
                strokeWidth={2}
                label={{ value: `現價 ${formatNumber(currentPrice)}`, position: 'top', fill: '#38bdf8', fontSize: 12, fontWeight: 600 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <div className="text-xs text-emerald-300">最高</div>
          <div className="font-mono font-semibold text-emerald-300">{formatNumber(optimistic)}</div>
        </div>
        <div className="rounded-lg border border-app bg-elev/60 px-3 py-2">
          <div className="text-xs text-fg-muted">平均</div>
          <div className="font-mono font-semibold">{formatNumber(average)}</div>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <div className="text-xs text-rose-300">最低</div>
          <div className="font-mono font-semibold text-rose-300">{formatNumber(pessimistic)}</div>
        </div>
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        ※ 過去 1 年走勢 / 未來 1 年 GBM 蒙地卡羅預測（5000 路徑 × 12 取樣，5/50/95 百分位 cone of uncertainty，僅供研究參考）
      </p>
    </div>
  );
}
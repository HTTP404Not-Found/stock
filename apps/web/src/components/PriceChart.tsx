import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { stocksApi } from '@/api/client';
import Spinner from '@/components/Spinner';
import ErrorBanner from '@/components/ErrorBanner';
import { formatNumber, formatUnixSeconds } from '@/lib/utils';
import type { OHLC } from '@fair-value-radar/shared-types';

/**
 * 個股歷史價格線圖（recharts LineChart）
 *
 * 用 history 端點拿最近 N 個交易日的收盤價，繪成 sparkline-style 線圖。
 */
interface Props {
  symbol: string;
  period?: string;  // '1mo' | '3mo' | '6mo' | '1y'
}

export default function PriceChart({ symbol, period = '3mo' }: Props) {
  const [data, setData] = useState<OHLC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    stocksApi.history(symbol, period)
      .then((rows) => {
        if (!cancelled) {
          // 防禦：後端可能回 null / 非陣列 → 視為空陣列
          setData(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '無法取得歷史');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, period]);

  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} />;
  if (data.length === 0) return <div className="text-sm text-fg-muted">無歷史資料</div>;

  // 防禦：每筆 row 可能缺欄位，用 fallback 處理
  const chartData = data
    .filter((d) => d && typeof d.close === 'number' && Number.isFinite(d.close))
    .map((d) => ({
      date: formatUnixSeconds(d.t, '—', { month: '2-digit', day: '2-digit' }),
      close: d.close,
    }));

  // 過濾後沒有有效 close 資料
  if (chartData.length === 0) {
    return <div className="text-sm text-fg-muted">歷史資料格式異常</div>;
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }} domain={['auto', 'auto']} width={50} />
          <Tooltip
            contentStyle={{ background: 'var(--color-bg-elev)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--color-fg-muted)' }}
            itemStyle={{ color: 'var(--color-fg)' }}
            // 防禦：recharts 傳進來的值可能是 undefined / null / string
            formatter={(v) => formatNumber(typeof v === 'number' ? v : Number(v), 2, '—')}
          />
          <Line type="monotone" dataKey="close" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

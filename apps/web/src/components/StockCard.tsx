import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Sentiment } from '@/types';

export interface StockCardProps {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePct: number;
  fairValue: number;
  deviationPct: number;
  sentiment: Sentiment;
}

const sentimentLabel: Record<Sentiment, string> = {
  bullish: '看好',
  neutral: '中性',
  bearish: '看淡',
};

const sentimentClass: Record<Sentiment, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  bearish: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

function buildSparkline(symbol: string, length = 24) {
  const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const out: { i: number; v: number }[] = [];
  let v = 100;
  for (let i = 0; i < length; i++) {
    const r = Math.sin((seed + i) * 12.9898) * 43758.5453;
    v += (r - Math.floor(r) - 0.5) * 3;
    out.push({ i, v: +v.toFixed(2) });
  }
  return out;
}

export default function StockCard({
  symbol,
  name,
  price,
  change,
  changePct,
  fairValue,
  deviationPct,
  sentiment,
}: StockCardProps) {
  const sparklineData = useMemo(() => buildSparkline(symbol), [symbol]);

  const isUp = change >= 0;
  const UpDownIcon = isUp ? TrendingUp : TrendingDown;
  const priceColor = isUp ? 'text-up' : 'text-down';
  const lineColor = isUp ? 'var(--color-up)' : 'var(--color-down)';

  return (
    <Link
      to={`/stock/${encodeURIComponent(symbol)}`}
      className={cn(
        'group block rounded-2xl border border-app bg-elev p-5',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-sky-500/40 hover:card-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60',
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">{symbol}</div>
          {name && <div className="text-xs text-fg-muted">{name}</div>}
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-medium',
            sentimentClass[sentiment],
          )}
        >
          {sentimentLabel[sentiment]}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className={cn('text-2xl font-bold tabular-nums', priceColor)}>
            {price.toFixed(2)}
          </div>
          <div className={cn('flex items-center gap-1 text-sm', priceColor)}>
            <UpDownIcon className="h-4 w-4" />
            <span className="tabular-nums">
              {isUp ? '+' : ''}
              {change.toFixed(2)} ({isUp ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="h-12 w-28 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={lineColor}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-app/60 px-3 py-2">
          <div className="text-fg-muted">公允價值</div>
          <div className="font-semibold tabular-nums">{fairValue.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-app/60 px-3 py-2">
          <div className="text-fg-muted">偏離</div>
          <div
            className={cn(
              'font-semibold tabular-nums',
              deviationPct >= 0 ? 'text-up' : 'text-down',
            )}
          >
            {deviationPct >= 0 ? '+' : ''}
            {deviationPct.toFixed(2)}%
          </div>
        </div>
      </div>
    </Link>
  );
}
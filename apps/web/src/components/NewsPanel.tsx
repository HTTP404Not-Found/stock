import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper, Sparkles } from 'lucide-react';
import { newsApi, type NewsSummary } from '@/api/client';
import Spinner from '@/components/Spinner';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/utils';

interface Props {
  symbol: string;
  /** 公司中文名（如「騰訊」、「蘋果」），可選但能顯著提高 SearXNG 中文新聞命中率 */
  companyName?: string;
}

/**
 * 新聞 tab 內容：
 * - 從 SearXNG 抓最新繁中新聞
 * - 若 API 端有 LLM key，會順便回 LLM 繁中解讀
 */
export default function NewsPanel({ symbol, companyName }: Props) {
  const [data, setData] = useState<NewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    newsApi.fetch(symbol, companyName)
      .then((d) => {
        if (!cancelled) {
          // 防禦：後端可能回 null 或非預期結構
          setData(d ?? null);
        }
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '無法取得新聞'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, companyName]);

  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner /></div>;
  if (error) return <ErrorBanner message={error} />;
  if (!data) {
    return <EmptyState title="目前沒有新聞" description="SearXNG 本次未回傳結果，可稍後再試。" icon={<Newspaper className="h-8 w-8" />} />;
  }
  // 防禦：後端可能回非陣列 → 視為空
  const rawItems = Array.isArray(data.raw) ? data.raw : [];
  if (rawItems.length === 0) {
    return <EmptyState title="目前沒有新聞" description="SearXNG 本次未回傳結果，可稍後再試。" icon={<Newspaper className="h-8 w-8" />} />;
  }

  return (
    <div className="space-y-4">
      {/* LLM 解讀 */}
      {data.llmInterpretation && (
        <section className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
          <header className="mb-2 flex items-center gap-2 text-sm font-medium text-sky-300">
            <Sparkles className="h-4 w-4" />
            <span>AI 解讀（{data.interpretationModel ?? 'LLM'}）</span>
          </header>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.llmInterpretation}</p>
        </section>
      )}

      {/* 新聞列表 */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg-muted">
          <Newspaper className="h-4 w-4" />
          最新新聞（{rawItems.length} 則）
        </h3>
        <ol className="space-y-3">
          {rawItems.map((n, i) => (
            <li key={i} className="rounded-lg border border-app bg-elev p-3 transition-colors hover:border-sky-500/40">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-medium text-fg hover:text-sky-400"
              >
                {n.title}
                <ExternalLink className="ml-1 inline h-3 w-3 text-fg-muted" />
              </a>
              {n.snippet && <p className="mt-1 text-xs text-fg-muted line-clamp-2">{n.snippet}</p>}
              <div className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                {n.source && <span className="rounded bg-elev px-1.5 py-0.5">{n.source}</span>}
                {n.publishedAt && <span>{formatDate(n.publishedAt)}</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="text-xs text-fg-muted">
        新聞來源：SearXNG（本機實例），最後更新 {formatDate(data.fetchedAt)}
      </footer>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

const LLM_MODELS = [
  { value: 'MiniMax-M2', label: 'MiniMax-M2（推薦）' },
  { value: 'MiniMax-Text-01', label: 'MiniMax-Text-01' },
  { value: 'GPT-4o-mini', label: 'GPT-4o-mini' },
  { value: 'DeepSeek', label: 'DeepSeek' },
];

const DATA_SOURCES = ['yfinance', 'Longbridge'] as const;
type DataSource = (typeof DATA_SOURCES)[number];

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(LLM_MODELS[0].value);
  const [sourcePriority, setSourcePriority] = useState<DataSource[]>([
    'yfinance',
    'Longbridge',
  ]);
  const [schedule, setSchedule] = useState('08:00');

  const moveSource = (src: DataSource, dir: -1 | 1) => {
    setSourcePriority((prev) => {
      const idx = prev.indexOf(src);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // eslint-disable-next-line no-console
    console.log('[Settings] save', {
      apiKey: apiKey ? '***masked***' : '(empty)',
      model,
      sourcePriority,
      schedule,
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        返回自選股
      </Link>

      <header className="mt-3 border-b border-app pb-4">
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-sm text-fg-muted">
          LLM、資料源與每日排程（本地儲存，M2 將同步至後端）
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* ----- LLM section ----- */}
        <section className="rounded-2xl border border-app bg-elev/40 p-5">
          <h2 className="text-base font-semibold">LLM 模型</h2>
          <p className="mt-1 text-xs text-fg-muted">
            用於 LLM 問股、分析師目標摘要等場景
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-fg-muted">API Key</span>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-•••••••••••••••"
                className="mt-1 block w-full rounded-lg border border-app bg-app px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <label className="block text-sm">
              <span className="text-fg-muted">預設模型</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-app bg-app px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {LLM_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* ----- Data source section ----- */}
        <section className="rounded-2xl border border-app bg-elev/40 p-5">
          <h2 className="text-base font-semibold">資料源優先級</h2>
          <p className="mt-1 text-xs text-fg-muted">
            順位在前者優先；若失敗依序 fallback
          </p>
          <ol className="mt-4 space-y-2">
            {sourcePriority.map((src, idx) => (
              <li
                key={src}
                className="flex items-center justify-between rounded-lg border border-app bg-app px-3 py-2 text-sm"
              >
                <span>
                  <span className="mr-2 text-fg-muted">{idx + 1}.</span>
                  {src}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveSource(src, -1)}
                    disabled={idx === 0}
                    className="rounded px-2 py-1 text-xs hover:bg-elev disabled:opacity-40"
                    aria-label="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSource(src, 1)}
                    disabled={idx === sourcePriority.length - 1}
                    className="rounded px-2 py-1 text-xs hover:bg-elev disabled:opacity-40"
                    aria-label="下移"
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ----- Schedule section ----- */}
        <section className="rounded-2xl border border-app bg-elev/40 p-5">
          <h2 className="text-base font-semibold">每日排程</h2>
          <p className="mt-1 text-xs text-fg-muted">
            每日自動更新自選股的公允估值
          </p>
          <label className="mt-4 block text-sm">
            <span className="text-fg-muted">執行時間（HH:mm）</span>
            <input
              type="time"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="mt-1 block w-40 rounded-lg border border-app bg-app px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            <Save className="h-4 w-4" />
            儲存
          </button>
        </div>
      </form>
    </main>
  );
}
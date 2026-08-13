import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Check } from 'lucide-react';
import ErrorBanner from '@/components/ErrorBanner';
import { settingsApi, type ApiSettings } from '@/api/client';

const LLM_MODELS = [
  { value: 'MiniMax-M2.7', label: 'MiniMax-M2.7（推理，推薦）' },
  { value: 'MiniMax-M2', label: 'MiniMax-M2' },
  { value: 'MiniMax-Text-01', label: 'MiniMax-Text-01' },
  { value: 'GPT-4o-mini', label: 'GPT-4o-mini' },
  { value: 'DeepSeek-V3', label: 'DeepSeek-V3' },
  { value: 'custom', label: '自訂（輸入模型名稱）' },
];

const DEFAULT_FORM: Omit<ApiSettings, 'hasKey' | 'keySource'> = {
  openaiBaseUrl: 'https://api.minimaxi.com/v1',
  openaiApiKey: '',
  openaiModel: 'MiniMax-M2.7',
  searxngUrl: 'http://host.docker.internal:8888',
  schedule: '08:00',
};

export default function Settings() {
  const [s, setS] = useState<Omit<ApiSettings, 'hasKey' | 'keySource'>>(DEFAULT_FORM);
  const [customModel, setCustomModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入後端設定
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await settingsApi.get();
        if (cancelled) return;
        setS({
          openaiBaseUrl: data.openaiBaseUrl || DEFAULT_FORM.openaiBaseUrl,
          openaiApiKey: data.openaiApiKey ?? '', // 後端會回 mask「***」字串
          openaiModel: data.openaiModel || DEFAULT_FORM.openaiModel,
          searxngUrl: data.searxngUrl || DEFAULT_FORM.searxngUrl,
          schedule: data.schedule || DEFAULT_FORM.schedule,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '載入設定失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const finalModel = s.openaiModel === 'custom' ? customModel.trim() : s.openaiModel;
      if (!finalModel) {
        setError('請選擇或輸入模型名稱');
        setSaving(false);
        return;
      }
      const patch: Parameters<typeof settingsApi.patch>[0] = {
        openaiBaseUrl: s.openaiBaseUrl,
        openaiApiKey: s.openaiApiKey, // 後端會判斷是否為 mask
        openaiModel: finalModel,
        searxngUrl: s.searxngUrl,
        schedule: s.schedule,
      };
      const updated = await settingsApi.patch(patch);
      setS((prev) => ({
        ...prev,
        openaiBaseUrl: updated.openaiBaseUrl,
        openaiApiKey: updated.openaiApiKey,
        openaiModel: updated.openaiModel,
        searxngUrl: updated.searxngUrl,
        schedule: updated.schedule,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    try {
      // 先儲存再測試（確保測試的是最新設定）
      const finalModel = s.openaiModel === 'custom' ? customModel.trim() : s.openaiModel;
      await settingsApi.patch({
        openaiBaseUrl: s.openaiBaseUrl,
        openaiApiKey: s.openaiApiKey,
        openaiModel: finalModel,
      });
      const result = await settingsApi.test();
      alert(result.ok
        ? `✅ 連線成功！模型：${result.model ?? 'unknown'}`
        : `❌ 連線失敗：${result.message ?? '未知錯誤'}`);
    } catch (err) {
      alert(`❌ 測試失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  const hasRealKey = s.openaiApiKey && !s.openaiApiKey.startsWith('***');
  const keyStatus = hasRealKey ? 'db' : (s.openaiApiKey.startsWith('***') ? 'env-or-db' : 'none');

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12 text-fg-muted">載入設定…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" />返回自選股
      </Link>

      <header className="mt-3 border-b border-app pb-4">
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-sm text-fg-muted">LLM、資料源與每日排程（儲存在本機 SQLite）</p>
      </header>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} code="generic" onDismiss={() => setError(null)} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* ----- LLM section ----- */}
        <section className="rounded-2xl border border-app bg-elev/40 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">LLM 設定</h2>
              <p className="mt-0.5 text-xs text-fg-muted">用於公允價值、預測、新聞解讀功能</p>
            </div>
            {keyStatus === 'db' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                ✅ 已啟用
              </span>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-200">
            🔒 API Key 只存在本機 SQLite（<code>data/fair-value-radar.db</code>），不會上傳到任何第三方。LLM 請求直接送到你設定的 endpoint。
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-fg-muted">API Endpoint URL</span>
              <input
                type="url"
                spellCheck={false}
                placeholder="https://api.minimaxi.com/v1"
                value={s.openaiBaseUrl}
                onChange={(e) => setS({ ...s, openaiBaseUrl: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-app bg-app px-3 py-2 text-sm font-mono focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <p className="mt-1 text-xs text-fg-muted">OpenAI 兼容 endpoint（MiniMax / OpenRouter / DeepSeek / Ollama 都可）</p>
            </label>

            <label className="block text-sm">
              <span className="text-fg-muted">API Key</span>
              <div className="relative mt-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-..."
                  value={s.openaiApiKey}
                  onChange={(e) => setS({ ...s, openaiApiKey: e.target.value })}
                  className="block w-full rounded-lg border border-app bg-app px-3 py-2 pr-10 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? '隱藏' : '顯示'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:text-fg"
                >
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
              {keyStatus === 'env-or-db' && (
                <p className="mt-1 text-xs text-fg-muted">
                  已有設定（{s.openaiApiKey}）。如要更換請輸入新 key。
                </p>
              )}
            </label>

            <label className="block text-sm">
              <span className="text-fg-muted">模型</span>
              <select
                value={s.openaiModel}
                onChange={(e) => setS({ ...s, openaiModel: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-app bg-app px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {LLM_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {s.openaiModel === 'custom' && (
                <input
                  type="text"
                  placeholder="輸入模型名稱，例如 gpt-4o-2024-08-06"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-app bg-app px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              )}
            </label>
          </div>
        </section>

        {/* ----- SearXNG section ----- */}
        <section className="rounded-2xl border border-app bg-elev/40 p-4 sm:p-5">
          <h2 className="text-base font-semibold">新聞搜尋（SearXNG）</h2>
          <p className="mt-0.5 text-xs text-fg-muted">本機實例 URL，新聞模組從這裡抓</p>
          <label className="mt-3 block text-sm">
            <span className="text-fg-muted">SearXNG URL</span>
            <input
              type="url"
              spellCheck={false}
              placeholder="http://host.docker.internal:8888"
              value={s.searxngUrl}
              onChange={(e) => setS({ ...s, searxngUrl: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-app bg-app px-3 py-2 text-sm font-mono focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="mt-1 text-xs text-fg-muted">Docker 內走 host.docker.internal:8888（本機 SearXNG）</p>
          </label>
        </section>

        {/* ----- Schedule ----- */}
        <section className="rounded-2xl border border-app bg-elev/40 p-4 sm:p-5">
          <h2 className="text-base font-semibold">每日排程</h2>
          <p className="mt-0.5 text-xs text-fg-muted">每日自動更新自選股的公允估值（M2 之後實作）</p>
          <label className="mt-3 block text-sm">
            <span className="text-fg-muted">執行時間（HH:mm）</span>
            <input
              type="time"
              value={s.schedule}
              onChange={(e) => setS({ ...s, schedule: e.target.value })}
              className="mt-1 block w-40 rounded-lg border border-app bg-app px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !hasRealKey}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-app bg-elev px-4 py-2 text-sm font-medium hover:border-sky-500/40 disabled:opacity-40"
          >
            🔗 {testing ? '測試中…' : '測試連線'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-40"
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? '儲存中…' : saved ? '已儲存' : '儲存'}
          </button>
        </div>
      </form>
    </main>
  );
}
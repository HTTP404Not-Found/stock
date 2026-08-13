import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Trash2, MessageSquareMore } from 'lucide-react';
import { chatApi } from '@/api/client';
import type { ChatMessage } from '@/types';
import { cn, formatNumber } from '@/lib/utils';

interface ChatPanelProps {
  symbol: string;
}

const STORAGE_PREFIX = 'fvr-chat-';
const MAX_HISTORY = 50;

const QUICK_QUESTIONS = [
  '這檔可以買嗎？',
  '為什麼看淡？',
  '風險在哪？',
  '最近有什麼消息？',
];

function loadHistory(symbol: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${symbol}`);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (m): m is ChatMessage =>
          typeof m === 'object' &&
          m !== null &&
          'role' in m &&
          'content' in m &&
          typeof (m as { content: unknown }).content === 'string' &&
          ((m as { role: unknown }).role === 'user' ||
            (m as { role: unknown }).role === 'assistant'),
      )
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(symbol: string, history: ChatMessage[]): void {
  try {
    const sliced = history.slice(-MAX_HISTORY);
    localStorage.setItem(`${STORAGE_PREFIX}${symbol}`, JSON.stringify(sliced));
  } catch {
    // ignore quota errors / 隱私模式拒寫
  }
}

interface ToastState {
  model: string;
  totalTokens?: number;
}

export default function ChatPanel({ symbol }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(symbol));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 追蹤每個 toast 的 setTimeout id，確保不殘留且清理乾淨
  const toastTimerRef = useRef<number | null>(null);

  // 切換 symbol 時載入對應的歷史
  useEffect(() => {
    setMessages(loadHistory(symbol));
    setError(null);
  }, [symbol]);

  // 寫回 localStorage
  useEffect(() => {
    saveHistory(symbol, messages);
  }, [symbol, messages]);

  // 自動滾到最底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, sending]);

  // 卸載時清掉 toast 計時器，避免 setState on unmounted component
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const apiHistory = useMemo(
    () => messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || sending) return;
      setError(null);

      const userMsg: ChatMessage = { role: 'user', content: q };
      const optimistic = [...messages, userMsg];
      setMessages(optimistic);
      setDraft('');
      setSending(true);

      try {
        const res = await chatApi.ask(symbol, q, apiHistory);
        // 防禦：res 可能是 null/undefined 或缺欄位
        const answer = (res && typeof res === 'object' && 'answer' in res && typeof res.answer === 'string')
          ? res.answer
          : '（無回應）';
        const modelName = (res && typeof res === 'object' && 'model' in res && typeof res.model === 'string')
          ? res.model
          : 'LLM';
        const tokens = (res && typeof res === 'object' && 'usage' in res && res.usage && typeof res.usage === 'object' && 'totalTokens' in res.usage)
          ? res.usage.totalTokens
          : undefined;
        const assistantMsg: ChatMessage = { role: 'assistant', content: answer };
        setMessages((prev) => [...prev, assistantMsg]);
        setToast({ model: modelName, totalTokens: tokens });
        // 3 秒後自動消 toast，並用 ref 保留 id 以便 cleanup
        if (toastTimerRef.current !== null) {
          window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => {
          setToast(null);
          toastTimerRef.current = null;
        }, 3000);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        const msg = e.response?.data?.message ?? e.message ?? '問股失敗';
        // ✅ 區分 503 訊息（key 沒設）給較清楚的提示
        const e2 = err as { response?: { status?: number } };
        if (e2.response?.status === 503) {
          setError('LLM API key 尚未設定，請到設定頁填寫');
        } else {
          setError(msg);
        }
        // 把 user 訊息留在 history（使用者可重發）
      } finally {
        setSending(false);
      }
    },
    [sending, messages, symbol, apiHistory],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  const handleClear = () => {
    if (!confirm('確定要清除這檔的所有對話紀錄嗎？')) return;
    setMessages([]);
    // 順手清掉 localStorage 對應 key
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${symbol}`);
    } catch {
      // ignore
    }
  };

  // 🟦 v1 沒實作 streaming：這裡留 stub comment 以後接 EventSource / fetch stream
  const supportsStreaming = false; // 若 v2 開 streaming，改成 true 再實作

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-app bg-elev/30 p-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareMore className="h-4 w-4 text-sky-400" />
          LLM 問股
          {toast && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-normal text-sky-300"
              title={toast.totalTokens ? `token 用量 ${toast.totalTokens}` : undefined}
            >
              {toast.model}
              {toast.totalTokens !== undefined && Number.isFinite(toast.totalTokens) && (
                <span className="text-fg-muted">· {formatNumber(toast.totalTokens, 0, '?')} tokens</span>
              )}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-rose-500/15 hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清除對話
          </button>
        )}
      </div>

      {/* message list */}
      <div
        ref={scrollRef}
        className="flex min-h-[260px] flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-app bg-app/40 p-3"
      >
        {messages.length === 0 ? (
          <div className="my-auto text-center text-sm text-fg-muted">
            開始跟 AI 對話，了解 {symbol} 的公允價值與最新動態
          </div>
        ) : (
          messages.map((m, idx) => (
            <MessageBubble key={`${m.role}-${idx}`} message={m} />
          ))
        )}
        {sending && <TypingBubble />}
      </div>

      {/* error */}
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* streaming stub：v1 沒實作，未來要在這裡接 EventSource */}
      {supportsStreaming && false && (
        <div className="hidden" aria-hidden>
          {/* placeholder for v2 streaming UI */}
        </div>
      )}

      {/* quick chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void send(q)}
            disabled={sending}
            className="rounded-full border border-app bg-elev px-3 py-1 text-xs text-fg-muted hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={`問問 AI 關於 ${symbol} 的看法…（Enter 送出、Shift+Enter 換行）`}
          className="flex-1 resize-none rounded-xl border border-app bg-app px-3 py-2 text-sm leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          <span>送出</span>
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'bg-sky-500/90 text-white'
            : 'bg-elev text-fg border border-app',
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="markdown-body prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-app bg-elev px-3 py-2 text-xs text-fg-muted">
        <span className="sr-only">思考中</span>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
        <span className="ml-1">思考中…</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-fg-muted"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

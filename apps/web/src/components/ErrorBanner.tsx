import { AlertCircle, AlertTriangle, Info, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message: string;
  /** 可選：HTTP status code 用於更精準的診斷 */
  status?: number;
  /** 可選：錯誤代碼（如 llm_not_configured、llm_upstream_error） */
  code?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

/** 根據訊息與 status 推測錯誤類型 + 友善建議 */
function diagnose(message: string, status?: number, code?: string): {
  title: string;
  advice: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon: 'alert' | 'warn' | 'info';
  tone: 'rose' | 'amber' | 'sky';
} {
  // 503: LLM 沒設 / 設錯
  if (status === 503 || code === 'llm_not_configured' || /LLM\s*尚未設定|OPENAI_API_KEY/i.test(message)) {
    return {
      title: 'LLM 尚未設定',
      advice: '需要設定 LLM API key 才能使用公允價值、預測、新聞解讀功能。',
      action: { label: '去 Settings 設定', href: '/settings' },
      icon: 'warn',
      tone: 'amber',
    };
  }
  // 502: LLM 上游格式問題
  if (status === 502 || code === 'llm_upstream_error' || /無法解析|reasoning|上游|upstream/i.test(message)) {
    return {
      title: 'LLM 回應格式異常',
      advice: '部分推理型模型（如 MiniMax-M2.7）會在 JSON 前加 reasoning 區塊。已自動處理，但若持續失敗可換成純生成模型（如 GPT-4o-mini）。',
      action: { label: '去 Settings 換模型', href: '/settings' },
      icon: 'warn',
      tone: 'amber',
    };
  }
  // 502: 資料源失敗
  if (status === 502 || /yfinance|quote.*失敗|找不到資料/i.test(message)) {
    return {
      title: '資料源暫時無法回應',
      advice: 'yfinance 可能在處理大量請求或該股票暫時不可用。可稍後重試，或換其他 ticker。',
      icon: 'warn',
      tone: 'amber',
    };
  }
  // 404: 找不到
  if (status === 404 || /找不到|not found|找不到.*資料/i.test(message)) {
    return {
      title: '找不到資料',
      advice: '請確認股票代碼是否正確（美股用 AAPL，港股用 0700.HK，5 位數自動補 0）。',
      icon: 'info',
      tone: 'sky',
    };
  }
  // 400: 輸入錯
  if (status === 400 || /格式無效|無效|invalid/i.test(message)) {
    return {
      title: '輸入格式錯誤',
      advice: message,
      icon: 'alert',
      tone: 'rose',
    };
  }
  // 500 / 其它
  if (status === 500) {
    return {
      title: '伺服器內部錯誤',
      advice: '可能是後端 bug。請複製錯誤訊息並回報給開發者。',
      icon: 'alert',
      tone: 'rose',
    };
  }
  // 預設
  return {
    title: '發生錯誤',
    advice: message,
    icon: 'alert',
    tone: 'rose',
  };
}

const toneStyles = {
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
};

const iconComponents = {
  alert: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};

export default function ErrorBanner({
  message,
  status,
  code,
  onDismiss,
  onRetry,
  className,
}: ErrorBannerProps) {
  const diag = diagnose(message, status, code);
  const Icon = iconComponents[diag.icon];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-sm',
        toneStyles[diag.tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 leading-relaxed">
        <div className="font-medium">{diag.title}</div>
        <div className="mt-0.5 text-xs opacity-90">{diag.advice}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {diag.action && diag.action.href && (
          <Link
            to={diag.action.href}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-white/10"
          >
            {diag.action.label}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded px-2 py-1 text-xs hover:bg-white/10"
          >
            重試
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1 hover:bg-white/10"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
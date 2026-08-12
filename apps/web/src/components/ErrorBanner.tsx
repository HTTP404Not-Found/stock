import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 leading-relaxed">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-rose-300 hover:bg-rose-500/15"
          aria-label="關閉"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
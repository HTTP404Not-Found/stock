import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  label?: string;
  /** 預設 md，可傳 sm / md / lg 切換大小 */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-3 w-3',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
};

/**
 * 通用 spinner，預設搭配文字使用。
 * - 純圖示：<Spinner className="text-rose-500" />
 * - 大小：<Spinner size="lg" />
 * - 整塊置中：<Spinner label="載入中..." />
 */
export default function Spinner({ className, label, size = 'md' }: SpinnerProps) {
  const icon = (
    <Loader2 className={cn(SIZE_MAP[size], 'animate-spin text-sky-400', className)} aria-hidden />
  );

  if (!label) return icon;

  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted" role="status">
      {icon}
      <span>{label}</span>
    </div>
  );
}
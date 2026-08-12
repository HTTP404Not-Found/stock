import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-app p-10 text-center text-fg-muted',
        className,
      )}
    >
      <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-elev text-fg-muted">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="mt-3 text-base font-medium text-fg">{title}</p>
      {description && <p className="mt-1 text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
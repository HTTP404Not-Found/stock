import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ items, activeId, onChange, className }: TabsProps) {
  return (
    <div className={cn('w-full', className)}>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-app bg-elev/40 px-1 py-1 rounded-t-xl sm:flex-wrap sm:overflow-visible sm:px-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:py-2 sm:text-sm',
                isActive
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'text-fg-muted hover:bg-app hover:text-fg',
              )}
            >
              {item.icon && <span className="hidden sm:inline-flex">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
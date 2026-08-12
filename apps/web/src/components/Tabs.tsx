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
        className="flex flex-wrap gap-1 border-b border-app bg-elev/40 px-2 py-1 rounded-t-xl"
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
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'text-fg-muted hover:bg-app hover:text-fg',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
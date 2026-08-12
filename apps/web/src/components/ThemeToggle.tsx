import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

/**
 * 主題切換按鈕（暗/亮）
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      aria-label={`切換到${next === 'dark' ? '暗' : '亮'}色主題`}
      onClick={() => setTheme(next)}
      className="inline-flex items-center justify-center rounded-lg border border-app bg-elev p-2 text-fg-muted hover:text-fg hover:border-sky-500/40 transition-colors"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
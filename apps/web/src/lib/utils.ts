import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with Tailwind-aware deduplication.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 安全格式化數字為字串：支援 (v, digits, fallback) 與 (v, fallback, digits) 兩種常見呼叫
 */
export function formatNumber(
  v: number | null | undefined,
  a?: number | string,
  b?: number | string,
): string {
  if (v == null || !Number.isFinite(v)) {
    const fb = typeof a === 'string' ? a : typeof b === 'string' ? b : '—';
    return fb;
  }
  // 兩種順序都支援：(v, digits, fallback) 或 (v, fallback, digits)
  const digits = typeof a === 'number' ? a : typeof b === 'number' ? b : 2;
  return v.toFixed(digits);
}

/**
 * 安全格式化百分比：0.0123 → "1.23%"，undefined → fallback
 */
export function formatPercent(
  v: number | null | undefined,
  fallback = '—',
  digits = 2,
): string {
  if (v == null || !Number.isFinite(v)) return fallback;
  return `${(v * 100).toFixed(digits)}%`;
}

/**
 * Unix 秒數 → 本地時區字串（短格式：MM/DD）
 */
export function formatUnixSeconds(
  ts: number | string | null | undefined,
  fallback?: string,
  opts?: { month?: '2-digit' | 'numeric' | 'short' | 'long'; day?: '2-digit' | 'numeric' },
): string {
  if (ts == null) return fallback ?? '—';
  const ms = typeof ts === 'number' ? ts * 1000 : Date.parse(ts);
  if (!Number.isFinite(ms)) return fallback ?? '—';
  return new Date(ms).toLocaleDateString('zh-TW', {
    month: opts?.month ?? '2-digit',
    day: opts?.day ?? '2-digit',
  });
}

/**
 * 安全格式化日期：支援 number (Unix 秒)、string (ISO)、Date
 */
export function formatDate(
  d: number | string | Date | null | undefined,
  fallback = '—',
): string {
  if (d == null) return fallback;
  let date: Date;
  if (d instanceof Date) {
    date = d;
  } else if (typeof d === 'number') {
    // 支援 Unix 秒或毫秒自動判斷（10 位數以下視為秒）
    date = new Date(d < 1e12 ? d * 1000 : d);
  } else {
    date = new Date(d);
  }
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('zh-TW');
}

/** 帶正負號的數字格式化（+1.23 / -4.56 / 0.00） */
export function formatSigned(
  v: number | null | undefined,
  digits = 2,
  fallback = '—',
): string {
  if (v == null || !Number.isFinite(v)) return fallback;
  const sign = v > 0 ? '+' : v < 0 ? '' : '';
  return `${sign}${v.toFixed(digits)}`;
}

/** 帶正負號的百分比（+1.23% / -4.56%） */
export function formatSignedPct(
  v: number | null | undefined,
  digits = 2,
  fallback = '—',
): string {
  if (v == null || !Number.isFinite(v)) return fallback;
  const pct = v * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}
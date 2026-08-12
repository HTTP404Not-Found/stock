import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface UseApiReturn<T> extends UseApiState<T> {
  /** 重設狀態（清掉 data/error），下一次 call 會重新請求 */
  reset: () => void;
  /** 強制 re-run（會忽略 args ref 變化） */
  refetch: () => Promise<void>;
}

/**
 * 包 axios 呼叫的通用 hook：
 * - 自動管理 loading / error / data
 * - args 用 ref 比對，避免 deps 陣列每次 render 都變
 * - 第一次 render 自動 call（若 auto 預設 true）
 *
 * 用法：
 *   const { data, loading, error, refetch } = useApi(
 *     (sym: string) => stocksApi.quote(sym),
 *     [symbol],
 *   );
 */
export function useApi<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  args: Args,
  options?: { auto?: boolean },
): UseApiReturn<T> {
  const auto = options?.auto ?? true;
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: auto,
  });
  const mounted = useRef(true);

  const argsRef = useRef<Args>(args);
  argsRef.current = args;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const value = await fn(...argsRef.current);
      if (!mounted.current) return;
      setState({ data: value, error: null, loading: false });
    } catch (err: unknown) {
      if (!mounted.current) return;
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e.response?.data?.message ?? e.message ?? '請求失敗';
      setState({ data: null, error: msg, loading: false });
    }
  }, [fn]);

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (auto) {
      void run();
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(args), auto]);

  return { ...state, reset, refetch: run };
}
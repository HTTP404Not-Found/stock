import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAnalysisState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface UseAnalysisReturn<T> extends UseAnalysisState<T> {
  refetch: () => Promise<void>;
}

/**
 * 「分析型」hook：給定一個 fetcher（會傳 symbol 進去）。
 * - 自動在 symbol 變化時重新請求
 * - 結果做 module-scope 簡易 cache（避免切換 tab 重新打 API）
 * - 用 Suspense 語意相同的「loading / error / data」
 */
export function useAnalysis<T>(
  symbol: string,
  fetcher: (sym: string) => Promise<T>,
): UseAnalysisReturn<T> {
  const [state, setState] = useState<UseAnalysisState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const mounted = useRef(true);
  const cacheRef = useRef<{ sym: string; value: T } | null>(null);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    if (cacheRef.current && cacheRef.current.sym === symbol) {
      setState({ data: cacheRef.current.value, error: null, loading: false });
      return;
    }
    try {
      const value = await fetcher(symbol);
      if (!mounted.current) return;
      cacheRef.current = { sym: symbol, value };
      setState({ data: value, error: null, loading: false });
    } catch (err: unknown) {
      if (!mounted.current) return;
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e.response?.data?.message ?? e.message ?? '請求失敗';
      setState({ data: null, error: msg, loading: false });
    }
  }, [symbol, fetcher]);

  useEffect(() => {
    mounted.current = true;
    void run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return { ...state, refetch: run };
}
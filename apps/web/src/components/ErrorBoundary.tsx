import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** 給 ErrorBoundary 一個識別名稱，方便除錯時知道是哪段 UI 出問題 */
  scope?: string;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React 18 Error Boundary
 *
 * 攔截子樹渲染時的 throw，顯示降級 UI 而不是整頁白屏（閃退）。
 * 用法：在可能 throw 的子樹外包 <ErrorBoundary scope="...">...</ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 印到 console 方便除錯
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ''}]`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="m-4 rounded-xl border border-rose-500/40 bg-rose-500/5 p-5">
        <header className="flex items-center gap-2 text-rose-400">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="font-semibold">
            {this.props.scope ? `${this.props.scope} 發生錯誤` : '頁面發生錯誤'}
          </h2>
        </header>
        <p className="mt-2 text-sm text-fg-muted">
          {error.message || '未知錯誤'}（已攔截，不會影響其他頁面）
        </p>
        {errorInfo && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-fg-muted">技術細節</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-elev/60 p-2 text-xs text-fg-muted">
              {error.stack}
              {'\n\n'}
              {errorInfo.componentStack}
            </pre>
          </details>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1 rounded-lg border border-app bg-elev px-3 py-1.5 text-sm hover:border-sky-500/40"
          >
            <RefreshCw className="h-3 w-3" />重試
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-400"
          >
            重新整理整頁
          </button>
        </div>
      </div>
    );
  }
}
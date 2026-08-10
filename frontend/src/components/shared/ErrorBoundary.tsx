import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('Uncaught error caught by React ErrorBoundary:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 bg-[#0a0a0c] text-[#e0e0e6] rounded-2xl border border-[#1a1a24] my-4 shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white mb-2">
            Something went wrong
          </h2>
          
          <p className="text-sm text-[#9c9cb0] text-center max-w-md mb-6">
            An unexpected error occurred while rendering this section of the application. The issue has been logged.
          </p>

          {/* Developer diagnostics stack trace in dev mode */}
          {isDev && this.state.error && (
            <div className="w-full max-w-2xl bg-[#0e0e14] border border-[#1d1d2d] rounded-xl p-4 mb-6 overflow-x-auto text-left">
              <p className="text-xs font-mono font-semibold text-rose-400 mb-2">
                {this.state.error.name}: {this.state.error.message}
              </p>
              <pre className="text-[11px] font-mono text-gray-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {this.state.error.stack}
              </pre>
              {this.state.errorInfo && (
                <details className="mt-3 pt-2 border-t border-[#1d1d2d]">
                  <summary className="text-[11px] font-mono text-[#9c9cb0] cursor-pointer hover:text-white">
                    Component Stack
                  </summary>
                  <pre className="text-[10px] font-mono text-gray-500 whitespace-pre-wrap mt-2 max-h-36 overflow-y-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-xl bg-[#161622] hover:bg-[#1f1f30] border border-[#26263a] px-4 py-2.5 text-xs font-semibold text-white transition cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 text-purple-400" />
              Try Again
            </button>

            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-xs font-semibold text-white transition shadow-lg cursor-pointer"
            >
              <Home className="h-4 w-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

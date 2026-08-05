import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * No route in this app had any error boundary — a single synchronous render-time throw (e.g. a
 * malformed date reaching date-fns' `format`) unmounts the whole tree and white-screens the app.
 * Wrapping <Routes> here catches that once, for every route, instead of patching call sites one by one.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--app-bg)]">
          <div className="max-w-sm w-full text-center bg-[var(--app-elevated-solid)] border border-[var(--app-border-soft)] rounded-2xl p-8 shadow-sm">
            <AlertTriangle className="mx-auto text-amber-500 mb-3" size={36} />
            <h2 className="text-base font-semibold text-[var(--app-text)]">Something went wrong loading this page</h2>
            <p className="text-sm text-[var(--app-text-muted)] mt-2">
              An unexpected error occurred. Try reloading — if this keeps happening, let us know.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={14} />
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { PERMISSION_DENIED_EVENT } from '../../lib/api';

/**
 * Global, non-blocking notice for a 403 ("you can't do that"). The API client dispatches
 * PERMISSION_DENIED_EVENT for every 403 — this shows it for a few seconds without touching the page
 * (no logout, no redirect, no blank screen), so a denied action always gets visible feedback even on
 * pages whose handlers don't catch the rejection themselves.
 */
export function PermissionNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onDenied = (e: Event) => {
      setMessage((e as CustomEvent<{ message: string }>).detail?.message ?? null);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 6000);
    };
    window.addEventListener(PERMISSION_DENIED_EVENT, onDenied);
    return () => {
      window.removeEventListener(PERMISSION_DENIED_EVENT, onDenied);
      window.clearTimeout(timer);
    };
  }, []);

  // The denial is an expected outcome, not a crash — stop the browser reporting the rejected
  // promise as an "Uncaught (in promise)" error for handlers that don't catch it.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if ((e.reason as Error | undefined)?.name === 'PermissionDeniedError') e.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  if (!message) return null;
  return (
    <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950 px-4 py-3 shadow-lg text-sm text-amber-900 dark:text-amber-200">
      <ShieldAlert size={18} className="shrink-0" />
      <span>{message}</span>
      <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 cursor-pointer">
        <X size={14} />
      </button>
    </div>
  );
}

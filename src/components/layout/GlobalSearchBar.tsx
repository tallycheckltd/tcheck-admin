import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { api } from '../../lib/api';

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  studentId?: string | null;
  email: string;
}

/** Phase 4: global student search — routes to the existing UserDetailPage 360° profile.
 * Rendered as a centered command-palette overlay (triggered from the sidebar) rather than a
 * persistent topbar, so page content isn't fighting a fixed header for vertical space. */
export function GlobalSearchBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    // Wait a frame for the overlay's mount transition before stealing focus.
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      queueMicrotask(() => setResults([]));
      return;
    }
    const id = window.setTimeout(() => {
      setLoading(true);
      api
        .get<SearchResult[]>(`/users?role=STUDENT&search=${encodeURIComponent(query.trim())}`)
        .then((data) => setResults(data.slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const selectStudent = (id: string) => {
    onClose();
    navigate(`/admin/users/${id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-150">
        <div className="relative border-b border-gray-100 dark:border-white/10">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search students by name or admission no…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-11 py-4 text-sm bg-transparent text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--app-text-muted)] hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-sm text-center text-[var(--app-text-muted)]">Searching…</div>
          ) : query.trim().length < 2 ? (
            <div className="p-6 text-sm text-center text-[var(--app-text-muted)]">Type at least 2 characters to search</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-sm text-center text-[var(--app-text-muted)]">No students found</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectStudent(r.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-between gap-2 cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-0"
              >
                <span className="text-sm font-medium text-[var(--app-text)]">{r.firstName} {r.lastName}</span>
                <span className="text-xs font-mono text-[var(--app-text-muted)]">{r.studentId || '—'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

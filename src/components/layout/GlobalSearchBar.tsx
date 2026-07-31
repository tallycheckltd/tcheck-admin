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

/** Phase 4: persistent global student search — routes to the existing UserDetailPage 360° profile. */
export function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      queueMicrotask(() => setResults([]));
      return;
    }
    const id = window.setTimeout(() => {
      setLoading(true);
      api
        .get<SearchResult[]>(`/users?role=STUDENT&search=${encodeURIComponent(query.trim())}`)
        .then((data) => {
          setResults(data.slice(0, 8));
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectStudent = (id: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/admin/users/${id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none" />
        <input
          type="search"
          placeholder="Search students by name or admission no…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full pl-9 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] cursor-pointer"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute right-0 mt-1 w-80 max-w-[90vw] rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-40">
          {loading ? (
            <div className="p-4 text-sm text-center text-[var(--app-text-muted)]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-center text-[var(--app-text-muted)]">No students found</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectStudent(r.id)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="text-sm font-medium text-[var(--app-text)]">{r.firstName} {r.lastName}</span>
                <span className="text-xs font-mono text-[var(--app-text-muted)]">{r.studentId || '—'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

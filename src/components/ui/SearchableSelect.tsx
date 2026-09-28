import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Shown smaller/muted under the label — e.g. a student's email/ID next to their name. */
  sublabel?: string;
}

interface Props {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  emptyText?: string;
  disabled?: boolean;
}

/** A type-to-filter dropdown for picking one item out of a list that can realistically grow past
 * a handful of entries (a school's full student roster, for one) — a plain `<select>` forces
 * scrolling through every option with no way to type ahead, which is the exact complaint this
 * replaces across the app one call site at a time, starting with "Enroll Student". */
export function SearchableSelect({ label, placeholder = 'Search…', value, onChange, options, emptyText = 'No matches', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pick = (option: SearchableSelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'w-full flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-left transition-all',
            'bg-white dark:bg-white/5 border focus:outline-none',
            open ? 'border-blue-500/50 ring-2 ring-blue-500/50' : 'border-gray-200 dark:border-white/10',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={clsx('flex-1 truncate', selected ? 'text-gray-900 dark:text-white' : 'text-gray-400')}>
            {selected ? selected.label : placeholder}
          </span>
          {selected && !disabled && (
            <X
              size={14}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
            />
          )}
          <ChevronDown size={16} className={clsx('text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
            <div className="relative border-b border-gray-100 dark:border-white/10">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) pick(filtered[highlighted]); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                placeholder="Type to filter…"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400 text-center">{emptyText}</p>
              )}
              {filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => pick(option)}
                  className={clsx(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer',
                    index === highlighted ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5',
                    option.value === value && 'font-semibold',
                  )}
                >
                  <p className="text-gray-900 dark:text-white truncate">{option.label}</p>
                  {option.sublabel && <p className="text-xs text-gray-400 truncate">{option.sublabel}</p>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { UnitComparisonChart } from '../../components/analytics/UnitComparisonChart';
import { Fragment, useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Clock,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  List,
  Minus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Table2,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { exportCampusAnalyticsPdf, exportTrendAnalysisPdf } from '../../lib/adminPdfExport';
import { downloadCsv } from '../../lib/csv';
import { format, parseISO } from 'date-fns';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  Line,
  ComposedChart,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { CampusAnalytics, ClassAttendanceStat } from '../../types';
import { clsx } from 'clsx';

const DASH_OPTS = { refetchIntervalMs: 60_000, refetchWhenVisible: true } as const;
const DAY_MS = 86_400_000;

/** Analytics palette — shared with the Moi Analytics page so the two screens read as one product. */
const C = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
  grid: 'rgba(148, 163, 184, 0.22)',
};

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.94)',
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
};
const axisTick = { fontSize: 11, fill: '#94a3b8' };

const cardShell =
  'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] shadow-[var(--app-shadow)] dark:border-white/10 dark:bg-gradient-to-br dark:from-white/[0.07] dark:to-white/[0.02]';
const pillBtn =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer';
const selectClass =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/15 dark:bg-slate-900 dark:text-white';
const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer';
const thClass = 'px-4 py-2.5 text-left font-semibold whitespace-nowrap';
const tdClass = 'px-4 py-3';

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
] as const;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function sessionDate(d: ClassAttendanceStat) {
  try {
    const raw = typeof d.date === 'string' ? parseISO(d.date) : new Date(d.date);
    return Number.isNaN(raw.getTime()) ? new Date(d.date) : raw;
  } catch {
    return new Date(d.date);
  }
}

function formatSessionDayLabel(dateIso: string) {
  if (!dateIso) return '—';
  const raw =
    dateIso.length >= 10 && dateIso[10] === 'T' ? parseISO(dateIso) : parseISO(`${dateIso}T12:00:00`);
  if (Number.isNaN(raw.getTime())) return dateIso;
  return format(raw, 'MMM d, yyyy');
}

/** A session counts toward rates once its check-in window has closed (older APIs omit the flag). */
const isHeld = (s: ClassAttendanceStat) => s.delivered ?? true;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/* ---------------------------------------------------------------- health / verdicts */

type Health = 'good' | 'warn' | 'bad';
// Owner 11-05: clean, no colour grading. Status is said in words; every state shares one neutral look.
const NEUTRAL = {
  text: 'text-slate-600 dark:text-slate-300',
  bar: 'bg-indigo-500/80 dark:bg-indigo-400/80',
  edge: '',
  dot: 'hidden',
  soft: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-0',
};
const HEALTH: Record<Health, { label: string; text: string; bar: string; edge: string; dot: string; soft: string }> = {
  good: { label: 'Good', ...NEUTRAL },
  warn: { label: 'Watch', ...NEUTRAL },
  bad: { label: 'Needs attention', ...NEUTRAL },
};

/** An attendance rate (0–100) against the school's target: at/above = good, within 10 pts = watch. */
const rateHealth = (rate: number, target: number): Health => (rate >= target ? 'good' : rate >= target - 10 ? 'warn' : 'bad');

/** "Good / Watch / Needs attention" as a dot + word — colour is never the only cue. */
function HealthPill({ health, children }: { health: Health; children?: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', HEALTH[health].soft)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', HEALTH[health].dot)} aria-hidden />
      {children ?? HEALTH[health].label}
    </span>
  );
}

/** A rate with a small meter and its verdict, for table cells. */
function RateCell({ rate, target }: { rate: number; target: number }) {
  const h = rateHealth(rate, target);
  return (
    <div className="flex min-w-[9rem] items-center gap-2.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden>
        <div className={clsx('h-full rounded-full', HEALTH[h].bar)} style={{ width: `${Math.max(2, Math.min(100, rate))}%` }} />
      </div>
      <span className={clsx('w-10 text-sm font-semibold tabular-nums', HEALTH[h].text)}>{rate}%</span>
      <span className="sr-only">{HEALTH[h].label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- building blocks */

function KpiTile({
  label, value, hint, icon: Icon, meter, health, verdict, delta, onClick, children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: typeof Activity;
  /** 0–100: drawn as a bar under the number. */
  meter?: number | null;
  health?: Health;
  verdict?: string;
  /** Change vs the previous period: already-formatted text plus its direction. */
  delta?: { text: string; dir: 'up' | 'down' | 'flat'; good?: boolean } | null;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  const DeltaIcon = delta?.dir === 'up' ? ArrowUp : delta?.dir === 'down' ? ArrowDown : Minus;
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick, title: 'Show the details' } : {})}
      className={clsx(
        cardShell,
        'relative flex h-full w-full flex-col gap-2.5 overflow-hidden p-4 text-left',
        onClick && 'cursor-pointer transition-shadow hover:ring-2 hover:ring-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">{label}</p>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300">
          <Icon size={15} aria-hidden />
        </span>
      </div>
      <p className="text-[1.7rem] font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{value}</p>
      {meter != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden>
          <div
            className={clsx('h-full rounded-full', health ? HEALTH[health].bar : 'bg-indigo-500')}
            style={{ width: `${Math.max(2, Math.min(100, Math.round(meter)))}%` }}
          />
        </div>
      )}
      {children}
      {hint && <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</p>}
      {delta && (
        <p
          className={clsx(
            'flex items-center gap-1 text-[11px] font-medium',
            delta.dir === 'flat' || delta.good == null
              ? 'text-slate-500 dark:text-slate-400'
              : delta.good
                ? 'text-slate-700 dark:text-slate-200'
                : 'text-slate-700 dark:text-slate-200',
          )}
        >
          <DeltaIcon size={12} aria-hidden />
          {delta.text}
        </p>
      )}
      {health && (
        <p className={clsx('mt-auto flex items-center gap-1.5 pt-0.5 text-[11px] font-semibold', HEALTH[health].text)}>
          <span className={clsx('h-1.5 w-1.5 rounded-full', HEALTH[health].dot)} aria-hidden />
          {verdict ?? HEALTH[health].label}
        </p>
      )}
    </Wrapper>
  );
}

function SectionHeading({ id, icon: Icon, title, description, children }: {
  id?: string;
  icon: typeof Activity;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Icon size={17} aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Panel({ id, title, description, icon: Icon, count, actions, children, className }: {
  id?: string;
  title: string;
  description?: ReactNode;
  icon: typeof Activity;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-label={title} className={clsx(cardShell, 'flex scroll-mt-24 flex-col overflow-hidden', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Icon size={16} className="text-indigo-500 dark:text-indigo-300" aria-hidden />
            {title}
            {count != null && <Badge color="gray">{count.toLocaleString()}</Badge>}
          </h3>
          {description && <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

type View = 'chart' | 'table';
function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10" role="group" aria-label="Show as">
      {(['chart', 'table'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          title={v === 'chart' ? 'Show as chart' : 'Show as table'}
          className={clsx(
            'inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            value === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
          )}
        >
          {v === 'chart' ? <BarChart3 size={13} aria-hidden /> : <Table2 size={13} aria-hidden />}
          {v === 'chart' ? 'Chart' : 'Table'}
        </button>
      ))}
    </div>
  );
}

function Empty({ icon: Icon = BarChart3, title, description, tone = 'neutral' }: {
  icon?: typeof Activity;
  title: string;
  description?: string;
  tone?: 'neutral' | 'good';
}) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      <span
        className={clsx(
          'flex h-11 w-11 items-center justify-center rounded-2xl',
          tone === 'good'
            ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
            : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500',
        )}
      >
        <Icon size={20} aria-hidden />
      </span>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}

function Skel({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/[0.06]', className)} />;
}

/* ---------------------------------------------------------------- tables + paging */

const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Rows per page, "1–25 of 120", first / previous / next / last. Hidden when one small page holds everything. */
function Pager({ page, pageSize, total, onPage, onPageSize, noun = 'rows' }: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  noun?: string;
}) {
  if (total <= PAGE_SIZES[0]) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn =
    'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
      <label className="inline-flex items-center gap-2 whitespace-nowrap">
        Rows per page
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white"
        >
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-1.5">
        <span className="mr-2 whitespace-nowrap tabular-nums">
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
        </span>
        <button type="button" className={btn} onClick={() => onPage(0)} disabled={page === 0} aria-label="First page"><ChevronsLeft size={14} /></button>
        <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <span className="hidden whitespace-nowrap px-1 tabular-nums sm:inline">Page {page + 1} of {pages}</span>
        <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages - 1} aria-label="Next page"><ChevronRight size={14} /></button>
        <button type="button" className={btn} onClick={() => onPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page"><ChevronsRight size={14} /></button>
      </div>
    </div>
  );
}

/** Page state that never leaves you past the end after a search, filter or refresh shrinks the list. */
function usePaging(total: number, initialSize = 10) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  return {
    page: current,
    pageSize,
    start: current * pageSize,
    setPage,
    setPageSize: (n: number) => { setPageSize(n); setPage(0); },
    reset: () => setPage(0),
  };
}

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** What sorting and search use; defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  align?: 'right' | 'center';
  className?: string;
  sortable?: boolean;
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null;

/**
 * Searchable, sortable, paginated table with a # column that keeps counting across pages.
 * Pass `query` to drive the search from outside (the box is then not drawn here).
 */
function DataTable<T>({
  rows, columns, rowKey, empty, emptyIcon, searchPlaceholder = 'Search…', initialSort, highlight, query, toolbar, noun = 'rows',
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty: string;
  emptyIcon?: typeof Activity;
  searchPlaceholder?: string;
  initialSort?: Sort;
  /** Tone for problem rows — a tinted background plus a coloured left edge on the # cell. */
  highlight?: (row: T) => Health | null;
  query?: string;
  toolbar?: ReactNode;
  noun?: string;
}) {
  const [ownQuery, setOwnQuery] = useState('');
  const q = (query ?? ownQuery).trim().toLowerCase();
  const [sort, setSort] = useState<Sort>(initialSort ?? null);

  const shown = useMemo(() => {
    const valueOf = (c: Column<T>, r: T) =>
      c.value ? c.value(r) : ((r as Record<string, unknown>)[c.key] as string | number | null | undefined);
    let out = q ? rows.filter((r) => columns.some((c) => String(valueOf(c, r) ?? '').toLowerCase().includes(q))) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const dir = sort.dir === 'asc' ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = valueOf(col, a);
          const bv = valueOf(col, b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * dir;
        });
      }
    }
    return out;
  }, [rows, columns, q, sort]);

  const paging = usePaging(shown.length);
  const visible = shown.slice(paging.start, paging.start + paging.pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    paging.reset();
  };

  const showToolbar = query === undefined || toolbar;

  return (
    <div>
      {showToolbar && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {query === undefined && rows.length > 0 && (
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="search"
                  value={ownQuery}
                  onChange={(e) => { setOwnQuery(e.target.value); paging.reset(); }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            )}
            {toolbar}
          </div>
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {shown.length === rows.length ? `${rows.length.toLocaleString()} ${noun}` : `${shown.length.toLocaleString()} of ${rows.length.toLocaleString()} ${noun}`}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <tr>
              <th className={clsx(thClass, 'w-12 !pr-0 text-right')}>#</th>
              {columns.map((c) => (
                <th key={c.key} className={clsx(thClass, c.align === 'right' && '!text-right', c.align === 'center' && '!text-center')}>
                  {c.sortable === false ? (
                    c.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white"
                      aria-label={`Sort by ${c.label}`}
                    >
                      {c.label}
                      {sort?.key === c.key
                        ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                        : <ChevronsUpDown size={11} className="opacity-40" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-white/5 dark:text-slate-300">
            {visible.map((r, i) => {
              const h = highlight?.(r) ?? null;
              return (
                <tr
                  key={rowKey(r)}
                  className={clsx(
                    'align-middle transition-colors',
                    h ? 'bg-slate-50 dark:bg-white/[0.03]' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]',
                  )}
                >
                  <td
                    className={clsx(
                      tdClass,
                      'relative !pr-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500',
                    )}
                  >
                    {paging.start + i + 1}
                  </td>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={clsx(tdClass, c.className, c.align === 'right' && 'text-right tabular-nums', c.align === 'center' && 'text-center tabular-nums')}
                    >
                      {c.render ? c.render(r) : ((r as Record<string, unknown>)[c.key] as ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1}>
                  <Empty icon={rows.length ? Search : emptyIcon ?? CheckCircle2} title={rows.length ? 'Nothing matches your search.' : empty} tone={rows.length ? 'neutral' : 'good'} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={paging.page} pageSize={paging.pageSize} total={shown.length} onPage={paging.setPage} onPageSize={paging.setPageSize} noun={noun} />
    </div>
  );
}

/* ---------------------------------------------------------------- download menu */

type ExportKey = 'campus-pdf' | 'trend-pdf' | 'trend-csv' | 'sessions-csv' | 'watch-csv' | 'zero-csv';

function DownloadMenu({ disabled, busy, onPick }: { disabled: boolean; busy: ExportKey | null; onPick: (k: ExportKey) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const groups: { heading: string; items: { key: ExportKey; title: string; sub: string; icon: typeof FileText; tone: string }[] }[] = [
    {
      heading: 'Reports (PDF)',
      items: [
        { key: 'campus-pdf', title: 'Campus analytics report', sub: 'Headline numbers, watch list and the sessions shown', icon: FileText, tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
        { key: 'trend-pdf', title: 'Weekly trend report', sub: 'Week-by-week attendance analysis', icon: TrendingUp, tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
      ],
    },
    {
      heading: 'Spreadsheets (CSV)',
      items: [
        { key: 'trend-csv', title: 'Weekly trend', sub: 'Week, attendance %, present, eligible', icon: FileSpreadsheet, tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
        { key: 'sessions-csv', title: 'Session ledger', sub: 'Every session matching your filters', icon: FileSpreadsheet, tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
        { key: 'watch-csv', title: 'Watch list', sub: 'Students below the attendance target', icon: FileSpreadsheet, tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
        { key: 'zero-csv', title: 'Sessions with no check-ins', sub: 'Past 60 days', icon: FileSpreadsheet, tone: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
      ],
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(pillBtn, '!border-transparent !bg-indigo-600 !text-white hover:!bg-indigo-700')}
      >
        {busy ? <RefreshCw size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
        {busy?.endsWith('pdf') ? 'Building PDF…' : busy ? 'Preparing…' : 'Download'}
        <ChevronDown size={14} className="opacity-80" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-30 mt-2 w-[19rem] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          {groups.map((g) => (
            <div key={g.heading} className="py-1">
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.heading}</p>
              {g.items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => { setOpen(false); onPick(it.key); }}
                >
                  <span className={clsx('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', it.tone)}>
                    <it.icon size={16} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{it.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{it.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- heatmap */

function Heatmap({ campus }: { campus: CampusAnalytics }) {
  const heat = useMemo(() => {
    const { start, end } = campus.hourRange;
    const cols = end - start + 1;
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(cols).fill(0));
    for (const c of campus.trafficHeatmapCells) {
      const col = c.hour - start;
      if (col >= 0 && col < cols && c.dayIdx >= 0 && c.dayIdx < 7) {
        matrix[c.dayIdx][col] = Math.max(matrix[c.dayIdx][col], c.intensity);
      }
    }
    const hours = Array.from({ length: cols }, (_, i) => start + i);
    const observedMax = Math.max(0, ...matrix.flat());
    return { matrix, hours, max: campus.trafficHeatmapMax || observedMax || 1, empty: observedMax <= 0 };
  }, [campus]);

  if (heat.empty) {
    return <Empty icon={Clock} title="No sessions held yet in this scope." description="The busiest days and hours appear here once classes run." />;
  }
  const cellColor = (v: number) => (v > 0 ? `rgba(99, 102, 241, ${0.14 + 0.86 * Math.min(1, v / heat.max)})` : 'rgba(148, 163, 184, 0.12)');
  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-[10px]">
          <thead>
            <tr>
              <th className="w-10" />
              {heat.hours.map((h) => (
                <th key={h} className="font-medium text-slate-400 tabular-nums">{String(h).padStart(2, '0')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((label, ri) => (
              <tr key={label}>
                <th className="pr-2 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</th>
                {heat.matrix[ri].map((v, ci) => (
                  <td
                    key={heat.hours[ci]}
                    title={`${label} ${String(heat.hours[ci]).padStart(2, '0')}:00 — ${v > 0 ? `activity ${v.toFixed(2)}` : 'no sessions'}`}
                    className="h-7 rounded-md transition-transform hover:scale-110"
                    style={{ background: cellColor(v) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          Hours {String(campus.hourRange.start).padStart(2, '0')}:00–{String(campus.hourRange.end).padStart(2, '0')}:00 · hover a cell for detail
        </span>
        <span className="inline-flex items-center gap-1.5">
          Quieter
          {[0.15, 0.35, 0.55, 0.75, 1].map((t) => (
            <span key={t} className="h-3 w-5 rounded" style={{ background: `rgba(99, 102, 241, ${0.14 + 0.86 * t})` }} aria-hidden />
          ))}
          Busier
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

function rateFor(rows: ClassAttendanceStat[]) {
  const enrolled = rows.reduce((n, s) => n + s.totalEnrolled, 0);
  const checked = rows.reduce((n, s) => n + s.totalCheckedIn, 0);
  return { rate: enrolled > 0 ? Math.round((checked / enrolled) * 100) : null, sessions: rows.length };
}

export function AttendanceAnalyticsPage() {
  const uid = useId().replace(/:/g, '');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [warningSending, setWarningSending] = useState<string | null>(null);
  const handleSendWarning = async (studentDbId: string, displayName: string, rate: number, threshold: number) => {
    const draft = `Hi ${displayName}, your overall attendance is currently ${rate}%, below the ${threshold}% required for exam eligibility. Please ensure you attend upcoming sessions.`;
    const text = window.prompt('Send an attendance warning to this student:', draft);
    if (!text) return;
    setWarningSending(studentDbId);
    try {
      await api.post('/messages/send', { recipientId: studentDbId, content: text });
    } finally {
      setWarningSending(null);
    }
  };

  // §12.4 — the course dropdown is a genuine global filter: it's part of the campus-analytics
  // query key, so picking a course refetches and re-scopes every widget on the page (trend,
  // heatmap, room utilization, watch list, weekly decay), not just the session ledger table below.
  const [courseFilter, setCourseFilter] = useState('');
  const { data: campus, loading: campusLoading, error: campusError, refetch: refetchCampus } = useApi<CampusAnalytics>(
    `/attendance/campus-analytics${courseFilter ? `?courseId=${courseFilter}` : ''}`,
    DASH_OPTS,
  );
  const { data: sessionRows, loading: rowsLoading, error: rowsError, refetch: refetchRows } = useApi<ClassAttendanceStat[]>(
    '/attendance/class-stats',
    DASH_OPTS,
  );
  const [search, setSearch] = useState('');
  const [periodDays, setPeriodDays] = useState<number>(0);
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [trendView, setTrendView] = useState<View>('chart');
  const [weekView, setWeekView] = useState<View>('chart');
  const [roomView, setRoomView] = useState<View>('chart');
  const [ledgerMode, setLedgerMode] = useState<'course' | 'session'>('course');
  const [ledgerSort, setLedgerSort] = useState<'code' | 'rate-asc' | 'rate-desc' | 'sessions'>('code');

  const statsList = useMemo(() => sessionRows ?? [], [sessionRows]);
  const target = campus?.attendanceThreshold ?? 80;

  // "Now" is the server's last answer, so render stays pure and the period lines up with the data.
  const [mountedAt] = useState(() => Date.now());
  const nowMs = campus?.fetchedAtIso ? parseISO(campus.fetchedAtIso).getTime() : mountedAt;

  const uniqueCourses = useMemo(
    () => Array.from(new Map(statsList.map((s) => [s.course.id, s.course.code])).entries()).sort((a, b) => a[1].localeCompare(b[1])),
    [statsList],
  );

  const courseRows = useMemo(
    () => (courseFilter ? statsList.filter((s) => s.course.id === courseFilter) : statsList),
    [statsList, courseFilter],
  );

  /** Ledger rows: course + period + search. Also what the campus PDF and the sessions CSV contain. */
  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    const from = periodDays ? nowMs - periodDays * DAY_MS : null;
    return courseRows.filter((s) => {
      const matchesSearch =
        !needle ||
        s.course.name.toLowerCase().includes(needle) ||
        s.course.code.toLowerCase().includes(needle) ||
        s.title.toLowerCase().includes(needle);
      const t = sessionDate(s).getTime();
      const matchesPeriod = from == null || (t >= from && t <= nowMs + DAY_MS);
      return matchesSearch && matchesPeriod;
    });
  }, [courseRows, search, periodDays, nowMs]);

  /** Rate this period vs the one before it — delivered sessions only, same rule as the server. */
  const periodCompare = useMemo(() => {
    const days = periodDays || 30;
    const delivered = courseRows.filter((s) => (s.delivered ?? sessionDate(s).getTime() <= nowMs) && s.totalEnrolled > 0);
    const inRange = (a: number, b: number) => delivered.filter((s) => { const t = sessionDate(s).getTime(); return t > a && t <= b; });
    const cur = rateFor(inRange(nowMs - days * DAY_MS, nowMs));
    const prev = rateFor(inRange(nowMs - 2 * days * DAY_MS, nowMs - days * DAY_MS));
    return { days, cur, prev };
  }, [courseRows, periodDays, nowMs]);

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const toggleCourseGroup = (code: string) =>
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });

  const ledgerByCourse = useMemo(() => {
    const groups = new Map<string, { courseCode: string; courseName: string; sessions: ClassAttendanceStat[] }>();
    for (const s of filtered) {
      let g = groups.get(s.course.code);
      if (!g) {
        g = { courseCode: s.course.code, courseName: s.course.name, sessions: [] };
        groups.set(s.course.code, g);
      }
      g.sessions.push(s);
    }
    const out = Array.from(groups.values()).map((g) => {
      // Same rule as the server's rates: only sessions already held count; upcoming ones have nothing to attend yet.
      const held = g.sessions.filter(isHeld);
      const totalEnrolled = held.reduce((sum, s) => sum + s.totalEnrolled, 0);
      const totalCheckedIn = held.reduce((sum, s) => sum + s.totalCheckedIn, 0);
      const sessions = [...g.sessions].sort((a, b) => sessionDate(b).getTime() - sessionDate(a).getTime());
      const lecturers = Array.from(new Set(g.sessions.map((s) => `${s.course.lecturer.firstName} ${s.course.lecturer.lastName}`.trim())));
      return { ...g, sessions, lecturers, heldCount: held.length, totalEnrolled, totalCheckedIn, aggregateRate: totalEnrolled > 0 ? Math.round((totalCheckedIn / totalEnrolled) * 100) : 0 };
    });
    const sorters: Record<typeof ledgerSort, (a: (typeof out)[number], b: (typeof out)[number]) => number> = {
      code: (a, b) => a.courseCode.localeCompare(b.courseCode),
      'rate-asc': (a, b) => a.aggregateRate - b.aggregateRate || a.courseCode.localeCompare(b.courseCode),
      'rate-desc': (a, b) => b.aggregateRate - a.aggregateRate || a.courseCode.localeCompare(b.courseCode),
      sessions: (a, b) => b.sessions.length - a.sessions.length || a.courseCode.localeCompare(b.courseCode),
    };
    return out.sort(sorters[ledgerSort]);
  }, [filtered, ledgerSort]);
  const coursePaging = usePaging(ledgerByCourse.length, 10);
  const visibleGroups = ledgerByCourse.slice(coursePaging.start, coursePaging.start + coursePaging.pageSize);
  const allVisibleOpen = visibleGroups.length > 0 && visibleGroups.every((g) => expandedCourses.has(g.courseCode));

  const methodTotals = useMemo(
    () => filtered.reduce((t, s) => ({ BLE: t.BLE + s.checkInBreakdown.BLE, QR: t.QR + s.checkInBreakdown.QR, MANUAL: t.MANUAL + s.checkInBreakdown.MANUAL }), { BLE: 0, QR: 0, MANUAL: 0 }),
    [filtered],
  );
  const methodSum = methodTotals.BLE + methodTotals.QR + methodTotals.MANUAL;

  const trendLineData = useMemo(() => {
    if (!campus?.overallTrendSparkline?.length) return [];
    return campus.overallTrendSparkline.map((p) => {
      const day = new Date(`${p.date}T00:00:00`).getDay();
      return { date: p.label, iso: p.date, value: p.value, isWeekend: day === 0 || day === 6 };
    });
  }, [campus]);
  const trendHasData = trendLineData.length > 0 && trendLineData.some((d) => d.value > 0);
  const weekHasData = !!campus?.attendanceDecayByWeek.some((w) => w.volumeEligible > 0);

  const rooms = useMemo(
    () => (campus?.roomUtilization ?? [])
      .map((r) => ({ ...r, pct: pct(r.checkedInTotal, r.enrolledTotal) }))
      .sort((a, b) => b.pct - a.pct),
    [campus],
  );

  const blockedTotal = campus ? campus.blockedGateAttemptsBle + campus.blockedGateAttemptsQr : 0;

  const showSkeleton =
    (!campus && campusLoading && !campusError) || (!statsList.length && rowsLoading && !rowsError);
  const refreshing = !showSkeleton && (campusLoading || rowsLoading);

  async function refreshAll() {
    await Promise.all([refetchCampus(), refetchRows()]);
  }

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function handleExport(key: ExportKey) {
    if (!campus) return;
    setBusy(key);
    try {
      if (key === 'campus-pdf') {
        await exportCampusAnalyticsPdf(campus, filtered);
      } else if (key === 'trend-pdf') {
        await exportTrendAnalysisPdf(campus);
      } else if (key === 'trend-csv') {
        downloadCsv(
          'tcheck-trend-analysis.csv',
          ['Week', 'Attendance %', 'Present', 'Eligible'],
          campus.attendanceDecayByWeek.map((w) => [w.weekLabel, w.pct, w.volumePresent, w.volumeEligible]),
        );
      } else if (key === 'sessions-csv') {
        downloadCsv(
          'tcheck-session-ledger.csv',
          ['Date', 'Session', 'Course code', 'Course', 'Lecturer', 'Checked in', 'Expected', 'Attendance %', 'Aura', 'QR', 'Manual'],
          [...filtered]
            .sort((a, b) => sessionDate(b).getTime() - sessionDate(a).getTime())
            .map((s) => [
              format(sessionDate(s), 'yyyy-MM-dd'), s.title, s.course.code, s.course.name,
              `${s.course.lecturer.firstName} ${s.course.lecturer.lastName}`, s.totalCheckedIn, s.totalEnrolled, s.attendanceRate,
              s.checkInBreakdown.BLE, s.checkInBreakdown.QR, s.checkInBreakdown.MANUAL,
            ]),
        );
      } else if (key === 'watch-csv') {
        downloadCsv(
          'tcheck-watch-list.csv',
          ['Student ID', 'Name', 'Attendance %', `Target %`],
          campus.atRiskStudents.map((s) => [s.studentId, s.displayName, s.attendancePct, campus.attendanceThreshold]),
        );
      } else if (key === 'zero-csv') {
        downloadCsv(
          'tcheck-zero-attendance-sessions.csv',
          ['Date', 'Session', 'Course code', 'Lecturer', 'Enrolled'],
          campus.unloggedSessions.map((u) => [u.dateIso, u.title, u.courseCode, u.lecturerName, u.enrolled]),
        );
      }
    } catch {
      window.alert('Could not generate the file. If this persists, try Chrome or Edge on desktop.');
    } finally {
      setBusy(null);
    }
  }

  const scopeLabel =
    user?.role === 'SUPER_ADMIN' ? 'All schools'
      : user?.role === 'DEAN' ? 'Your faculty'
        : user?.role === 'HOD' || user?.role === 'DEPUTY_HOD' ? 'Your department'
          : user?.school?.name ?? 'Your school';

  /* ------------------------------------------------------------ header + control strip */

  const header = (
    <header className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · refreshes every minute
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">Attendance analytics</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            How well students are turning up — overall, week by week, by room and by course — and who needs a follow-up.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {campus?.fetchedAtIso && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock size={13} aria-hidden />
              Updated {format(parseISO(campus.fetchedAtIso), 'MMM d, h:mm a')}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={campusLoading || rowsLoading}
            className={pillBtn}
            title="Refresh now"
          >
            <RefreshCw size={15} className={clsx(campusLoading || rowsLoading ? 'animate-spin text-indigo-500' : '')} aria-hidden />
            Refresh
          </button>
          <DownloadMenu disabled={!campus} busy={busy} onPick={(k) => void handleExport(k)} />
        </div>
      </div>

      <div className={clsx(cardShell, 'flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <span className="inline-flex items-center gap-2 text-sm">
            <Building2 size={15} className="text-slate-400" aria-hidden />
            <span className="text-slate-500 dark:text-slate-400">Scope</span>
            <span className="font-semibold text-slate-900 dark:text-white">{scopeLabel}</span>
          </span>
          <span className="hidden h-5 w-px bg-slate-200 dark:bg-white/10 sm:block" aria-hidden />
          <label className="inline-flex items-center gap-2 text-sm">
            <Filter size={15} className="text-slate-400" aria-hidden />
            <span className="text-slate-500 dark:text-slate-400">Course</span>
            <select
              value={courseFilter}
              onChange={(e) => { setCourseFilter(e.target.value); coursePaging.reset(); }}
              className={clsx(selectClass, 'min-w-[150px] !py-1.5')}
              aria-label="Filter by course"
            >
              <option value="">All courses</option>
              {uniqueCourses.map(([id, code]) => (
                <option key={id} value={id}>{code}</option>
              ))}
            </select>
          </label>
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300" role="status">
              <RefreshCw size={12} className="animate-spin" aria-hidden /> Updating…
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays size={15} className="text-slate-400" aria-hidden />
            Period
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.03]" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => { setPeriodDays(p.days); coursePaging.reset(); }}
                aria-pressed={periodDays === p.days}
                className={clsx(
                  'cursor-pointer rounded-lg px-3 py-1 text-sm font-medium transition-colors',
                  periodDays === p.days
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-0'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );

  if (showSkeleton) {
    return (
      <div className="mx-auto max-w-[1680px] space-y-6 text-[color:var(--app-text)]" role="status" aria-label="Loading attendance analytics">
        {header}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={clsx(cardShell, 'space-y-3 p-4')}>
              <Skel className="h-3 w-24" />
              <Skel className="h-7 w-16" />
              <Skel className="h-1.5 w-full" />
              <Skel className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className={clsx(cardShell, 'space-y-4 p-5')}>
              <Skel className="h-4 w-40" />
              <Skel className="h-[240px] w-full" />
            </div>
          ))}
        </div>
        <div className={clsx(cardShell, 'space-y-3 p-5')}>
          <Skel className="h-4 w-48" />
          {Array.from({ length: 5 }, (_, i) => <Skel key={i} className="h-9 w-full" />)}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ KPI tiles */

  const overallHealth = campus ? rateHealth(campus.overallAttendancePct, target) : undefined;
  const { cur, prev, days: cmpDays } = periodCompare;
  const curHealth = cur.rate != null ? rateHealth(cur.rate, target) : undefined;
  const rateDelta = (() => {
    if (cur.rate == null) return { text: 'No sessions held in this period', dir: 'flat' as const };
    if (prev.rate == null) return { text: `No sessions in the ${cmpDays} days before`, dir: 'flat' as const };
    const d = cur.rate - prev.rate;
    if (d === 0) return { text: `Same as previous ${cmpDays} days`, dir: 'flat' as const };
    return { text: `${Math.abs(d)} pts vs previous ${cmpDays} days (${prev.rate}%)`, dir: d > 0 ? 'up' as const : 'down' as const, good: d > 0 };
  })();
  const sessionDelta = (() => {
    if (prev.sessions === 0) return cur.sessions ? { text: `None in the ${cmpDays} days before`, dir: 'flat' as const } : null;
    const d = cur.sessions - prev.sessions;
    if (d === 0) return { text: `Same as previous ${cmpDays} days`, dir: 'flat' as const };
    return { text: `${Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} than previous ${cmpDays} days`, dir: d > 0 ? 'up' as const : 'down' as const };
  })();
  const atRisk = campus?.atRiskStudentCount ?? 0;
  const zeroCount = campus?.unloggedSessions.length ?? 0;

  return (
    <div className="mx-auto max-w-[1680px] space-y-10 text-[color:var(--app-text)]">
      {header}

      {(campusError || rowsError) && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-500/30 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm text-rose-800 dark:text-rose-200">
            <ShieldAlert size={16} aria-hidden />
            Some numbers could not be loaded: {campusError ?? rowsError}
          </p>
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw size={15} aria-hidden />
            Try again
          </button>
        </div>
      )}

      {campus && (
        <section aria-label="Headline numbers" className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          <KpiTile
            label="Overall attendance"
            value={`${campus.overallAttendancePct}%`}
            icon={BarChart3}
            meter={campus.overallAttendancePct}
            health={overallHealth}
            hint={`${campus.sessionCount.toLocaleString()} sessions · target ${target}%`}
            verdict={overallHealth === 'good' ? 'At or above target' : overallHealth === 'warn' ? 'Just below target' : 'Well below target'}
            onClick={() => jump('aa-trends')}
          />
          <KpiTile
            label={`Attendance, last ${cmpDays} days`}
            value={cur.rate != null ? `${cur.rate}%` : '—'}
            icon={TrendingUp}
            meter={cur.rate}
            health={curHealth}
            delta={rateDelta}
            hint={periodDays === 0 ? 'Pick a period above to change this window' : undefined}
          />
          <KpiTile
            label={`Sessions held, last ${cmpDays} days`}
            value={cur.sessions.toLocaleString()}
            icon={CalendarDays}
            delta={sessionDelta}
            onClick={() => jump('aa-ledger')}
          />
          <KpiTile
            label={`Students below ${target}%`}
            value={atRisk.toLocaleString()}
            icon={Users}
            health={atRisk === 0 ? 'good' : atRisk < 10 ? 'warn' : 'bad'}
            verdict={atRisk === 0 ? 'Everyone is on track' : `${atRisk} to follow up`}
            hint="On the watch list for exam eligibility"
            onClick={() => jump('aa-attention')}
          />
          <KpiTile
            label="Sessions with no check-ins"
            value={zeroCount.toLocaleString()}
            icon={DoorOpen}
            health={zeroCount === 0 ? 'good' : zeroCount < 5 ? 'warn' : 'bad'}
            verdict={zeroCount === 0 ? 'Every session was logged' : 'Check these were held'}
            hint="Past 60 days, students enrolled"
            onClick={() => jump('aa-attention')}
          />
          <KpiTile
            label="Blocked check-ins (90 days)"
            value={blockedTotal.toLocaleString()}
            icon={ShieldAlert}
            hint={blockedTotal ? `Aura ${campus.blockedGateAttemptsBle.toLocaleString()} · QR ${campus.blockedGateAttemptsQr.toLocaleString()} — attempts the gate rejected` : 'No rejected attempts'}
          >
            {blockedTotal > 0 && (
              <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden>
                <div style={{ width: `${pct(campus.blockedGateAttemptsBle, blockedTotal)}%`, background: C.violet }} />
                <div style={{ width: `${pct(campus.blockedGateAttemptsQr, blockedTotal)}%`, background: C.indigo }} />
              </div>
            )}
          </KpiTile>
        </section>
      )}

      {campus && (
        <section className="space-y-5" aria-label="Trends">
          <SectionHeading
            id="aa-trends"
            icon={TrendingUp}
            title="Trends"
            description={`Share of expected students who checked in, against the ${target}% target.`}
          />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel
              title="Daily attendance"
              icon={Activity}
              description="Last 21 days that had classes. Weekends are shaded and shown as grey points."
              actions={<ViewToggle value={trendView} onChange={setTrendView} />}
            >
              {!trendHasData ? (
                <Empty title="Not enough days with classes yet." description="This fills in as sessions are held." />
              ) : trendView === 'chart' ? (
                <div className="h-[280px] px-3 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendLineData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id={`${uid}-trendArea`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.indigo} stopOpacity={0.32} />
                          <stop offset="100%" stopColor={C.indigo} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`${uid}-trendLine`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={C.indigo} />
                          <stop offset="100%" stopColor={C.violet} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} minTickGap={12} />
                      <YAxis domain={[0, 100]} width={44} tick={axisTick} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number | undefined) => [`${v}%`, 'Attendance']} />
                      {trendLineData.filter((p) => p.isWeekend).map((p) => (
                        <ReferenceArea key={p.date} x1={p.date} x2={p.date} fill="#94a3b8" fillOpacity={0.12} ifOverflow="visible" />
                      ))}
                      <ReferenceLine
                        y={target}
                        stroke={C.slate}
                        strokeDasharray="6 6"
                        strokeOpacity={0.8}
                        label={{ value: `Target ${target}%`, position: 'insideTopRight', fill: C.slate, fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${uid}-trendArea)`} isAnimationActive={false} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={`url(#${uid}-trendLine)`}
                        strokeWidth={2.5}
                        dot={(props: { cx?: number; cy?: number; payload?: { isWeekend?: boolean } }) => {
                          const { cx, cy, payload } = props;
                          if (cx === undefined || cy === undefined) return <Fragment />;
                          return payload?.isWeekend
                            ? <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={C.slate} stroke="#fff" strokeWidth={1.5} />
                            : <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill={C.indigo} stroke="#fff" strokeWidth={1.5} />;
                        }}
                        activeDot={{ r: 6, fill: C.violet, stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <DataTable
                  rows={[...trendLineData].reverse()}
                  rowKey={(r) => r.iso}
                  empty="No days yet."
                  query=""
                  columns={[
                    { key: 'iso', label: 'Day', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{formatSessionDayLabel(r.iso)}{r.isWeekend && <span className="ml-2 text-xs text-slate-400">weekend</span>}</span> },
                    { key: 'value', label: 'Attendance', render: (r) => <RateCell rate={r.value} target={target} /> },
                  ]}
                  highlight={(r) => (rateHealth(r.value, target) === 'bad' ? 'bad' : null)}
                  noun="days"
                />
              )}
            </Panel>

            <Panel
              title="Weekly participation"
              icon={BarChart3}
              description="Week 1 is the week of the first session held; up to 12 weeks."
              actions={<ViewToggle value={weekView} onChange={setWeekView} />}
            >
              {!weekHasData ? (
                <Empty title="No weeks with classes yet." />
              ) : weekView === 'chart' ? (
                <div className="h-[280px] px-3 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={campus.attendanceDecayByWeek} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id={`${uid}-weekFill`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.indigo} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={C.indigo} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="weekLabel" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.replace('Week ', 'W')} />
                      <YAxis domain={[0, 100]} width={44} tick={axisTick} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number | undefined, _n, p) => [
                          `${v}% · ${p.payload.volumePresent}/${p.payload.volumeEligible} present`,
                          'Attendance',
                        ]}
                      />
                      <ReferenceLine
                        y={target}
                        stroke={C.slate}
                        strokeDasharray="6 6"
                        strokeOpacity={0.8}
                        label={{ value: `Target ${target}%`, position: 'insideTopRight', fill: C.slate, fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="pct" stroke={C.indigo} strokeWidth={2.5} fill={`url(#${uid}-weekFill)`} dot={{ r: 3, fill: C.indigo, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.indigo, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <DataTable
                  rows={campus.attendanceDecayByWeek}
                  rowKey={(r) => r.weekLabel}
                  empty="No weeks yet."
                  query=""
                  columns={[
                    { key: 'weekLabel', label: 'Week', value: (r) => Number(r.weekLabel.replace(/\D/g, '')), render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.weekLabel}</span> },
                    { key: 'pct', label: 'Attendance', render: (r) => (r.volumeEligible ? <RateCell rate={r.pct} target={target} /> : <span className="text-xs text-slate-400">No classes</span>) },
                    { key: 'volumePresent', label: 'Present', align: 'right' },
                    { key: 'volumeEligible', label: 'Expected', align: 'right' },
                  ]}
                  highlight={(r) => (r.volumeEligible && rateHealth(r.pct, target) === 'bad' ? 'bad' : null)}
                  noun="weeks"
                />
              )}
              <div className="flex items-center gap-4 border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-500 dark:border-white/5 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: C.indigo }} aria-hidden /> Weekly attendance</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: C.slate }} aria-hidden /> Target {target}%</span>
              </div>
            </Panel>
          </div>

          <UnitComparisonChart />
        </section>
      )}

      {campus && (
        <section className="space-y-5" aria-label="Needs attention">
          <SectionHeading
            id="aa-attention"
            icon={ShieldAlert}
            title="Needs attention"
            description="Students under the attendance target, and sessions where nobody checked in."
          />
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <Panel
              title="Watch list"
              icon={Users}
              count={campus.atRiskStudents.length}
              description={<>Approved students under {target}%. <HealthPill health="bad">Under 60%</HealthPill> rows are the most urgent.</>}
            >
              <DataTable
                rows={campus.atRiskStudents}
                rowKey={(s) => `${s.id}-${s.studentId}`}
                empty={`No students under ${target}% in this scope.`}
                emptyIcon={CheckCircle2}
                searchPlaceholder="Search name or ID…"
                initialSort={{ key: 'attendancePct', dir: 'asc' }}
                highlight={(s) => (s.attendancePct < 60 ? 'bad' : 'warn')}
                noun="students"
                columns={[
                  {
                    key: 'displayName',
                    label: 'Student',
                    render: (s) => (
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-white">{s.displayName}</p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{s.studentId}</p>
                      </div>
                    ),
                    value: (s) => `${s.displayName} ${s.studentId}`,
                  },
                  { key: 'attendancePct', label: 'Attendance', render: (s) => <RateCell rate={s.attendancePct} target={target} /> },
                  {
                    key: 'actions',
                    label: 'Actions',
                    align: 'right',
                    sortable: false,
                    value: () => '',
                    render: (s) => (
                      <div className="flex justify-end gap-1">
                        <button type="button" title="View profile" aria-label={`View ${s.displayName}'s profile`} onClick={() => navigate(`/admin/users/${s.id}`)} className={iconBtn}>
                          <UserRound size={15} />
                        </button>
                        <button
                          type="button"
                          title="Send attendance warning"
                          aria-label={`Send ${s.displayName} an attendance warning`}
                          disabled={warningSending === s.id}
                          onClick={() => void handleSendWarning(s.id, s.displayName, s.attendancePct, campus.attendanceThreshold)}
                          className={clsx(iconBtn, 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white')}
                        >
                          {warningSending === s.id ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </Panel>

            <Panel
              title="Sessions with no check-ins"
              icon={DoorOpen}
              count={campus.unloggedSessions.length}
              description="Past 60 days — students were enrolled but nobody checked in. Confirm the class ran, or that check-in was open."
            >
              <DataTable
                rows={campus.unloggedSessions}
                rowKey={(u) => u.id}
                empty="Every session in scope had at least one check-in."
                emptyIcon={CheckCircle2}
                searchPlaceholder="Search session, course or lecturer…"
                initialSort={{ key: 'dateIso', dir: 'desc' }}
                highlight={() => 'warn'}
                noun="sessions"
                columns={[
                  {
                    key: 'title',
                    label: 'Session',
                    render: (u) => (
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white">{u.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{u.lecturerName}</p>
                      </div>
                    ),
                    value: (u) => `${u.title} ${u.lecturerName}`,
                  },
                  { key: 'courseCode', label: 'Course', render: (u) => <Badge color="gray">{u.courseCode}</Badge> },
                  { key: 'dateIso', label: 'Date', render: (u) => <span className="whitespace-nowrap">{formatSessionDayLabel(u.dateIso)}</span> },
                  { key: 'enrolled', label: 'Enrolled', align: 'right' },
                ]}
              />
            </Panel>
          </div>
        </section>
      )}

      {campus && (
        <section className="space-y-5" aria-label="Rooms and timing">
          <SectionHeading
            id="aa-rooms"
            icon={Building2}
            title="Rooms and timing"
            description="When classes happen across the week, and how full each room is against the students expected."
          />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel title="Busiest days and hours" icon={Clock} description="Darker cells mean more class activity at that hour.">
              <Heatmap campus={campus} />
            </Panel>

            <Panel
              title="Room attendance"
              icon={DoorOpen}
              count={rooms.length || undefined}
              description="Checked in ÷ students expected, per room, highest first."
              actions={rooms.length > 0 ? <ViewToggle value={roomView} onChange={setRoomView} /> : undefined}
            >
              {rooms.length === 0 ? (
                <Empty icon={DoorOpen} title="No rooms recorded yet." description="Add a room on courses or sessions to see this." />
              ) : roomView === 'chart' ? (
                <div className="max-h-[340px] space-y-3.5 overflow-y-auto px-5 py-4">
                  {rooms.map((r) => {
                    const h = rateHealth(r.pct, target);
                    return (
                      <div key={r.room}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-slate-800 dark:text-slate-100">{r.room}</span>
                          <span className="flex flex-shrink-0 items-center gap-2 tabular-nums text-slate-500 dark:text-slate-400">
                            {r.checkedInTotal.toLocaleString()}/{r.enrolledTotal.toLocaleString()}
                            <span className={clsx('w-9 text-right font-semibold', HEALTH[h].text)}>{r.pct}%</span>
                          </span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-white/10">
                          <div className={clsx('h-full rounded-full', HEALTH[h].bar)} style={{ width: `${Math.max(1, Math.min(100, r.pct))}%` }} />
                          <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-slate-500/60 dark:bg-slate-300/60" style={{ left: `${target}%` }} title={`Target ${target}%`} aria-hidden />
                        </div>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">The small tick on each bar marks the {target}% target.</p>
                </div>
              ) : (
                <DataTable
                  rows={rooms}
                  rowKey={(r) => r.room}
                  empty="No rooms."
                  searchPlaceholder="Search rooms…"
                  initialSort={{ key: 'pct', dir: 'desc' }}
                  highlight={(r) => (rateHealth(r.pct, target) === 'bad' ? 'bad' : null)}
                  noun="rooms"
                  columns={[
                    { key: 'room', label: 'Room', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.room}</span> },
                    { key: 'pct', label: 'Attendance', render: (r) => <RateCell rate={r.pct} target={target} /> },
                    { key: 'checkedInTotal', label: 'Checked in', align: 'right' },
                    { key: 'enrolledTotal', label: 'Expected', align: 'right' },
                  ]}
                />
              )}
            </Panel>
          </div>
        </section>
      )}

      <section className="space-y-5" aria-label="Session ledger">
        <SectionHeading
          id="aa-ledger"
          icon={Layers}
          title="Session ledger"
          description={`Every session${periodDays ? ` in the last ${periodDays} days` : ''}, with how students checked in.`}
        />
        <div className={clsx(cardShell, 'overflow-hidden')}>
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="search"
                  placeholder="Search session or course…"
                  aria-label="Search session or course"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); coursePaging.reset(); }}
                  className="w-full min-w-[240px] rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10" role="group" aria-label="Group sessions">
                {([['course', 'By course', Layers], ['session', 'All sessions', List]] as const).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLedgerMode(k)}
                    aria-pressed={ledgerMode === k}
                    className={clsx(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                      ledgerMode === k ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                    )}
                  >
                    <Icon size={13} aria-hidden /> {label}
                  </button>
                ))}
              </div>
              {ledgerMode === 'course' && (
                <>
                  <select
                    value={ledgerSort}
                    onChange={(e) => { setLedgerSort(e.target.value as typeof ledgerSort); coursePaging.reset(); }}
                    className={clsx(selectClass, '!py-1.5 text-xs')}
                    aria-label="Sort courses"
                  >
                    <option value="code">Course code A–Z</option>
                    <option value="rate-asc">Lowest attendance first</option>
                    <option value="rate-desc">Highest attendance first</option>
                    <option value="sessions">Most sessions first</option>
                  </select>
                  {visibleGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCourses((prev) => {
                          const next = new Set(prev);
                          for (const g of visibleGroups) {
                            if (allVisibleOpen) next.delete(g.courseCode); else next.add(g.courseCode);
                          }
                          return next;
                        })
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      {allVisibleOpen ? <ChevronsDownUp size={14} aria-hidden /> : <ChevronsUpDown size={14} aria-hidden />}
                      {allVisibleOpen ? 'Collapse all' : 'Expand all'}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {methodSum > 0 && (
                <div className="flex items-center gap-2" title="How students checked in, across the sessions shown">
                  <div className="flex h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden>
                    <div style={{ width: `${pct(methodTotals.BLE, methodSum)}%`, background: C.violet }} />
                    <div style={{ width: `${pct(methodTotals.QR, methodSum)}%`, background: C.indigo }} />
                    <div style={{ width: `${pct(methodTotals.MANUAL, methodSum)}%`, background: C.slate }} />
                  </div>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.violet }} aria-hidden />Aura {pct(methodTotals.BLE, methodSum)}%</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.indigo }} aria-hidden />QR {pct(methodTotals.QR, methodSum)}%</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.slate }} aria-hidden />Manual {pct(methodTotals.MANUAL, methodSum)}%</span>
                </div>
              )}
              <span className="tabular-nums">
                {ledgerByCourse.length.toLocaleString()} course{ledgerByCourse.length === 1 ? '' : 's'} · {filtered.length.toLocaleString()} session{filtered.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {ledgerMode === 'session' ? (
            <DataTable
              rows={filtered}
              rowKey={(s) => s.id}
              query=""
              empty={rowsError ? 'Sessions could not be loaded.' : 'Nothing matches your filters.'}
              emptyIcon={Activity}
              initialSort={{ key: 'date', dir: 'desc' }}
              highlight={(s) => (s.totalEnrolled > 0 && isHeld(s) ? (rateHealth(s.attendanceRate, target) === 'bad' ? 'bad' : null) : null)}
              noun="sessions"
              columns={[
                {
                  key: 'title',
                  label: 'Session',
                  render: (s) => (
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{s.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.course.name}</p>
                    </div>
                  ),
                  value: (s) => `${s.title} ${s.course.name}`,
                },
                { key: 'course', label: 'Course', value: (s) => s.course.code, render: (s) => <Badge color="gray">{s.course.code}</Badge> },
                { key: 'date', label: 'Date', value: (s) => sessionDate(s).getTime(), render: (s) => <span className="whitespace-nowrap">{format(sessionDate(s), 'MMM d, yyyy')}</span> },
                { key: 'lecturer', label: 'Lecturer', value: (s) => `${s.course.lecturer.firstName} ${s.course.lecturer.lastName}`, render: (s) => <span className="whitespace-nowrap">{s.course.lecturer.firstName} {s.course.lecturer.lastName}</span> },
                { key: 'present', label: 'Present', align: 'right', value: (s) => s.totalCheckedIn, render: (s) => <span className="text-slate-900 dark:text-white">{s.totalCheckedIn}<span className="text-slate-400"> / {s.totalEnrolled}</span></span> },
                { key: 'attendanceRate', label: 'Rate', value: (s) => (isHeld(s) ? s.attendanceRate : null), render: (s) => <SessionRate s={s} target={target} /> },
                { key: 'methods', label: 'Methods', sortable: false, value: () => '', align: 'right', render: (s) => <MethodChips s={s} /> },
              ]}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                    <tr>
                      <th className={clsx(thClass, 'w-12 !pr-0 text-right')}>#</th>
                      <th className={thClass}>Course / session</th>
                      <th className={thClass}>Lecturer</th>
                      <th className={clsx(thClass, '!text-right')}>Present</th>
                      <th className={thClass}>Rate</th>
                      <th className={clsx(thClass, '!text-right')}>Methods</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {visibleGroups.map((group, gi) => {
                      const isOpen = expandedCourses.has(group.courseCode);
                      const h = group.totalEnrolled > 0 ? rateHealth(group.aggregateRate, target) : null;
                      return (
                        <Fragment key={group.courseCode}>
                          <tr
                            onClick={() => toggleCourseGroup(group.courseCode)}
                            className={clsx(
                              'cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.04]',
                              isOpen && 'bg-slate-50/80 dark:bg-white/[0.03]',
                            )}
                          >
                            <td
                              className={clsx(
                                tdClass,
                                'relative !pr-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500',
                                h && h !== 'good' && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
                                h && h !== 'good' && HEALTH[h].edge,
                              )}
                            >
                              {coursePaging.start + gi + 1}
                            </td>
                            <td className={tdClass}>
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={(e) => { e.stopPropagation(); toggleCourseGroup(group.courseCode); }}
                                className="flex cursor-pointer items-center gap-2 text-left"
                              >
                                <ChevronRight size={15} className={clsx('flex-shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-90')} aria-hidden />
                                <span className="font-semibold text-slate-900 dark:text-white">{group.courseName}</span>
                                <Badge color="gray">{group.courseCode}</Badge>
                              </button>
                            </td>
                            <td className={clsx(tdClass, 'text-xs text-slate-500 dark:text-slate-400')}>
                              {group.lecturers.slice(0, 2).join(', ')}{group.lecturers.length > 2 ? ` +${group.lecturers.length - 2}` : ''}
                            </td>
                            <td className={clsx(tdClass, 'text-right tabular-nums')}>
                              <span className="font-semibold text-slate-900 dark:text-white">{group.sessions.length}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400"> session{group.sessions.length === 1 ? '' : 's'}</span>
                              {group.heldCount < group.sessions.length && (
                                <span className="block text-[11px] text-slate-400">{group.sessions.length - group.heldCount} upcoming</span>
                              )}
                            </td>
                            <td className={tdClass}>
                              {group.totalEnrolled > 0 ? (
                                <div className="flex items-center gap-2">
                                  <RateCell rate={group.aggregateRate} target={target} />
                                  {h && <HealthPill health={h} />}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">No sessions held yet</span>
                              )}
                            </td>
                            <td className={tdClass} />
                          </tr>
                          {isOpen && group.sessions.map((s) => (
                            <tr key={s.id} className="border-t border-slate-100/70 bg-white/40 dark:border-white/[0.04] dark:bg-transparent">
                              <td className={tdClass} />
                              <td className={clsx(tdClass, 'pl-10')}>
                                <p className="font-medium text-slate-800 dark:text-slate-100">{s.title}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{format(sessionDate(s), 'EEE, MMM d, yyyy')}</p>
                              </td>
                              <td className={clsx(tdClass, 'whitespace-nowrap text-slate-600 dark:text-slate-300')}>
                                {s.course.lecturer.firstName} {s.course.lecturer.lastName}
                              </td>
                              <td className={clsx(tdClass, 'text-right tabular-nums text-slate-900 dark:text-white')}>
                                {s.totalCheckedIn}<span className="text-slate-400"> / {s.totalEnrolled}</span>
                              </td>
                              <td className={tdClass}><SessionRate s={s} target={target} /></td>
                              <td className={clsx(tdClass, 'text-right')}><MethodChips s={s} /></td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                    {ledgerByCourse.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <Empty
                            icon={Activity}
                            title={rowsError ? 'Sessions could not be loaded.' : statsList.length ? 'Nothing matches your filters.' : 'No sessions yet.'}
                            description={statsList.length && !rowsError ? 'Try a longer period, another course, or clear the search.' : undefined}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pager
                page={coursePaging.page}
                pageSize={coursePaging.pageSize}
                total={ledgerByCourse.length}
                onPage={coursePaging.setPage}
                onPageSize={coursePaging.setPageSize}
                noun="courses"
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function SessionRate({ s, target }: { s: ClassAttendanceStat; target: number }) {
  if (!isHeld(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
        <Clock size={11} aria-hidden /> Not held yet
      </span>
    );
  }
  return <RateCell rate={s.attendanceRate} target={target} />;
}

function MethodChips({ s }: { s: ClassAttendanceStat }) {
  const b = s.checkInBreakdown;
  if (b.BLE + b.QR + b.MANUAL === 0) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {b.BLE > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden />Aura {b.BLE}
        </span>
      )}
      {b.QR > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden />QR {b.QR}
        </span>
      )}
      {b.MANUAL > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />Manual {b.MANUAL}
        </span>
      )}
    </div>
  );
}

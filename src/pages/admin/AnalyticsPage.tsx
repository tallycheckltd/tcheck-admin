import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, Users, LogIn, UserCheck, CalendarCheck, LogOut, KeyRound, Smartphone, UserX,
  RefreshCw, Lock, Unlock, RotateCcw, History, ShieldX, BookOpen, LifeBuoy, Siren, Radio,
  BarChart3, AlertTriangle, CheckCircle2, School, ArrowLeft, ArrowUp, ArrowDown, Target,
  Repeat, XCircle, MapPinOff, SlidersHorizontal, X, Eye, EyeOff, ChevronDown, ChevronUp,
  Table2, Download, Maximize2, Minimize2, LayoutGrid, Funnel, Check, UserPlus, Camera, ShieldCheck,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, TrendingUp, Lightbulb, GraduationCap, Clock, Timer,
  Grid3x3, FileText, FileSpreadsheet, Signal, GitCompare, PieChart as PieIcon, UsersRound,
} from 'lucide-react';
import {
  BarChart, Bar, ComposedChart, Line, LineChart, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import {
  pilotAnalyticsPath, fetchPilotAudit, unlockStudentPin, resetStudentPin, PILOT_SCHOOLS_PATH,
  FAILURE_REASON_LABEL, AUDIT_EVENT_LABEL, DEVICE_EVENT_LABEL, DEVICE_CHANGE_REASON_LABEL, CHECKIN_CHANNEL_LABEL,
  type PilotAnalytics, type PilotAuditEvent, type PilotSchoolsSummary, type PilotSchoolRow,
} from '../../lib/pilotAnalytics';
import {
  useAnalyticsLayout, downloadCsv, WIDGETS, KPIS, PRESETS, GROUP_LABEL, widgetById,
  type WidgetDef, type WidgetGroup, type WidgetSize, type WidgetView,
} from '../../lib/analyticsLayout';
import {
  deriveTrends, buildInsights, autoGrain, grainLabel, AT_RISK, DOW_LABEL, GRAIN_LABEL,
  type Grain, type Insight, type StudentRow, type CourseRow,
} from '../../lib/analyticsInsights';
import { reportSections, downloadReportCsv, downloadReportPdf } from '../../lib/analyticsReport';

/*
 * Analytics (was "Pilot analytics", 11-02). The page is built from sections the viewer picks:
 * a preset to start from, then show/hide, reorder, half or full width, chart or table, and which
 * headline numbers to show. The layout is remembered per user (lib/analyticsLayout.ts). Every table
 * can be searched, sorted and downloaded as CSV.
 */

const REFRESH_MS = 60_000;
/** The beacon threshold the pilot ships with — used when no class in the period carries its own. */
const DEFAULT_RSSI_THRESHOLD = -95;

const PERIODS = [
  { days: 1, label: 'Today', text: 'today' },
  { days: 7, label: '7 days', text: 'last 7 days' },
  { days: 30, label: '30 days', text: 'last 30 days' },
  { days: 90, label: '3 months', text: 'last 3 months' },
  { days: 182, label: '6 months', text: 'last 6 months' },
  { days: 365, label: '1 year', text: 'last 12 months' },
] as const;

/** Same palette as AttendanceAnalyticsPage so the two analytics screens read as one product. */
const C = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  slate: '#64748b',
  grid: 'rgba(148, 163, 184, 0.22)',
};

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.92)',
  fontSize: 12,
  color: '#f1f5f9',
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
};
const axisTick = { fontSize: 10, fill: '#94a3b8' };

const cardShell =
  'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] shadow-[var(--app-shadow)] dark:border-white/10 dark:bg-gradient-to-br dark:from-white/[0.07] dark:to-white/[0.02]';
const thClass = 'text-left py-2.5 px-4 font-semibold';
const tdClass = 'py-3 px-4';
const pillBtn =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800';
const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white';

const WIDGET_ICON: Record<string, typeof Activity> = {
  schools: School, kpis: LayoutGrid, 'needs-help': Lock, funnel: Funnel, 'checkin-outcomes': Target,
  'checkins-per-day': CalendarCheck, 'checkin-failures': MapPinOff, rssi: Radio, classes: BookOpen,
  'signins-per-day': LogIn, 'signin-failures': KeyRound, audit: History, 'device-events': ShieldX,
  'phone-models': Smartphone, 'closed-accounts': UserX, tickets: LifeBuoy, escalations: Siren,
  insights: Lightbulb, 'period-compare': GitCompare, 'attendance-trend': TrendingUp, 'onboarding-trend': UsersRound,
  'failure-trend': AlertTriangle, courses: GraduationCap, 'students-at-risk': Users, 'attendance-distribution': PieIcon,
  'checkin-times': Clock, lateness: Timer, heatmap: Grid3x3, 'rssi-trend': Signal, 'signin-trend': KeyRound,
};

/** Series colours for "split by reason" charts, in order of size. */
const SERIES = [C.rose, C.amber, C.violet, C.sky, C.cyan, C.slate];

/* ---- Formatting — every timestamp is rendered in the browser's own timezone (EAT at Moi). ---- */

const fmtTime = (iso: string | null | undefined, pattern = 'd MMM, HH:mm') => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, pattern);
};
/** Relative to the response's own generatedAt rather than Date.now(), so render stays pure. */
const timeAgo = (iso: string | null | undefined, nowMs: number) => {
  if (!iso) return 'Never';
  const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(mins)) return '—';
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
/** "▲ 6 pts vs previous" for rates, "▲ 12% vs previous" for counts. */
const deltaText = (now: number | null | undefined, before: number | null | undefined, rate = false) => {
  if (now == null || before == null) return 'no earlier period to compare';
  if (rate) {
    const d = Math.round((now - before) * 100);
    return d === 0 ? 'same as previous period' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)} pts vs previous`;
  }
  if (!before) return now ? 'new this period' : 'same as previous period';
  const d = Math.round(((now - before) / before) * 100);
  return d === 0 ? 'same as previous period' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs previous`;
};
const labelFor = (map: Record<string, string>, code: string) => map[code] ?? code.replace(/_/g, ' ').toLowerCase();
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((n, r) => n + f(r), 0);

/** Audit `detail` is free-form on the backend — a string, or a small object of extra fields. */
function detailText(detail: unknown): string {
  if (detail == null || detail === '') return '';
  if (typeof detail === 'string') return labelFor(FAILURE_REASON_LABEL, detail);
  if (typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => {
        const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return k === 'reason' ? labelFor(FAILURE_REASON_LABEL, val) : `${k}: ${val}`;
      })
      .join(' · ');
  }
  return String(detail);
}

/** For SIGNIN_FAILED the backend sends the code as both `reason` and `detail` — show it once. */
function auditDetail(e: PilotAuditEvent): string {
  const parts: string[] = [];
  if (e.reason) parts.push(labelFor(FAILURE_REASON_LABEL, e.reason));
  const rest = detailText(e.detail);
  if (rest && !parts.includes(rest)) parts.push(rest);
  return parts.join(' · ');
}

/* ---- Building blocks ---- */

type Health = 'good' | 'warn' | 'bad';
const HEALTH: Record<Health, { label: string; text: string; bar: string; edge: string; dot: string }> = {
  good: { label: 'Good', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', edge: 'before:bg-emerald-500', dot: 'bg-emerald-500' },
  warn: { label: 'Watch', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500', edge: 'before:bg-amber-500', dot: 'bg-amber-500' },
  bad: { label: 'Needs attention', text: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500', edge: 'before:bg-rose-500', dot: 'bg-rose-500' },
};
/** A rate (0–1) judged against "good at or above" and "bad below" lines. */
const rateHealth = (r: number | null | undefined, good: number, bad: number): Health | undefined =>
  r == null ? undefined : r >= good ? 'good' : r < bad ? 'bad' : 'warn';

function KpiTile({
  label, value, hint, icon: Icon, tone = 'blue', alert = false, meter, health, verdict, onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: typeof Activity;
  tone?: 'blue' | 'green' | 'amber' | 'violet' | 'cyan' | 'red' | 'gray';
  alert?: boolean;
  /** 0–1: drawn as a bar under the number (rates and shares). */
  meter?: number | null;
  /** Good / Watch / Needs attention — a coloured edge and a word, so the colour is never the only cue. */
  health?: Health;
  /** One plain sentence on what the number means right now. */
  verdict?: string;
  /** Jump to the section that explains this number. */
  onClick?: () => void;
}) {
  // Static class map — Tailwind can't see interpolated class names (same reason as StatCard.tsx).
  const toneClass = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    violet: 'bg-violet-500/10 text-violet-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    red: 'bg-red-500/10 text-red-500',
    gray: 'bg-gray-500/10 text-gray-500',
  }[alert ? 'red' : tone];
  const h = health ?? (alert ? 'bad' : undefined);
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick, title: 'Show the details' } : {})}
      className={clsx(
        cardShell,
        'relative flex h-full w-full flex-col gap-2 overflow-hidden p-4 text-left',
        h && "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        h && HEALTH[h].edge,
        onClick && 'cursor-pointer transition-shadow hover:ring-2 hover:ring-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className={clsx('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', toneClass)}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums text-gray-900 dark:text-white">{value}</p>
      {meter != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden>
          <div className={clsx('h-full rounded-full', h ? HEALTH[h].bar : 'bg-indigo-500')} style={{ width: `${Math.max(2, Math.min(100, Math.round(meter * 100)))}%` }} />
        </div>
      )}
      {hint && <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{hint}</p>}
      {h && (
        <p className={clsx('mt-auto flex items-center gap-1.5 text-[11px] font-semibold', HEALTH[h].text)}>
          <span className={clsx('h-1.5 w-1.5 rounded-full', HEALTH[h].dot)} aria-hidden />
          {verdict ?? HEALTH[h].label}
        </p>
      )}
    </Wrapper>
  );
}

function ChartBox({ empty, children, title, tall = false }: { empty: boolean; children: ReactNode; title?: string; tall?: boolean }) {
  return (
    // data-chart: the PDF report snapshots every chart on the page under this title.
    <div className={clsx(tall ? 'h-[340px]' : 'h-[280px]', 'p-4')} data-chart={empty ? undefined : title}>
      {empty ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState icon={BarChart3} title="Nothing to show for this period yet." size="sm" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children as ReactElement}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EmptyRow({ cols, title }: { cols: number; title: string }) {
  return (
    <tr>
      <td colSpan={cols}>
        <EmptyState icon={CheckCircle2} title={title} size="sm" />
      </td>
    </tr>
  );
}

/** A plain table for widgets that manage their own rows (lockouts, audit log). */
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.02]">
          <tr>{head.map((h) => <th key={h} className={thClass}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-white/5 dark:text-gray-300">{children}</tbody>
      </table>
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Page controls under a table: rows per page, "1–25 of 120", first / previous / next / last. */
function Pager({
  page, pageSize, total, onPage, onPageSize, hasMore = false, loadingMore = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  /** The server has more rows than are loaded (audit log): Next stays available on the last page. */
  hasMore?: boolean;
  loadingMore?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= PAGE_SIZES[0] && !hasMore) return null;
  const from = total ? page * pageSize + 1 : 0;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5';
  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex items-center gap-2">
        Rows per page
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-1.5">
        <span className="mr-2 tabular-nums">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}{hasMore ? '+' : ''}</span>
        <button type="button" className={btn} onClick={() => onPage(0)} disabled={page === 0} aria-label="First page"><ChevronsLeft size={14} /></button>
        <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <span className="px-1 tabular-nums">Page {page + 1} of {pages}{hasMore ? '+' : ''}</span>
        <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={(page >= pages - 1 && !hasMore) || loadingMore} aria-label="Next page">
          {loadingMore ? <RefreshCw size={13} className="animate-spin" /> : <ChevronRight size={14} />}
        </button>
        <button type="button" className={btn} onClick={() => onPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page"><ChevronsRight size={14} /></button>
      </div>
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** What sorting and CSV use; defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  className?: string;
  align?: 'right';
}

/**
 * The searchable, sortable, downloadable table every list widget uses. Search matches any column's
 * value; clicking a header sorts by it (again to reverse); CSV is what the filters show.
 */
function DataTable<T>({
  rows, columns, empty, filename, searchPlaceholder = 'Search…', toolbar, initialSort, rowKey, highlight, highlightClass, filter,
}: {
  rows: T[];
  columns: Column<T>[];
  empty: string;
  filename: string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowKey: (row: T, i: number) => string;
  highlight?: (row: T) => boolean;
  /** Class for highlighted rows; defaults to the soft red used for problem rows. */
  highlightClass?: string;
  /** An extra filter the widget controls (e.g. "only classes with problems"). */
  filter?: (row: T) => boolean;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const valueOf = (c: Column<T>, r: T) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key] as string | number | null | undefined);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (!filter || filter(r)) && (!needle || columns.some((c) => String(valueOf(c, r) ?? '').toLowerCase().includes(needle))));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, q, sort, filter]);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
    setPage(0);
  };
  // A new search, filter or data refresh that shrinks the list never leaves you on a page past the end.
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visibleRows = shown.slice(current * pageSize, (current + 1) * pageSize);

  const exportCsv = () =>
    downloadCsv(filename, columns.map((c) => ({ key: c.key, label: c.label })), shown.map((r) => Object.fromEntries(columns.map((c) => [c.key, valueOf(c, r)]))));

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {rows.length > 0 && <SearchInput placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="min-w-[200px]" />}
          {toolbar}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="tabular-nums">{shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}</span>
          {shown.length > 0 && (
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-300">
              <Download size={13} /> CSV
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-slate-900">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={clsx(thClass, 'whitespace-nowrap', c.align === 'right' && 'text-right')}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-900 dark:hover:text-white">
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-white/5 dark:text-gray-300">
            {visibleRows.map((r, i) => (
              <tr key={rowKey(r, current * pageSize + i)} className={clsx('align-top', highlight?.(r) ? (highlightClass ?? 'bg-rose-50/60 dark:bg-rose-500/[0.06]') : 'hover:bg-gray-50/50 dark:hover:bg-white/[0.02]')}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx(tdClass, c.className, c.align === 'right' && 'text-right tabular-nums')}>
                    {c.render ? c.render(r) : (valueOf(c, r) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && <EmptyRow cols={columns.length} title={rows.length ? 'Nothing matches your search.' : empty} />}
          </tbody>
        </table>
      </div>
      <Pager page={current} pageSize={pageSize} total={shown.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0); }} />
    </div>
  );
}

/** One section on the page, with the viewer's controls: chart/table, width, collapse, hide. */
function WidgetFrame({
  def, count, view, size, collapsed, onView, onSize, onCollapse, onHide, headerExtra, children,
}: {
  def: WidgetDef;
  count?: number;
  view: WidgetView;
  size: WidgetSize;
  collapsed: boolean;
  onView: (v: WidgetView) => void;
  onSize: (s: WidgetSize) => void;
  onCollapse: () => void;
  onHide: () => void;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const Icon = WIDGET_ICON[def.id] ?? Activity;
  return (
    <section id={`w-${def.id}`} className={clsx(cardShell, 'scroll-mt-24 overflow-hidden', size === 'full' && 'xl:col-span-2')} aria-label={def.title}>
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon size={16} className="text-indigo-500" />
            {def.title}
            {count != null && <Badge color="gray">{count.toLocaleString()}</Badge>}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{def.description}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          {headerExtra}
          {def.chart && (
            <div className="mr-1 inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10" role="group" aria-label="Show as">
              {(['chart', 'table'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onView(v)}
                  aria-pressed={view === v}
                  title={v === 'chart' ? 'Show as chart' : 'Show as table'}
                  className={clsx('inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium', view === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
                >
                  {v === 'chart' ? <BarChart3 size={13} /> : <Table2 size={13} />}
                  <span className="hidden 2xl:inline">{v === 'chart' ? 'Chart' : 'Table'}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className={clsx(iconBtn, 'hidden xl:inline-flex')} onClick={() => onSize(size === 'full' ? 'half' : 'full')} title={size === 'full' ? 'Make half width' : 'Make full width'} aria-label={size === 'full' ? 'Make half width' : 'Make full width'}>
            {size === 'full' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" className={iconBtn} onClick={onCollapse} title={collapsed ? 'Expand' : 'Collapse'} aria-label={collapsed ? 'Expand' : 'Collapse'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button type="button" className={iconBtn} onClick={onHide} title="Hide this section (bring it back from Customize)" aria-label="Hide this section">
            <EyeOff size={15} />
          </button>
        </div>
      </div>
      {!collapsed && children}
    </section>
  );
}

/* ---- Needs help now: wrong-PIN lockouts ---- */

type RowStatus = { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

function LockedStudents({ rows, schoolId, onChanged }: { rows: PilotAnalytics['lockedStudents']; schoolId: string | null; onChanged: () => void }) {
  const [status, setStatus] = useState<Record<string, RowStatus>>({});

  const run = async (userId: string, action: 'unlock' | 'reset', name: string) => {
    if (action === 'reset' && !window.confirm(
      `Reset ${name}'s PIN to 123456?\n\nTheir current PIN will stop working and they'll sign in with 123456 next time.`,
    )) return;
    setStatus((s) => ({ ...s, [userId]: { kind: 'busy' } }));
    try {
      if (action === 'unlock') await unlockStudentPin(userId, schoolId);
      else await resetStudentPin(userId, schoolId);
      setStatus((s) => ({
        ...s,
        [userId]: { kind: 'ok', text: action === 'unlock' ? 'Unlocked — they can try their PIN again.' : 'PIN reset to 123456 and unlocked.' },
      }));
      onChanged();
    } catch (e) {
      setStatus((s) => ({ ...s, [userId]: { kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong' } }));
    }
  };

  // A row that just succeeded drops out of `rows` on the refresh — keep its confirmation visible.
  const doneElsewhere = Object.entries(status).filter(([id, st]) => st.kind === 'ok' && !rows.some((r) => r.id === id));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));

  return (
    <>
      <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-white/5">Unlock lets them try their own PIN again; Reset sets the PIN back to 123456.</p>
      <Table head={['Student ID', 'Name', 'Wrong PINs', 'Locked until', '']}>
        {rows.slice(current * pageSize, (current + 1) * pageSize).map((r) => {
          const st = status[r.id];
          const busy = st?.kind === 'busy';
          return (
            <tr key={r.id} className="align-top hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
              <td className={clsx(tdClass, 'font-mono text-xs')}>{r.studentId}</td>
              <td className={clsx(tdClass, 'font-semibold text-gray-900 dark:text-white')}>{r.name}</td>
              <td className={tdClass}>{r.failedAttempts}</td>
              <td className={clsx(tdClass, 'text-xs text-gray-500')}>{fmtTime(r.lockedUntil)}</td>
              <td className={clsx(tdClass, 'text-right')}>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(r.id, 'unlock', r.name)}
                    className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-600 transition-all hover:bg-green-500 hover:text-white disabled:opacity-50"
                  >
                    <Unlock size={13} /> Unlock
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(r.id, 'reset', r.name)}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 transition-all hover:bg-amber-500 hover:text-white disabled:opacity-50"
                  >
                    <RotateCcw size={13} /> Reset PIN to 123456
                  </button>
                </div>
                {busy && <p className="mt-1 text-xs text-gray-400">Working…</p>}
                {st?.kind === 'ok' && <p className="mt-1 text-xs text-green-600 dark:text-green-400">{st.text}</p>}
                {st?.kind === 'error' && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{st.text}</p>}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && <EmptyRow cols={5} title="Nobody is locked out right now." />}
      </Table>
      <Pager page={current} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0); }} />
      {doneElsewhere.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 px-4 py-3 dark:border-white/5">
          {doneElsewhere.map(([id, st]) => (
            <p key={id} className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 size={12} /> {st.kind === 'ok' ? st.text : ''}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

/* ---- Audit log: paginated by `nextBefore`, filtered by event type + typed student ID ---- */

function AuditLog({ reloadKey, schoolId }: { reloadKey: number; schoolId: string | null }) {
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [events, setEvents] = useState<PilotAuditEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);

  // Debounce the student ID box so each keystroke isn't its own request.
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 400);
    return () => window.clearTimeout(id);
  }, [search]);

  const loadFirstPage = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchPilotAudit({ type, q, schoolId })
      .then((res) => { setEvents(res.events); setNextBefore(res.nextBefore); setPage(0); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the audit log'))
      .finally(() => setLoading(false));
  }, [type, q, schoolId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadFirstPage(); });
    return () => { cancelled = true; };
  }, [loadFirstPage, reloadKey]);

  /** Pages are cut from the events already loaded; stepping past them fetches the next batch first
   * (the server pages by `nextBefore`, 50 at a time), so the list never grows into one long scroll. */
  const goToPage = async (target: number) => {
    let loaded = events;
    let cursor = nextBefore;
    setLoadingMore(true);
    try {
      while (cursor && loaded.length < (target + 1) * pageSize) {
        const res = await fetchPilotAudit({ type, q, before: cursor, schoolId });
        loaded = [...loaded, ...res.events];
        cursor = res.nextBefore;
      }
      setEvents(loaded);
      setNextBefore(cursor);
      setPage(Math.max(0, Math.min(target, Math.ceil(loaded.length / pageSize) - 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more events');
    } finally {
      setLoadingMore(false);
    }
  };
  const pageEvents = events.slice(page * pageSize, (page + 1) * pageSize);

  const tone = (t: string): 'green' | 'red' | 'yellow' | 'blue' | 'gray' =>
    t === 'SIGNIN_OK' ? 'green'
      : t === 'SIGNIN_FAILED' || t === 'PIN_LOCKED' ? 'red'
        : t.startsWith('ACCOUNT_') ? 'gray'
          : t.endsWith('_BY_ADMIN') ? 'blue' : 'yellow';

  const exportCsv = () =>
    downloadCsv('sign-in-audit-log.csv', [
      { key: 'time', label: 'Time' }, { key: 'event', label: 'Event' }, { key: 'typed', label: 'Student ID typed' },
      { key: 'name', label: 'Matched student' }, { key: 'studentId', label: 'Student ID' }, { key: 'ip', label: 'IP' },
      { key: 'phone', label: 'Phone' }, { key: 'detail', label: 'Detail' },
    ], events.map((e) => ({
      time: fmtTime(e.createdAt, 'yyyy-MM-dd HH:mm:ss'), event: labelFor(AUDIT_EVENT_LABEL, e.type), typed: e.studentIdTyped,
      name: e.name, studentId: e.studentId, ip: e.ip, phone: e.deviceModel, detail: auditDetail(e),
    })));

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Filter by event"
            className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white"
          >
            <option value="">All events</option>
            {Object.entries(AUDIT_EVENT_LABEL).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <SearchInput placeholder="Search student ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[200px]" />
        </div>
        {events.length > 0 && (
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
            <Download size={13} /> CSV ({events.length.toLocaleString()} loaded)
          </button>
        )}
      </div>
      {error && <p className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table head={['Time', 'Event', 'Student ID typed', 'Matched student', 'IP', 'Phone', 'Detail']}>
            {pageEvents.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                <td className={clsx(tdClass, 'whitespace-nowrap text-xs text-gray-500')}>{fmtTime(e.createdAt, 'd MMM, HH:mm:ss')}</td>
                <td className={tdClass}><Badge color={tone(e.type)}>{labelFor(AUDIT_EVENT_LABEL, e.type)}</Badge></td>
                <td className={clsx(tdClass, 'font-mono text-xs')}>{e.studentIdTyped ?? '—'}</td>
                <td className={tdClass}>
                  {e.name ? (
                    <>
                      <p className="font-medium text-gray-900 dark:text-white">{e.name}</p>
                      {e.studentId && <p className="text-[10px] text-gray-500">{e.studentId}</p>}
                    </>
                  ) : <span className="text-xs text-gray-400">No match</span>}
                </td>
                <td className={clsx(tdClass, 'font-mono text-xs text-gray-500')}>{e.ip ?? '—'}</td>
                <td className={clsx(tdClass, 'text-xs')}>{e.deviceModel ?? '—'}</td>
                <td className={clsx(tdClass, 'max-w-[260px] text-xs text-gray-500')}>{auditDetail(e) || '—'}</td>
              </tr>
            ))}
            {events.length === 0 && <EmptyRow cols={7} title="No events match these filters." />}
          </Table>
        </div>
      )}
      {!loading && (
        <Pager
          page={page}
          pageSize={pageSize}
          total={events.length}
          hasMore={!!nextBefore}
          loadingMore={loadingMore}
          onPage={(p) => void goToPage(p)}
          onPageSize={(n) => { setPageSize(n); setPage(0); }}
        />
      )}
    </>
  );
}

/* ---- SUPER_ADMIN only: one row of headline numbers per school ---- */

/** A school's state in words: what's wrong, worst first. Severity drives the pill colour. */
function schoolHealth(s: PilotSchoolRow, nowMs: number): { health: Health; issues: { text: string; health: Health }[] } {
  const issues: { text: string; health: Health }[] = [];
  const attempts = (s.signInsToday ?? 0) + (s.failedSignInsToday ?? 0);
  const okRate = attempts ? (s.signInsToday ?? 0) / attempts : null;
  if (attempts >= 5 && okRate != null && okRate < 0.7) issues.push({ text: `Most sign-ins failing today (${s.failedSignInsToday} of ${attempts})`, health: 'bad' });
  else if (attempts >= 5 && okRate != null && okRate < 0.9) issues.push({ text: `Some sign-ins failing today (${s.failedSignInsToday})`, health: 'warn' });
  if ((s.gaveUpThisWeek ?? 0) > 0) issues.push({ text: `${s.gaveUpThisWeek} gave up checking in this week`, health: (s.gaveUpThisWeek ?? 0) >= 10 ? 'bad' : 'warn' });
  const share = s.students ? s.signedIn / s.students : 1;
  if (s.students && share < 0.4) issues.push({ text: `Only ${pct(s.signedIn, s.students)}% of students signed in`, health: share < 0.25 ? 'bad' : 'warn' });
  if (s.openTickets > 0) issues.push({ text: `${s.openTickets} open ticket${s.openTickets === 1 ? '' : 's'}`, health: 'warn' });
  const quietDays = s.lastCheckInAt ? (nowMs - new Date(s.lastCheckInAt).getTime()) / 86_400_000 : Infinity;
  if (s.classesThisWeek > 0 && quietDays > 3) issues.push({ text: s.lastCheckInAt ? 'No check-ins for 3+ days' : 'No check-ins yet', health: 'bad' });
  issues.sort((a, b) => (a.health === b.health ? 0 : a.health === 'bad' ? -1 : 1));
  const health: Health = issues.some((i) => i.health === 'bad') ? 'bad' : issues.length ? 'warn' : 'good';
  return { health, issues };
}

function Meter({ value, health }: { value: number | null; health?: Health }) {
  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" aria-hidden>
      <div className={clsx('h-full rounded-full', health ? HEALTH[health].bar : 'bg-indigo-500')} style={{ width: `${Math.max(value ? 3 : 0, Math.round((value ?? 0) * 100))}%` }} />
    </div>
  );
}

function AllSchools({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { data, loading, error, refetch } = useApi<PilotSchoolsSummary>(PILOT_SCHOOLS_PATH, { refetchWhenVisible: true });

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch({ silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refetch]);

  const schools = useMemo(() => data?.schools ?? [], [data]);
  const nowMs = data ? new Date(data.generatedAt).getTime() : 0;
  const healthOf = useMemo(() => new Map(schools.map((s) => [s.id, schoolHealth(s, nowMs)])), [schools, nowMs]);
  const counts = { good: 0, warn: 0, bad: 0 } as Record<Health, number>;
  healthOf.forEach((h) => { counts[h.health] += 1; });
  const totals = {
    students: sum(schools, (s) => s.students),
    signedIn: sum(schools, (s) => s.signedIn),
    checkInsToday: sum(schools, (s) => s.checkInsToday),
    checkInsThisWeek: sum(schools, (s) => s.checkInsThisWeek),
    activeStudentsThisWeek: sum(schools, (s) => s.activeStudentsThisWeek),
    openTickets: sum(schools, (s) => s.openTickets),
  };
  const rank: Record<Health, number> = { bad: 0, warn: 1, good: 2 };

  const columns: Column<PilotSchoolRow>[] = [
    {
      key: 'name', label: 'School',
      render: (s) => {
        const h = healthOf.get(s.id)!;
        return (
          <div className="min-w-[180px]">
            <div className="flex items-center gap-2">
              <span className={clsx('h-2 w-2 flex-shrink-0 rounded-full', HEALTH[h.health].dot)} aria-hidden />
              <p className={clsx('font-semibold', s.id === selectedId ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-900 dark:text-white')}>{s.name}</p>
            </div>
            <p className="mt-0.5 pl-4 text-[11px] text-gray-500">{s.code} · {s.staff} staff · {s.courses} courses · {s.classesThisWeek} classes this week</p>
            <button
              type="button"
              onClick={() => onSelect(s.id === selectedId ? null : s.id)}
              className={clsx('ml-4 mt-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                s.id === selectedId ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20')}
            >
              {s.id === selectedId ? 'Viewing ✓' : 'View details →'}
            </button>
          </div>
        );
      },
    },
    {
      key: 'health', label: 'Status', value: (s) => rank[healthOf.get(s.id)!.health],
      render: (s) => {
        const h = healthOf.get(s.id)!;
        return (
          <div className="min-w-[190px] max-w-[260px] space-y-1">
            <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
              h.health === 'good' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300'
                : h.health === 'warn' ? 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300')}>
              {h.health === 'good' ? 'Healthy' : HEALTH[h.health].label}
            </span>
            {h.issues.slice(0, 3).map((i) => (
              <p key={i.text} className={clsx('text-[11px] leading-snug', HEALTH[i.health].text)}>• {i.text}</p>
            ))}
          </div>
        );
      },
    },
    {
      key: 'signedIn', label: 'Signed in', value: (s) => pct(s.signedIn, s.students),
      render: (s) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Meter value={s.students ? s.signedIn / s.students : null} health={rateHealth(s.students ? s.signedIn / s.students : null, 0.8, 0.4)} />
            <span className="tabular-nums text-xs font-semibold">{pct(s.signedIn, s.students)}%</span>
          </div>
          <p className="text-[11px] text-gray-500">{s.signedIn.toLocaleString()} of {s.students.toLocaleString()}</p>
        </div>
      ),
    },
    {
      key: 'signInsToday', label: 'Sign-ins today', value: (s) => (s.signInsToday ?? 0) + (s.failedSignInsToday ?? 0),
      render: (s) => {
        const attempts = (s.signInsToday ?? 0) + (s.failedSignInsToday ?? 0);
        const r = attempts ? (s.signInsToday ?? 0) / attempts : null;
        return attempts ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Meter value={r} health={attempts >= 5 ? rateHealth(r, 0.9, 0.7) : undefined} />
              <span className="tabular-nums text-xs font-semibold">{pct(s.signInsToday ?? 0, attempts)}%</span>
            </div>
            <p className="whitespace-nowrap text-[11px] text-gray-500"><span className="text-emerald-600 dark:text-emerald-400">{s.signInsToday ?? 0} ok</span> · <span className={s.failedSignInsToday ? 'text-rose-500' : ''}>{s.failedSignInsToday} failed</span></p>
          </div>
        ) : <span className="text-xs text-gray-400">No attempts</span>;
      },
    },
    {
      key: 'checkInsThisWeek', label: 'Check-ins (week)',
      render: (s) => (
        <div>
          <p className="tabular-nums font-semibold text-gray-900 dark:text-white">{s.checkInsThisWeek.toLocaleString()}</p>
          <p className="whitespace-nowrap text-[11px] text-gray-500">{s.activeStudentsThisWeek.toLocaleString()} students · {s.checkInsToday} today</p>
          <p className={clsx('whitespace-nowrap text-[11px]', (s.gaveUpThisWeek ?? 0) > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-gray-400')}>
            {s.gaveUpThisWeek ?? 0} gave up · {(s.failedCheckInsThisWeek ?? 0).toLocaleString()} failed tries
          </p>
        </div>
      ),
    },
    { key: 'openTickets', label: 'Tickets', align: 'right', render: (s) => <span className={s.openTickets ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-400'}>{s.openTickets}</span> },
    {
      key: 'lastCheckInAt', label: 'Last check-in',
      render: (s) => {
        const recent = s.lastCheckInAt && nowMs - new Date(s.lastCheckInAt).getTime() < 60 * 60 * 1000;
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-500" title={s.lastCheckInAt ? fmtTime(s.lastCheckInAt) : undefined}>
            {recent && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />}
            {timeAgo(s.lastCheckInAt, nowMs)}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      {schools.length > 1 && (
        <div className="grid grid-cols-2 divide-gray-100 border-b border-gray-100 dark:divide-white/5 dark:border-white/5 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          {[
            { label: 'Schools', value: schools.length.toLocaleString(), sub: `${counts.good} healthy · ${counts.warn} to watch · ${counts.bad} need attention` },
            { label: 'Students', value: totals.students.toLocaleString(), sub: `${pct(totals.signedIn, totals.students)}% signed in` },
            { label: 'Check-ins today', value: totals.checkInsToday.toLocaleString() },
            { label: 'Check-ins this week', value: totals.checkInsThisWeek.toLocaleString() },
            { label: 'Active this week', value: totals.activeStudentsThisWeek.toLocaleString(), sub: 'students' },
            { label: 'Open tickets', value: totals.openTickets.toLocaleString() },
          ].map((t) => (
            <div key={t.label} className="px-4 py-3">
              <p className="text-[11px] font-medium text-gray-500">{t.label}</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{t.value}</p>
              {t.sub && <p className="text-[10px] text-gray-500">{t.sub}</p>}
            </div>
          ))}
        </div>
      )}
      {schools.length === 1 && (
        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-white/5">One school so far — its numbers are in Headline numbers below.</p>
      )}
      {error && <p className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-600 dark:text-red-400">Couldn't load schools: {error}</p>}
      {loading && !data ? (
        <div className="flex justify-center py-10"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" /></div>
      ) : (
        <DataTable
          rows={schools}
          columns={columns}
          rowKey={(s) => s.id}
          empty="No schools yet."
          filename="schools.csv"
          searchPlaceholder="Search schools…"
          initialSort={{ key: 'health', dir: 'asc' }}
          highlight={(s) => s.id === selectedId}
          highlightClass="bg-indigo-50/70 dark:bg-indigo-500/10"
        />
      )}
    </div>
  );
}

/* ---- Customize: presets, sections (show / order / width), headline numbers ---- */

function CustomizePanel({
  open, onClose, ctl, isSuperAdmin,
}: {
  open: boolean;
  onClose: () => void;
  ctl: ReturnType<typeof useAnalyticsLayout>;
  isSuperAdmin: boolean;
}) {
  const { layout } = ctl;
  const [tab, setTab] = useState<'sections' | 'numbers'>('sections');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;

  const available = WIDGETS.filter((w) => !w.superAdminOnly || isSuperAdmin);
  const hidden = available.filter((w) => !layout.widgets.includes(w.id));
  const shownDefs = layout.widgets.map(widgetById).filter((w): w is WidgetDef => !!w && (!w.superAdminOnly || isSuperAdmin));
  const groups = Object.keys(GROUP_LABEL) as WidgetGroup[];

  return (
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-label="Customize analytics">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Customize analytics</h2>
            <p className="text-xs text-gray-500">Saved for you on this browser.</p>
          </div>
          <button type="button" className={iconBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Presets */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Start from a view</p>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => ctl.applyPreset(p.id)}
                  className={clsx(
                    'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    layout.preset === p.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5',
                  )}
                >
                  <span className={clsx('mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border', layout.preset === p.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 dark:border-white/20')}>
                    {layout.preset === p.id && <Check size={12} />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">{p.label}</span>
                    <span className="block text-xs text-gray-500">{p.description}</span>
                  </span>
                </button>
              ))}
            </div>
            {layout.preset === 'custom' && <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-300">You're on your own custom layout.</p>}
          </div>

          <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
            {(['sections', 'numbers'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white' : 'text-gray-500')}>
                {t === 'sections' ? `Sections (${shownDefs.length})` : `Headline numbers (${layout.kpis.length})`}
              </button>
            ))}
          </div>

          {tab === 'sections' ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Showing, in this order</p>
                <ul className="space-y-1.5">
                  {shownDefs.map((w, i) => {
                    const size = layout.sizes[w.id] ?? w.size;
                    return (
                      <li key={w.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-white/10">
                        <span className="w-5 text-xs tabular-nums text-gray-400">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{w.title}</span>
                          <span className="block text-[11px] text-gray-500">{GROUP_LABEL[w.group]}</span>
                        </span>
                        <button type="button" className={clsx(iconBtn, 'h-7 w-auto px-1.5 text-[11px] font-medium')} onClick={() => ctl.setSize(w.id, size === 'full' ? 'half' : 'full')} title="Width on wide screens">
                          {size === 'full' ? 'Full' : 'Half'}
                        </button>
                        <button type="button" className={clsx(iconBtn, 'h-7 w-7')} disabled={i === 0} onClick={() => ctl.moveWidget(w.id, -1)} aria-label={`Move ${w.title} up`}><ArrowUp size={14} /></button>
                        <button type="button" className={clsx(iconBtn, 'h-7 w-7')} disabled={i === shownDefs.length - 1} onClick={() => ctl.moveWidget(w.id, 1)} aria-label={`Move ${w.title} down`}><ArrowDown size={14} /></button>
                        <button type="button" className={clsx(iconBtn, 'h-7 w-7')} onClick={() => ctl.toggleWidget(w.id)} aria-label={`Hide ${w.title}`}><EyeOff size={14} /></button>
                      </li>
                    );
                  })}
                  {shownDefs.length === 0 && <li className="text-sm text-gray-500">Nothing is showing. Add a section below.</li>}
                </ul>
              </div>
              {hidden.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Add a section</p>
                  {groups.map((g) => {
                    const inGroup = hidden.filter((w) => w.group === g);
                    if (!inGroup.length) return null;
                    return (
                      <div key={g} className="mb-3">
                        <p className="mb-1 text-[11px] font-semibold text-gray-400">{GROUP_LABEL[g]}</p>
                        <ul className="space-y-1.5">
                          {inGroup.map((w) => (
                            <li key={w.id}>
                              <button type="button" onClick={() => ctl.toggleWidget(w.id)} className="flex w-full items-start gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-left hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-white/15 dark:hover:bg-white/5">
                                <Eye size={14} className="mt-0.5 text-indigo-500" />
                                <span>
                                  <span className="block text-sm font-medium text-gray-900 dark:text-white">{w.title}</span>
                                  <span className="block text-[11px] text-gray-500">{w.description}</span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Tick the numbers you want in the Headline numbers section. They show in the order below.</p>
              {groups.map((g) => {
                const inGroup = KPIS.filter((k) => k.group === g);
                if (!inGroup.length) return null;
                return (
                  <div key={g}>
                    <p className="mb-1.5 text-[11px] font-semibold text-gray-400">{GROUP_LABEL[g]}</p>
                    <div className="space-y-1">
                      {inGroup.map((k) => (
                        <label key={k.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5">
                          <input type="checkbox" checked={layout.kpis.includes(k.id)} onChange={() => ctl.toggleKpi(k.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-gray-800 dark:text-gray-200">{k.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-white/10">
          <button type="button" onClick={ctl.reset} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white">Reset to default</button>
          <button type="button" onClick={onClose} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
        </div>
      </aside>
    </div>
  );
}

/* ---- Trend building blocks (11-04) ---- */

function OldBackendNote() {
  return <p className="p-6 text-center text-sm text-gray-500">This school's server hasn't been updated with trends yet. Refresh after the next backend update.</p>;
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

/** A rate with a small bar, coloured by the at-risk line. */
function RateCell({ r }: { r: number | null | undefined }) {
  if (r == null) return <span className="text-gray-400">—</span>;
  const v = Math.round(r * 100);
  const color = r < 0.5 ? 'bg-rose-500' : r < AT_RISK ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10 sm:inline-block" aria-hidden>
        <span className={clsx('block h-full rounded-full', color)} style={{ width: `${Math.max(3, Math.min(100, v))}%` }} />
      </span>
      <span className={clsx('font-semibold', r < 0.5 ? 'text-rose-600 dark:text-rose-400' : r < AT_RISK ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>{v}%</span>
    </span>
  );
}

/** Our best guess, in words, at why a student's attendance is where it is. */
function studentReason(s: StudentRow): string {
  if (s.rate >= AT_RISK) return 'Attending';
  if (s.pinLocked) return 'Locked out of the app (wrong PIN)';
  if (!s.signedIn) return 'Never signed in on a phone';
  if (!s.baseline) return 'Signed in, but no baseline photo';
  if (s.failedAttempts > 0 && s.attended === 0) return 'Tries to check in but it always fails';
  if (s.failedAttempts > 0) return 'Some check-ins fail';
  if (s.attended === 0) return 'Set up, but never tried to check in';
  return 'Missing classes';
}

const SEV_STYLE: Record<Insight['severity'], { edge: string; icon: typeof Activity; tone: string; label: string }> = {
  bad: { edge: 'border-l-rose-500', icon: XCircle, tone: 'text-rose-600 dark:text-rose-400', label: 'Needs attention' },
  warn: { edge: 'border-l-amber-500', icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-400', label: 'Watch' },
  good: { edge: 'border-l-emerald-500', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400', label: 'Good' },
};

function Insights({ items, onJump }: { items: Insight[]; onJump: (id: string) => void }) {
  return (
    <ol className="grid gap-3 p-4 lg:grid-cols-2">
      {items.map((i, n) => {
        const st = SEV_STYLE[i.severity];
        const Icon = st.icon;
        return (
          <li key={n} className={clsx('flex gap-3 rounded-xl border border-l-4 border-gray-100 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.03]', st.edge)}>
            <Icon size={18} className={clsx('mt-0.5 flex-shrink-0', st.tone)} />
            <div className="min-w-0 flex-1">
              <p className={clsx('text-[10px] font-semibold uppercase tracking-wider', st.tone)}>{st.label}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{i.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{i.detail}</p>
              {i.widget && (
                <button type="button" onClick={() => onJump(i.widget!)} className="mt-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                  See the detail →
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Heatmap({ heat, max, hours }: { heat: Map<string, number>; max: number; hours: number[] }) {
  if (!max) return <div className="p-6"><EmptyState icon={BarChart3} title="Nothing to show for this period yet." size="sm" /></div>;
  return (
    <div className="overflow-x-auto p-4">
      <table className="border-separate border-spacing-1 text-[10px]">
        <thead>
          <tr>
            <th />
            {hours.map((h) => <th key={h} className="w-7 font-medium text-gray-400">{String(h).padStart(2, '0')}</th>)}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <tr key={d}>
              <th className="pr-2 text-right font-medium text-gray-500">{DOW_LABEL[d]}</th>
              {hours.map((h) => {
                const v = heat.get(`${d}-${h}`) ?? 0;
                return (
                  <td key={h} title={`${DOW_LABEL[d]} ${String(h).padStart(2, '0')}:00 — ${v} check-ins`}
                    className="h-7 w-7 rounded-md text-center tabular-nums"
                    style={{ background: v ? `rgba(99,102,241,${0.12 + 0.88 * (v / max)})` : 'rgba(148,163,184,0.1)', color: v / max > 0.55 ? '#fff' : '#64748b' }}>
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Day / Week / Month for every chart over time. Grouping a single day makes no sense, so it hides on Today. */
function GrainSwitch({ value, onChange, days, compact = false }: { value: Grain; onChange: (g: Grain) => void; days: number; compact?: boolean }) {
  if (days <= 1) return null;
  return (
    <div className={clsx('inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-white/15 dark:bg-slate-900/60', compact && '!rounded-lg !p-0.5 shadow-none')} role="group" aria-label="Group by">
      {(['day', 'week', 'month'] as const).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          aria-pressed={value === g}
          disabled={g === 'month' && days < 28}
          title={`Group by ${GRAIN_LABEL[g].toLowerCase()}`}
          className={clsx(
            'rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35',
            compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm',
            value === g ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
          )}
        >
          {compact ? GRAIN_LABEL[g][0] : `By ${GRAIN_LABEL[g].toLowerCase()}`}
        </button>
      ))}
    </div>
  );
}

/* ---- Page ---- */

export function AnalyticsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const ctl = useAnalyticsLayout(user?.id);
  const { layout } = ctl;
  const days = layout.days;
  const [customizing, setCustomizing] = useState(false);
  const [classFilter, setClassFilter] = useState<'all' | 'problems' | 'upcoming'>('all');

  // SUPER_ADMIN picks a school from the All schools table; it lives in the URL so a refresh or a
  // shared link keeps it. Ignored for everyone else — the backend pins them to their own school.
  const [searchParams, setSearchParams] = useSearchParams();
  const schoolId = isSuperAdmin ? searchParams.get('schoolId') : null;
  const selectSchool = (id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('schoolId', id); else next.delete('schoolId');
      return next;
    });
  };

  const [auditReloadKey, setAuditReloadKey] = useState(0);
  const { data, loading, error, refetch } = useApi<PilotAnalytics>(pilotAnalyticsPath(days, schoolId), { refetchWhenVisible: true });

  // Auto-refresh every 60 s, but only while the tab is actually visible — useApi's own interval
  // keeps firing in a background tab, which is wasted load on the pilot backend.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch({ silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refetch]);

  const refreshAll = () => {
    void refetch();
    setAuditReloadKey((k) => k + 1);
  };
  // After an unlock/reset: quiet refresh of the numbers, and the audit log picks up the admin event.
  const afterPinAction = () => {
    void refetch({ silent: true });
    setAuditReloadKey((k) => k + 1);
  };

  const k = data?.kpis;
  const periodLabel = PERIODS.find((p) => p.days === days)?.text ?? `last ${days} days`;
  // Charts over time are drawn per day, week or month; a new period starts from its natural choice.
  const [grainPick, setGrainPick] = useState<Grain | null>(null);
  const grain: Grain = grainPick ?? autoGrain(days);
  const fmtB = (key: string) => grainLabel(key, grain);
  // Classes can each carry their own threshold; show the most common one, else the pilot default.
  const thresholdCounts = new Map<number, number>();
  for (const c of data?.classes ?? []) {
    if (c.rssiThreshold != null) thresholdCounts.set(c.rssiThreshold, (thresholdCounts.get(c.rssiThreshold) ?? 0) + 1);
  }
  const rssiThreshold = [...thresholdCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_RSSI_THRESHOLD;
  const rssiData = [...(data?.rssiBuckets ?? [])].sort((a, b) => a.rssi - b.rssi).map((b) => ({ ...b, label: `${b.rssi}` }));
  const thresholdBucket = rssiData.find((b) => rssiThreshold >= b.rssi && rssiThreshold < b.rssi + 5);
  const failureData = (data?.failureReasons ?? [])
    .map((f) => ({ ...f, label: labelFor(FAILURE_REASON_LABEL, f.reason) }))
    .sort((a, b) => b.count - a.count);
  const generatedMs = data ? new Date(data.generatedAt).getTime() : 0;
  const openTickets = (data?.tickets ?? []).filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));
  const checkInFailures = [...(data?.checkInFailureReasons ?? [])].sort((a, b) => b.count - a.count);
  const modelData = [...(data?.deviceModels ?? [])].sort((a, b) => b.count - a.count).map((m) => ({ ...m, label: m.model || 'Unknown' }));
  // Trends and findings, worked out once per response (lib/analyticsInsights.ts).
  const t = useMemo(() => (data ? deriveTrends(data, grain) : null), [data, grain]);
  const checkInData = (t?.checkoutByDay ?? []).map((d) => ({ ...d, label: fmtB(d.day) }));
  const signInData = (t?.signInsByDay ?? []).map((d) => ({ ...d, label: fmtB(d.day) }));
  const outcomeData = (t?.checkInOutcomes ?? []).map((d) => ({ ...d, label: fmtB(d.day) }));
  const insights = useMemo(() => (data && t ? buildInsights(data, t) : []), [data, t]);
  const [studentFilter, setStudentFilter] = useState<'risk' | 'none' | 'failing' | 'all'>('risk');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  /** Open a section (adding it if hidden) and scroll to it — headline tiles link to their detail. */
  const jumpTo = (id: string) => {
    if (!layout.widgets.includes(id)) ctl.toggleWidget(id);
    window.setTimeout(() => document.getElementById(`w-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  /* The headline numbers the viewer can pick from (Customize → Headline numbers). Each says, in
     words, whether it's good, worth watching or needs attention — colour is never the only cue. */
  const signInAttemptsToday = k ? k.signInsOkToday + k.signInsFailedToday : 0;
  const signInRateToday = k && signInAttemptsToday ? k.signInsOkToday / signInAttemptsToday : null;
  const signedInShare = k && k.students ? k.signedIn / k.students : null;
  const kpiTiles: Record<string, () => ReactNode> = !k ? {} : {
    students: () => <KpiTile label="Students" value={k.students.toLocaleString()} hint="On the school's list" icon={Users} tone="blue" />,
    signedIn: () => {
      const h = rateHealth(signedInShare, 0.8, 0.4);
      return (
        <KpiTile label="Signed in" value={k.signedIn.toLocaleString()} meter={signedInShare} health={h}
          hint={`${pct(k.signedIn, k.students)}% of ${k.students.toLocaleString()} students · ${k.signedInToday} today`}
          verdict={h === 'bad' ? 'Most students haven\'t signed in yet' : h === 'warn' ? 'Sign-up still in progress' : 'Most students are in'}
          icon={LogIn} tone="green" onClick={() => jumpTo('funnel')} />
      );
    },
    signedInToday: () => <KpiTile label="Signed in today" value={k.signedInToday.toLocaleString()} hint="Students who signed in for the first time today" icon={LogIn} tone="green" onClick={() => jumpTo('signins-per-day')} />,
    termsAccepted: () => <KpiTile label="Accepted the terms" value={k.termsAccepted.toLocaleString()} meter={k.students ? k.termsAccepted / k.students : null} hint={`${pct(k.termsAccepted, k.students)}% of students`} icon={ShieldCheck} tone="violet" onClick={() => jumpTo('funnel')} />,
    baselineCaptured: () => <KpiTile label="Baseline photo taken" value={k.baselineCaptured.toLocaleString()} meter={k.students ? k.baselineCaptured / k.students : null} hint={`${pct(k.baselineCaptured, k.students)}% of students`} icon={Camera} tone="cyan" onClick={() => jumpTo('funnel')} />,
    checkInsToday: () => <KpiTile label="Check-ins today" value={k.checkInsToday.toLocaleString()} hint={k.checkInsToday ? 'Students checked in to a class today' : 'None yet today'} icon={CalendarCheck} tone="cyan" onClick={() => jumpTo('checkins-per-day')} />,
    checkInsPeriod: () => <KpiTile label={`Check-ins, ${periodLabel}`} value={k.checkInsPeriod.toLocaleString()} icon={UserCheck} tone="violet" onClick={() => jumpTo('checkins-per-day')} />,
    checkOutRate: () => {
      const h = rateHealth(k.checkOutRate, 0.8, 0.5);
      return <KpiTile label="Check-out rate" value={k.checkOutRate == null ? '—' : `${Math.round(k.checkOutRate * 100)}%`} meter={k.checkOutRate} health={h} hint="Check-ins that also checked out" verdict={h === 'bad' ? 'Many students don\'t check out' : h === 'warn' ? 'Some students don\'t check out' : undefined} icon={LogOut} tone="cyan" onClick={() => jumpTo('classes')} />;
    },
    checkInSuccessRate: () => {
      const h = rateHealth(k.checkInSuccessRate, 0.95, 0.85);
      return <KpiTile label="Check-in success rate" value={k.checkInSuccessRate == null ? '—' : `${Math.round(k.checkInSuccessRate * 100)}%`} meter={k.checkInSuccessRate} health={h} hint={`Students who tried and got in, ${periodLabel}`} verdict={h === 'good' ? 'Almost everyone gets in' : h === 'warn' ? 'Some students can\'t get in' : 'Too many students can\'t get in'} icon={Target} tone="green" onClick={() => jumpTo('checkin-outcomes')} />;
    },
    firstTry: () => {
      const total = (k.checkInFirstTryPeriod ?? 0) + (k.checkInRetriedPeriod ?? 0) + (k.checkInGaveUpPeriod ?? 0);
      return <KpiTile label="Got in first try" value={(k.checkInFirstTryPeriod ?? 0).toLocaleString()} meter={total ? (k.checkInFirstTryPeriod ?? 0) / total : null} hint={`${pct(k.checkInFirstTryPeriod ?? 0, total)}% of attempts, ${periodLabel}`} icon={CheckCircle2} tone="green" onClick={() => jumpTo('checkin-outcomes')} />;
    },
    retried: () => <KpiTile label="Got in after retrying" value={(k.checkInRetriedPeriod ?? 0).toLocaleString()} health={(k.checkInRetriedPeriod ?? 0) > 0 ? 'warn' : undefined} verdict={(k.checkInRetriedPeriod ?? 0) > 0 ? 'Had to try more than once' : undefined} hint={periodLabel} icon={Repeat} tone="amber" onClick={() => jumpTo('checkin-failures')} />,
    gaveUp: () => <KpiTile label="Tried but gave up" value={(k.checkInGaveUpPeriod ?? 0).toLocaleString()} health={(k.checkInGaveUpPeriod ?? 0) > 0 ? 'bad' : 'good'} verdict={(k.checkInGaveUpPeriod ?? 0) > 0 ? 'Never got in — see why' : 'Nobody gave up'} hint={periodLabel} icon={XCircle} tone="gray" onClick={() => jumpTo('checkin-failures')} />,
    failedAttemptsToday: () => <KpiTile label="Failed check-in attempts today" value={(k.checkInFailedAttemptsToday ?? 0).toLocaleString()} health={(k.checkInFailedAttemptsToday ?? 0) > 0 ? 'warn' : undefined} hint={`${(k.checkInFailedAttemptsPeriod ?? 0).toLocaleString()} ${periodLabel}`} icon={MapPinOff} tone="red" onClick={() => jumpTo('checkin-failures')} />,
    failedAttemptsPeriod: () => <KpiTile label={`Failed check-in attempts, ${periodLabel}`} value={(k.checkInFailedAttemptsPeriod ?? 0).toLocaleString()} icon={MapPinOff} tone="red" onClick={() => jumpTo('checkin-failures')} />,
    signInsToday: () => {
      const h = signInAttemptsToday >= 5 ? rateHealth(signInRateToday, 0.9, 0.7) : undefined;
      return (
        <KpiTile
          label="Sign-ins today"
          value={<><span className="text-emerald-600 dark:text-emerald-400">{k.signInsOkToday}</span><span className="text-sm font-medium text-gray-400"> ok · </span><span className={k.signInsFailedToday > 0 ? 'text-rose-500' : ''}>{k.signInsFailedToday}</span><span className="text-sm font-medium text-gray-400"> failed</span></>}
          meter={signInRateToday}
          health={h}
          hint={signInAttemptsToday ? `${pct(k.signInsOkToday, signInAttemptsToday)}% of ${signInAttemptsToday} attempts worked` : 'No attempts yet today'}
          verdict={h === 'bad' ? 'Most sign-ins are failing — see why' : h === 'warn' ? 'Some sign-ins are failing' : undefined}
          icon={KeyRound}
          tone="blue"
          onClick={() => jumpTo('signin-failures')}
        />
      );
    },
    signInSuccessToday: () => {
      const h = signInAttemptsToday >= 5 ? rateHealth(signInRateToday, 0.9, 0.7) : undefined;
      return <KpiTile label="Sign-in success today" value={signInRateToday == null ? '—' : `${Math.round(signInRateToday * 100)}%`} meter={signInRateToday} health={h} hint={`${k.signInsOkToday} of ${signInAttemptsToday} attempts`} verdict={h === 'bad' ? 'Most sign-ins are failing' : undefined} icon={UserPlus} tone="green" onClick={() => jumpTo('signin-failures')} />;
    },
    pinLockedNow: () => <KpiTile label="PIN-locked now" value={k.pinLockedNow} health={k.pinLockedNow > 0 ? 'bad' : 'good'} verdict={k.pinLockedNow > 0 ? 'Needs your help — unlock them' : 'Nobody locked out'} icon={Lock} tone="gray" onClick={() => jumpTo('needs-help')} />,
    pendingDeviceChanges: () => <KpiTile label="Pending phone changes" value={k.pendingDeviceChanges} health={k.pendingDeviceChanges > 0 ? 'warn' : undefined} verdict={k.pendingDeviceChanges > 0 ? 'Waiting in Verification' : undefined} icon={Smartphone} tone="amber" onClick={() => jumpTo('device-events')} />,
    closedAccounts: () => <KpiTile label="Closed accounts" value={k.closedAccounts} hint="Deleted or deactivated" icon={UserX} tone="gray" onClick={() => jumpTo('closed-accounts')} />,
    attendanceRate: () => {
      const r = t?.attendanceRate ?? null;
      const h = t && t.expected ? rateHealth(r, 0.8, 0.6) : undefined;
      return (
        <KpiTile label="Attendance rate" value={r == null ? '—' : `${Math.round(r * 100)}%`} meter={r} health={h}
          hint={t && t.expected ? `${t.attended.toLocaleString()} of ${t.expected.toLocaleString()} seats · ${deltaText(r, t.prevAttendanceRate, true)}` : 'No classes with enrolled students yet'}
          verdict={h === 'bad' ? 'Too many students miss class' : h === 'warn' ? 'Attendance could be better' : h === 'good' ? 'Most students attend' : undefined}
          icon={TrendingUp} tone="green" onClick={() => jumpTo('attendance-trend')} />
      );
    },
    activeStudents: () => <KpiTile label="Students who attended" value={(t?.activeStudents ?? 0).toLocaleString()} meter={t && t.students.length ? t.activeStudents / t.students.length : null} hint={t ? `${pct(t.activeStudents, t.students.length)}% of ${t.students.length.toLocaleString()} with classes, ${periodLabel}` : periodLabel} icon={UserCheck} tone="cyan" onClick={() => jumpTo('students-at-risk')} />,
    atRisk: () => <KpiTile label={`Students under ${Math.round(AT_RISK * 100)}%`} value={(t?.atRisk.length ?? 0).toLocaleString()} health={t ? (t.atRisk.length === 0 ? 'good' : t.atRisk.length / Math.max(1, t.students.length) > 0.3 ? 'bad' : 'warn') : undefined} verdict={t?.atRisk.length ? 'See who and why' : 'Nobody at risk'} hint={t ? `${pct(t.atRisk.length, t.students.length)}% of students with classes` : undefined} icon={AlertTriangle} tone="amber" onClick={() => jumpTo('students-at-risk')} />,
    neverAttended: () => <KpiTile label="Never attended" value={(t?.neverAttended.length ?? 0).toLocaleString()} health={t?.neverAttended.length ? 'bad' : 'good'} verdict={t?.neverAttended.length ? 'Enrolled, but no check-in at all' : 'Everyone attended at least once'} hint={t ? `${t.neverAttended.filter((x) => !x.signedIn).length} of them never signed in` : undefined} icon={UserX} tone="red" onClick={() => { setStudentFilter('none'); jumpTo('students-at-risk'); }} />,
    emptyClasses: () => <KpiTile label="Classes nobody attended" value={(t?.emptyClasses ?? 0).toLocaleString()} health={t?.emptyClasses ? 'warn' : 'good'} hint={t ? `of ${t.classesHeld.toLocaleString()} classes held, ${periodLabel}` : undefined} icon={BookOpen} tone="gray" onClick={() => jumpTo('classes')} />,
    onTime: () => {
      const h = rateHealth(t?.onTimeShare, 0.85, 0.6);
      return <KpiTile label="On-time share" value={t?.onTimeShare == null ? '—' : `${Math.round(t.onTimeShare * 100)}%`} meter={t?.onTimeShare} health={h} hint="Check-ins within 15 min of the start" verdict={h === 'bad' ? 'Most check-ins are late' : h === 'warn' ? 'Many check-ins are late' : undefined} icon={Timer} tone="violet" onClick={() => jumpTo('lateness')} />;
    },
    openTickets: () => <KpiTile label="Open tickets" value={openTickets.length} health={openTickets.length > 0 ? 'warn' : 'good'} verdict={openTickets.length > 0 ? 'Waiting for a reply' : 'All answered'} icon={LifeBuoy} tone="amber" onClick={() => jumpTo('tickets')} />,
  };

  const visible = layout.widgets
    .map(widgetById)
    .filter((w): w is WidgetDef => !!w && (!w.superAdminOnly || isSuperAdmin));

  /** A chart widget's body: the chart, or the same numbers as a table, as the viewer chose. */
  const chartOrTable = <T,>(id: string, empty: boolean, chart: ReactNode, table: { rows: T[]; columns: Column<T>[]; rowKey: (r: T, i: number) => string }, tall = false) =>
    (layout.views[id] ?? 'chart') === 'chart'
      ? <ChartBox empty={empty} title={widgetById(id)?.title} tall={tall}>{chart}</ChartBox>
      : <DataTable rows={table.rows} columns={table.columns} rowKey={table.rowKey} empty="Nothing in this period." filename={`${id}.csv`} />;

  const body = (w: WidgetDef): { node: ReactNode; count?: number } | null => {
    if (!data || !k) return w.id === 'schools' ? { node: <AllSchools selectedId={schoolId} onSelect={selectSchool} /> } : null;
    switch (w.id) {
      case 'schools':
        return { node: <AllSchools selectedId={schoolId} onSelect={selectSchool} /> };
      case 'kpis': {
        const tiles = layout.kpis.filter((id) => kpiTiles[id]);
        // Grouped into bands (Onboarding, Check-ins, Sign-ins & access, …) in the viewer's order within each.
        const bands = (Object.keys(GROUP_LABEL) as WidgetGroup[])
          .map((g) => ({ g, ids: tiles.filter((id) => KPIS.find((x) => x.id === id)?.group === g) }))
          .filter((b) => b.ids.length);
        const BAND_LABEL: Partial<Record<WidgetGroup, string>> = { overview: 'Students & onboarding', signins: 'Sign-ins & access', phones: 'Phones & accounts' };
        return {
          node: tiles.length ? (
            <div className="space-y-5 p-4">
              {bands.map((b) => (
                <div key={b.g}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{BAND_LABEL[b.g] ?? GROUP_LABEL[b.g]}</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{b.ids.map((id) => <div key={id}>{kpiTiles[id]()}</div>)}</div>
                </div>
              ))}
              <p className="text-[11px] text-gray-400">Click a number to see the section behind it.</p>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-gray-500">
              No numbers picked. <button type="button" onClick={() => setCustomizing(true)} className="font-medium text-indigo-600 hover:underline">Choose some</button>
            </div>
          ),
        };
      }
      case 'needs-help':
        return { node: <LockedStudents rows={data.lockedStudents} schoolId={schoolId} onChanged={afterPinAction} />, count: data.lockedStudents.length };
      case 'funnel':
        return {
          node: (
            <div className="space-y-3 p-5">
              {[
                { label: 'Students on the list', value: k.students, color: C.slate },
                { label: 'Signed in at least once', value: k.signedIn, color: C.indigo },
                { label: 'Accepted the terms', value: k.termsAccepted, color: C.violet },
                { label: 'Took their baseline photo', value: k.baselineCaptured, color: C.emerald },
              ].map((step, i, all) => {
                const p = pct(step.value, k.students);
                const lost = i > 0 ? all[i - 1].value - step.value : 0;
                return (
                  <div key={step.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate text-slate-600 dark:text-slate-300">{step.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p}%`, background: step.color }} />
                    </div>
                    <span className="w-32 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {step.value.toLocaleString()} <span className="text-xs text-slate-400">({p}%)</span>
                      {lost > 0 && <span className="block text-[10px] text-rose-500">−{lost.toLocaleString()} from previous step</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ),
        };
      case 'checkin-outcomes':
        return {
          count: sum(outcomeData, (d) => d.firstTry + d.retriedThenIn + d.gaveUp),
          node: chartOrTable('checkin-outcomes', outcomeData.every((d) => d.firstTry + d.retriedThenIn + d.gaveUp + d.failedAttempts === 0), (
            <ComposedChart data={outcomeData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="firstTry" name="First try" stackId="o" fill={C.emerald} />
              <Bar dataKey="retriedThenIn" name="Retried, then got in" stackId="o" fill={C.amber} />
              <Bar dataKey="gaveUp" name="Gave up" stackId="o" fill={C.rose} radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="failedAttempts" name="Failed attempts" stroke={C.violet} strokeWidth={2.5} dot={{ r: 3, fill: C.violet }} isAnimationActive={false} />
            </ComposedChart>
          ), {
            rows: outcomeData, rowKey: (d) => d.day,
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (d) => d.day, render: (d) => d.label },
              { key: 'firstTry', label: 'First try', align: 'right' },
              { key: 'retriedThenIn', label: 'Retried, then in', align: 'right' },
              { key: 'gaveUp', label: 'Gave up', align: 'right' },
              { key: 'failedAttempts', label: 'Failed attempts', align: 'right' },
              { key: 'rate', label: 'Success', align: 'right', value: (d) => pct(d.firstTry + d.retriedThenIn, d.firstTry + d.retriedThenIn + d.gaveUp), render: (d) => `${pct(d.firstTry + d.retriedThenIn, d.firstTry + d.retriedThenIn + d.gaveUp)}%` },
            ],
          }),
        };
      case 'checkins-per-day':
        return {
          count: sum(checkInData, (d) => d.present + d.late + d.other),
          node: chartOrTable('checkins-per-day', checkInData.every((d) => d.present + d.late + d.other === 0), (
            <ComposedChart data={checkInData.map((d) => ({ ...d, checkoutRate: pct(d.withCheckout, d.present + d.late + d.other) }))} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="n" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} formatter={(v, name) => (name === 'Check-out rate' ? `${v}%` : v)} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar yAxisId="n" dataKey="present" name="Present" stackId="c" fill={C.emerald} />
              <Bar yAxisId="n" dataKey="late" name="Late" stackId="c" fill={C.amber} />
              <Bar yAxisId="n" dataKey="other" name="Other" stackId="c" fill={C.slate} radius={[6, 6, 0, 0]} />
              <Line yAxisId="r" type="monotone" dataKey="checkoutRate" name="Check-out rate" stroke={C.violet} strokeWidth={2.5} dot={{ r: 3, fill: C.violet }} isAnimationActive={false} />
            </ComposedChart>
          ), {
            rows: checkInData, rowKey: (d) => d.day,
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (d) => d.day, render: (d) => d.label },
              { key: 'present', label: 'Present', align: 'right' },
              { key: 'late', label: 'Late', align: 'right' },
              { key: 'other', label: 'Other', align: 'right' },
              { key: 'withCheckout', label: 'Checked out', align: 'right' },
              { key: 'total', label: 'Total', align: 'right', value: (d) => d.present + d.late + d.other },
            ],
          }),
        };
      case 'checkin-failures':
        return {
          count: sum(checkInFailures, (r) => r.count),
          node: (
            <DataTable
              rows={checkInFailures}
              rowKey={(r) => `${r.channel}-${r.reason}`}
              filename="check-in-failures.csv"
              empty="No failed check-ins in this period."
              initialSort={{ key: 'count', dir: 'desc' }}
              columns={[
                { key: 'reason', label: 'Reason', className: 'max-w-[420px] text-gray-900 dark:text-white' },
                { key: 'channel', label: 'How', value: (r) => CHECKIN_CHANNEL_LABEL[r.channel] ?? r.channel, render: (r) => <Badge color="gray">{CHECKIN_CHANNEL_LABEL[r.channel] ?? r.channel}</Badge> },
                { key: 'count', label: 'Attempts', align: 'right' },
                { key: 'students', label: 'Students affected', align: 'right' },
                { key: 'share', label: 'Share', align: 'right', value: (r) => pct(r.count, sum(checkInFailures, (x) => x.count)), render: (r) => `${pct(r.count, sum(checkInFailures, (x) => x.count))}%` },
              ]}
            />
          ),
        };
      case 'rssi':
        return {
          node: (
            <>
              <p className="px-4 pt-3 text-xs text-gray-500">Current threshold <b>{rssiThreshold} dBm</b> — weaker (more negative) signals don't count.</p>
              {chartOrTable('rssi', rssiData.length === 0, (
                <BarChart data={rssiData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} labelFormatter={(l) => `${l} to ${Number(l) + 4} dBm`} />
                  {thresholdBucket && (
                    <ReferenceLine x={thresholdBucket.label} stroke={C.rose} strokeDasharray="5 5" label={{ value: `Threshold ${rssiThreshold}`, fill: '#94a3b8', fontSize: 10, position: 'top' }} />
                  )}
                  <Bar dataKey="count" name="Check-ins" radius={[6, 6, 0, 0]}>
                    {rssiData.map((b) => <Cell key={b.rssi} fill={b.rssi + 5 <= rssiThreshold ? C.rose : C.cyan} />)}
                  </Bar>
                </BarChart>
              ), {
                rows: rssiData, rowKey: (b) => String(b.rssi),
                columns: [
                  { key: 'rssi', label: 'Signal (dBm)', render: (b) => `${b.rssi} to ${b.rssi + 4}` },
                  { key: 'count', label: 'Check-ins', align: 'right' },
                  { key: 'under', label: 'Below threshold', value: (b) => (b.rssi + 5 <= rssiThreshold ? 'Yes' : 'No') },
                ],
              })}
            </>
          ),
        };
      case 'classes': {
        const isUpcoming = (c: PilotAnalytics['classes'][number]) => new Date(c.startTime).getTime() > generatedMs;
        const hasProblems = (c: PilotAnalytics['classes'][number]) => (c.failedAttempts ?? 0) > 0 || (c.gaveUp ?? 0) > 0;
        return {
          count: data.classes.length,
          node: (
            <DataTable
              rows={data.classes}
              rowKey={(c) => c.id}
              filename="classes.csv"
              empty="No classes in this period."
              searchPlaceholder="Search course or room…"
              highlight={(c) => (c.gaveUp ?? 0) > 0}
              filter={classFilter === 'problems' ? hasProblems : classFilter === 'upcoming' ? isUpcoming : undefined}
              toolbar={(
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value as typeof classFilter)} aria-label="Which classes" className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white">
                  <option value="all">All classes</option>
                  <option value="problems">Only classes with problems</option>
                  <option value="upcoming">Only upcoming</option>
                </select>
              )}
              columns={[
                {
                  key: 'startTime', label: 'When', className: 'whitespace-nowrap text-xs',
                  render: (c) => <>{fmtTime(c.startTime, 'EEE d MMM, HH:mm')}–{fmtTime(c.endTime, 'HH:mm')}{isUpcoming(c) && <span className="ml-2"><Badge color="blue">Upcoming</Badge></span>}</>,
                },
                {
                  key: 'course', label: 'Course', value: (c) => c.course ?? c.title ?? '',
                  render: (c) => <><p className="font-medium text-gray-900 dark:text-white">{c.course ?? '—'}</p>{c.title && c.title !== c.course && <p className="text-[11px] text-gray-500">{c.title}</p>}</>,
                },
                { key: 'room', label: 'Room', value: (c) => c.room ?? '' },
                { key: 'checkins', label: 'Check-ins', align: 'right' },
                { key: 'checkouts', label: 'Check-outs', align: 'right' },
                { key: 'failedAttempts', label: 'Failed attempts', align: 'right', value: (c) => c.failedAttempts ?? 0, render: (c) => <span className={(c.failedAttempts ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>{c.failedAttempts ?? 0}</span> },
                { key: 'gaveUp', label: 'Gave up', align: 'right', value: (c) => c.gaveUp ?? 0, render: (c) => <span className={(c.gaveUp ?? 0) > 0 ? 'font-semibold text-red-500' : ''}>{c.gaveUp ?? 0}</span> },
                { key: 'rssiThreshold', label: 'Beacon threshold', value: (c) => c.rssiThreshold ?? '', render: (c) => <span className="text-xs">{c.rssiThreshold != null ? `${c.rssiThreshold} dBm` : 'Default'}</span> },
              ]}
            />
          ),
        };
      }
      case 'signins-per-day':
        return {
          count: sum(signInData, (d) => d.ok + d.failed),
          node: chartOrTable('signins-per-day', signInData.every((d) => d.ok + d.failed === 0), (
            <BarChart data={signInData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="ok" name="Signed in" fill={C.indigo} radius={[6, 6, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill={C.rose} radius={[6, 6, 0, 0]} />
            </BarChart>
          ), {
            rows: signInData, rowKey: (d) => d.day,
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (d) => d.day, render: (d) => d.label },
              { key: 'ok', label: 'Signed in', align: 'right' },
              { key: 'failed', label: 'Failed', align: 'right' },
              { key: 'rate', label: 'Success', align: 'right', value: (d) => pct(d.ok, d.ok + d.failed), render: (d) => (d.ok + d.failed ? `${pct(d.ok, d.ok + d.failed)}%` : '—') },
            ],
          }),
        };
      case 'signin-failures':
        return {
          count: sum(failureData, (f) => f.count),
          node: chartOrTable('signin-failures', failureData.length === 0, (
            <BarChart data={failureData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={170} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Bar dataKey="count" name="Attempts" fill={C.rose} radius={[0, 6, 6, 0]} />
            </BarChart>
          ), {
            rows: failureData, rowKey: (f) => f.reason,
            columns: [
              { key: 'label', label: 'Reason' },
              { key: 'count', label: 'Attempts', align: 'right' },
              { key: 'share', label: 'Share', align: 'right', value: (f) => pct(f.count, sum(failureData, (x) => x.count)), render: (f) => `${pct(f.count, sum(failureData, (x) => x.count))}%` },
            ],
          }),
        };
      case 'audit':
        return { node: <AuditLog reloadKey={auditReloadKey} schoolId={schoolId} /> };
      case 'device-events':
        return {
          count: data.deviceEvents.length,
          node: (
            <DataTable
              rows={data.deviceEvents}
              rowKey={(e) => e.id}
              filename="phone-security-events.csv"
              empty="No phone security events in this period."
              searchPlaceholder="Search student or phone…"
              highlight={(e) => e.type === 'CONFLICT_BLOCKED'}
              columns={[
                { key: 'createdAt', label: 'Time', className: 'whitespace-nowrap text-xs text-gray-500', render: (e) => fmtTime(e.createdAt) },
                {
                  key: 'type', label: 'Event', className: 'text-xs', value: (e) => labelFor(DEVICE_EVENT_LABEL, e.type),
                  render: (e) => (
                    <>
                      <span className={e.type === 'CONFLICT_BLOCKED' ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{labelFor(DEVICE_EVENT_LABEL, e.type)}</span>
                      {e.otherStudentId && <p className="text-[11px] text-gray-500">Phone already belongs to {e.otherStudentId}</p>}
                      {e.reason && <p className="text-[11px] text-gray-500">Reason: {labelFor(DEVICE_CHANGE_REASON_LABEL, e.reason)}</p>}
                    </>
                  ),
                },
                { key: 'name', label: 'Student', value: (e) => `${e.name ?? ''} ${e.studentId ?? ''}`.trim(), render: (e) => <><p className="font-medium text-gray-900 dark:text-white">{e.name ?? '—'}</p>{e.studentId && <p className="text-[10px] text-gray-500">{e.studentId}</p>}</> },
                { key: 'deviceModel', label: 'Phone', className: 'text-xs', value: (e) => e.deviceModel ?? '' },
              ]}
            />
          ),
        };
      case 'phone-models':
        return {
          count: modelData.length,
          node: chartOrTable('phone-models', modelData.length === 0, (
            <BarChart data={modelData.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={150} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Bar dataKey="count" name="Students" fill={C.sky} radius={[0, 6, 6, 0]} />
            </BarChart>
          ), {
            rows: modelData, rowKey: (m) => m.label,
            columns: [
              { key: 'label', label: 'Model' },
              { key: 'count', label: 'Students', align: 'right' },
              { key: 'share', label: 'Share', align: 'right', value: (m) => pct(m.count, sum(modelData, (x) => x.count)), render: (m) => `${pct(m.count, sum(modelData, (x) => x.count))}%` },
            ],
          }),
        };
      case 'closed-accounts':
        return {
          count: data.closedAccounts.length,
          node: (
            <DataTable
              rows={data.closedAccounts}
              rowKey={(a) => a.id}
              filename="closed-accounts.csv"
              empty="No closed accounts."
              searchPlaceholder="Search name or ID…"
              initialSort={{ key: 'updatedAt', dir: 'desc' }}
              columns={[
                { key: 'studentId', label: 'Student ID', className: 'font-mono text-xs' },
                { key: 'name', label: 'Name', className: 'font-medium text-gray-900 dark:text-white' },
                { key: 'status', label: 'Status', value: (a) => (a.status === 'DELETED' ? 'Deleted' : a.status === 'DEACTIVATED' ? 'Deactivated' : a.status), render: (a) => <Badge color={a.status === 'DELETED' ? 'red' : 'gray'}>{a.status === 'DELETED' ? 'Deleted' : a.status === 'DEACTIVATED' ? 'Deactivated' : a.status}</Badge> },
                { key: 'updatedAt', label: 'When', className: 'text-xs text-gray-500', render: (a) => fmtTime(a.updatedAt) },
              ]}
            />
          ),
        };
      case 'tickets':
        return {
          count: openTickets.length,
          node: (
            <DataTable
              rows={openTickets}
              rowKey={(t) => t.id}
              filename="open-tickets.csv"
              empty="No open tickets."
              searchPlaceholder="Search subject or student…"
              initialSort={{ key: 'createdAt', dir: 'desc' }}
              columns={[
                { key: 'createdAt', label: 'Opened', className: 'whitespace-nowrap text-xs text-gray-500', render: (t) => fmtTime(t.createdAt) },
                { key: 'subject', label: 'Subject', className: 'text-gray-900 dark:text-white' },
                { key: 'name', label: 'Student', value: (t) => `${t.name ?? ''} ${t.studentId ?? ''}`.trim(), render: (t) => <><p className="font-medium">{t.name ?? '—'}</p>{t.studentId && <p className="text-[10px] text-gray-500">{t.studentId}</p>}</> },
                { key: 'status', label: 'Status', render: (t) => <Badge color={t.status === 'OPEN' ? 'yellow' : 'blue'}>{t.status.replace(/_/g, ' ').toLowerCase()}</Badge> },
              ]}
            />
          ),
        };
      case 'escalations':
        return {
          count: sum(data.escalations, (e) => e.count),
          node: (
            <DataTable
              rows={data.escalations}
              rowKey={(e) => `${e.status}-${e.reason}`}
              filename="escalations.csv"
              empty="No escalations in this period."
              initialSort={{ key: 'count', dir: 'desc' }}
              columns={[
                { key: 'reason', label: 'Reason', value: (e) => e.reason.replace(/_/g, ' ').toLowerCase() },
                { key: 'status', label: 'Status', value: (e) => e.status.replace(/_/g, ' ').toLowerCase(), render: (e) => <Badge color={e.status === 'PENDING' || e.status === 'OPEN' ? 'yellow' : 'gray'}>{e.status.replace(/_/g, ' ').toLowerCase()}</Badge> },
                { key: 'count', label: 'Count', align: 'right' },
              ]}
            />
          ),
        };
      case 'insights':
        return { count: insights.filter((i) => i.severity !== 'good').length, node: t?.hasTrends === false ? <OldBackendNote /> : <Insights items={insights} onJump={jumpTo} /> };
      case 'period-compare':
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        return {
          node: (
            <Table head={['', 'This period', 'Previous period', 'Change']}>
              {t.compare.map((c) => {
                const fmt = (v: number | null) => (v == null ? '—' : c.rate ? `${Math.round(v * 100)}%` : v.toLocaleString());
                const diff = c.now == null || c.before == null ? null : c.now - c.before;
                const good = diff == null || diff === 0 || c.better === 'none' ? null : (diff > 0) === (c.better === 'up');
                return (
                  <tr key={c.metric}>
                    <td className={clsx(tdClass, 'font-medium text-gray-900 dark:text-white')}>{c.metric}</td>
                    <td className={clsx(tdClass, 'tabular-nums')}>{fmt(c.now)}</td>
                    <td className={clsx(tdClass, 'tabular-nums text-gray-500')}>{fmt(c.before)}</td>
                    <td className={clsx(tdClass, 'tabular-nums text-xs font-semibold', good === true && 'text-emerald-600 dark:text-emerald-400', good === false && 'text-rose-600 dark:text-rose-400')}>
                      {deltaText(c.now, c.before, c.rate).replace(' vs previous', '')}
                    </td>
                  </tr>
                );
              })}
            </Table>
          ),
        };
      case 'attendance-trend': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const rows = t.attendanceByDay.map((d) => ({ ...d, label: fmtB(d.day), ratePct: d.rate == null ? null : Math.round(d.rate * 100), missed: Math.max(0, d.expected - d.attended) }));
        return {
          count: t.attended,
          node: (
            <>
              <div className="grid grid-cols-2 gap-3 border-b border-gray-100 px-4 py-3 text-xs dark:border-white/5 md:grid-cols-5">
                <Stat label="Attendance rate" value={t.attendanceRate == null ? '—' : `${Math.round(t.attendanceRate * 100)}%`} sub={deltaText(t.attendanceRate, t.prevAttendanceRate, true)} />
                <Stat label="Seats expected" value={t.expected.toLocaleString()} sub={`${t.classesHeld.toLocaleString()} classes held`} />
                <Stat label="Check-ins" value={t.attended.toLocaleString()} sub={`${Math.max(0, t.expected - t.attended).toLocaleString()} seats missed`} />
                <Stat label="Students who attended" value={t.activeStudents.toLocaleString()} sub={`of ${t.students.length.toLocaleString()} with classes`} />
                <Stat label="Classes nobody attended" value={t.emptyClasses.toLocaleString()} sub={t.classesHeld ? `${pct(t.emptyClasses, t.classesHeld)}% of classes` : ''} />
              </div>
              {chartOrTable('attendance-trend', rows.every((d) => d.expected + d.attended === 0), (
                <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.emerald} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={C.emerald} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="n" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} formatter={(v, name) => (name === 'Attendance rate' ? `${v}%` : v)} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <ReferenceLine yAxisId="r" y={AT_RISK * 100} stroke={C.amber} strokeDasharray="5 5" label={{ value: `${Math.round(AT_RISK * 100)}% target`, fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }} />
                  <Bar yAxisId="n" dataKey="attended" name="Checked in" stackId="s" fill="url(#attFill)" />
                  <Bar yAxisId="n" dataKey="missed" name="Missed seats" stackId="s" fill="rgba(244,63,94,0.35)" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="ratePct" name="Attendance rate" stroke={C.indigo} strokeWidth={3} dot={{ r: 3.5, fill: C.indigo }} connectNulls isAnimationActive={false} />
                  <Line yAxisId="n" type="monotone" dataKey="students" name={grain === 'day' ? 'Students who attended' : 'Students (busiest day)'} stroke={C.cyan} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                </ComposedChart>
              ), {
                rows, rowKey: (d) => d.day,
                columns: [
                  { key: 'label', label: GRAIN_LABEL[grain], value: (d) => d.day, render: (d) => d.label },
                  { key: 'classes', label: 'Classes', align: 'right' },
                  { key: 'expected', label: 'Seats expected', align: 'right' },
                  { key: 'attended', label: 'Checked in', align: 'right' },
                  { key: 'missed', label: 'Missed', align: 'right' },
                  { key: 'ratePct', label: 'Rate', align: 'right', render: (d) => (d.ratePct == null ? '—' : `${d.ratePct}%`) },
                  { key: 'students', label: 'Students', align: 'right' },
                  { key: 'emptyClasses', label: 'Empty classes', align: 'right' },
                ],
              }, true)}
            </>
          ),
        };
      }
      case 'onboarding-trend': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const rows = t.onboarding.map((d) => ({ ...d, label: fmtB(d.day) }));
        return {
          node: chartOrTable('onboarding-trend', rows.length === 0, (
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {[['obS', C.indigo], ['obT', C.violet], ['obB', C.emerald]].map(([id, c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.35} /><stop offset="100%" stopColor={c} stopOpacity={0.02} /></linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} domain={[0, Math.max(1, k.students)]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={k.students} stroke={C.slate} strokeDasharray="5 5" label={{ value: `${k.students} students`, fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }} />
              <Area type="monotone" dataKey="signedIn" name="Signed in" stroke={C.indigo} strokeWidth={2.5} fill="url(#obS)" isAnimationActive={false} />
              <Area type="monotone" dataKey="terms" name="Accepted terms" stroke={C.violet} strokeWidth={2} fill="url(#obT)" isAnimationActive={false} />
              <Area type="monotone" dataKey="baseline" name="Baseline photo" stroke={C.emerald} strokeWidth={2} fill="url(#obB)" isAnimationActive={false} />
            </AreaChart>
          ), {
            rows, rowKey: (d) => d.day,
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (d) => d.day, render: (d) => d.label },
              { key: 'newSignedIn', label: 'New sign-ins', align: 'right' },
              { key: 'signedIn', label: 'Signed in (total)', align: 'right' },
              { key: 'terms', label: 'Terms (total)', align: 'right' },
              { key: 'baseline', label: 'Baseline (total)', align: 'right' },
            ],
          }),
        };
      }
      case 'failure-trend': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const { keys, rows: raw } = t.failureTrend;
        const rows: Record<string, string | number | null>[] = raw.map((r) => ({ ...r, label: fmtB(String(r.day)), total: keys.reduce((n, key) => n + Number(r[key] ?? 0), 0) }));
        return {
          count: sum(rows, (r) => Number(r.total)),
          node: chartOrTable('failure-trend', rows.length === 0, (
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {keys.map((key, i) => (
                <Bar key={key} dataKey={key} name={key} stackId="f" fill={SERIES[i % SERIES.length]} radius={i === keys.length - 1 ? [6, 6, 0, 0] : undefined} />
              ))}
              <Line type="monotone" dataKey="total" name="All failures" stroke={C.indigo} strokeWidth={2.5} dot={{ r: 3, fill: C.indigo }} isAnimationActive={false} />
            </ComposedChart>
          ), {
            rows, rowKey: (r) => String(r.day),
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (r) => String(r.day), render: (r) => r.label },
              ...keys.map((key) => ({ key, label: key, align: 'right' as const, value: (r: (typeof rows)[number]) => Number(r[key] ?? 0) })),
              { key: 'total', label: 'Total', align: 'right' as const },
            ],
          }, true),
        };
      }
      case 'courses': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const chartRows = [...t.courses].filter((c) => c.rate != null).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)).slice(0, 15).map((c) => ({ ...c, ratePct: Math.round((c.rate ?? 0) * 100), latePct: Math.round((c.lateShare ?? 0) * 100) }));
        const view = layout.views.courses ?? 'chart';
        return {
          count: t.courses.length,
          node: (
            <>
              {view === 'chart' && (
                <ChartBox empty={chartRows.length === 0} title="Courses — attendance rate (worst first)" tall>
                  <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="4 8" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="code" width={90} tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} formatter={(v) => `${v}%`} labelFormatter={(l) => chartRows.find((c) => c.code === l)?.name ?? l} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <ReferenceLine x={AT_RISK * 100} stroke={C.amber} strokeDasharray="5 5" />
                    <Bar dataKey="ratePct" name="Attendance" fill={C.emerald} radius={[0, 6, 6, 0]}>
                      {chartRows.map((c) => <Cell key={c.id} fill={c.ratePct < 50 ? C.rose : c.ratePct < AT_RISK * 100 ? C.amber : C.emerald} />)}
                    </Bar>
                    <Bar dataKey="latePct" name="Late share" fill={C.violet} fillOpacity={0.55} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartBox>
              )}
              <DataTable<CourseRow>
                rows={t.courses}
                rowKey={(c) => c.id}
                filename="courses.csv"
                empty="No courses."
                searchPlaceholder="Search course or lecturer…"
                initialSort={{ key: 'rate', dir: 'asc' }}
                highlight={(c) => c.rate != null && c.rate < 0.5}
                columns={[
                  { key: 'code', label: 'Course', render: (c) => <><p className="font-medium text-gray-900 dark:text-white">{c.code}</p><p className="text-[11px] text-gray-500">{c.name}</p></> },
                  { key: 'lecturer', label: 'Lecturer', className: 'text-xs' },
                  { key: 'enrolled', label: 'Enrolled', align: 'right' },
                  { key: 'classesHeld', label: 'Classes', align: 'right' },
                  { key: 'rate', label: 'Attendance', align: 'right', value: (c) => (c.rate == null ? null : Math.round(c.rate * 100)), render: (c) => <RateCell r={c.rate} /> },
                  { key: 'checkins', label: 'Check-ins', align: 'right', render: (c) => <span>{c.checkins}<span className="text-gray-400"> / {c.expected}</span></span> },
                  { key: 'late', label: 'Late', align: 'right', render: (c) => <span>{c.late}{c.lateShare != null && c.checkins > 0 && <span className="text-gray-400"> ({Math.round(c.lateShare * 100)}%)</span>}</span> },
                  { key: 'checkoutShare', label: 'Checked out', align: 'right', value: (c) => (c.checkoutShare == null ? null : Math.round(c.checkoutShare * 100)), render: (c) => (c.checkoutShare == null ? '—' : `${Math.round(c.checkoutShare * 100)}%`) },
                  { key: 'failedAttempts', label: 'Failed', align: 'right', render: (c) => <span className={c.failedAttempts ? 'text-amber-600 dark:text-amber-400' : ''}>{c.failedAttempts}</span> },
                  { key: 'gaveUp', label: 'Gave up', align: 'right', render: (c) => <span className={c.gaveUp ? 'font-semibold text-red-500' : ''}>{c.gaveUp}</span> },
                  { key: 'avgRssi', label: 'Avg signal', align: 'right', render: (c) => (c.avgRssi == null ? '—' : `${c.avgRssi} dBm`) },
                ]}
              />
            </>
          ),
        };
      }
      case 'students-at-risk': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const filters = {
          risk: (s: StudentRow) => s.rate < AT_RISK,
          none: (s: StudentRow) => s.attended === 0,
          failing: (s: StudentRow) => s.failedAttempts > 0,
          all: undefined,
        } as const;
        return {
          count: t.atRisk.length,
          node: (
            <DataTable<StudentRow>
              rows={t.students}
              rowKey={(s) => s.id}
              filename="students-attendance.csv"
              empty="No enrolled students had classes in this period."
              searchPlaceholder="Search name or ID…"
              initialSort={{ key: 'rate', dir: 'asc' }}
              filter={filters[studentFilter]}
              highlight={(s) => s.attended === 0}
              toolbar={(
                <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value as typeof studentFilter)} aria-label="Which students" className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-900/80 dark:text-white">
                  <option value="risk">Under {Math.round(AT_RISK * 100)}% ({t.atRisk.length})</option>
                  <option value="none">Never attended ({t.neverAttended.length})</option>
                  <option value="failing">Had failed check-ins ({t.students.filter((x) => x.failedAttempts > 0).length})</option>
                  <option value="all">Everyone ({t.students.length})</option>
                </select>
              )}
              columns={[
                { key: 'name', label: 'Student', value: (s) => `${s.name} ${s.studentId ?? ''}`, render: (s) => <><p className="font-medium text-gray-900 dark:text-white">{s.name}</p><p className="font-mono text-[10px] text-gray-500">{s.studentId ?? '—'}</p></> },
                { key: 'rate', label: 'Attendance', align: 'right', value: (s) => Math.round(s.rate * 100), render: (s) => <RateCell r={s.rate} /> },
                { key: 'attended', label: 'Attended', align: 'right', render: (s) => <span>{s.attended}<span className="text-gray-400"> / {s.expected}</span></span> },
                { key: 'why', label: 'Likely reason', value: (s) => studentReason(s), render: (s) => <span className="text-xs">{studentReason(s)}</span> },
                { key: 'failedAttempts', label: 'Failed tries', align: 'right', render: (s) => <span className={s.failedAttempts ? 'text-amber-600 dark:text-amber-400' : ''}>{s.failedAttempts}</span> },
                { key: 'lastFailReason', label: 'Last error', className: 'max-w-[260px] text-xs text-gray-500', value: (s) => s.lastFailReason ?? '' },
                { key: 'lastCheckInAt', label: 'Last check-in', className: 'whitespace-nowrap text-xs text-gray-500', render: (s) => fmtTime(s.lastCheckInAt) },
                { key: 'phone', label: 'Phone', className: 'text-xs', value: (s) => s.phone ?? '' },
              ]}
            />
          ),
        };
      }
      case 'attendance-distribution': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const colors = [C.rose, '#fb7185', C.amber, '#34d399', C.emerald];
        return {
          count: t.students.length,
          node: chartOrTable('attendance-distribution', t.students.length === 0, (
            <BarChart data={t.distribution} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="band" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 11 }}>
                {t.distribution.map((d, i) => <Cell key={d.key} fill={colors[i]} />)}
              </Bar>
            </BarChart>
          ), {
            rows: t.distribution, rowKey: (d) => d.key,
            columns: [
              { key: 'band', label: 'Attendance' },
              { key: 'count', label: 'Students', align: 'right' },
              { key: 'share', label: 'Share', align: 'right', value: (d) => pct(d.count, t.students.length), render: (d) => `${pct(d.count, t.students.length)}%` },
            ],
          }),
        };
      }
      case 'checkin-times':
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        return {
          node: chartOrTable('checkin-times', t.hours.every((h) => h.checkins + h.failures === 0), (
            <ComposedChart data={t.hours} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.indigo} stopOpacity={0.45} /><stop offset="100%" stopColor={C.indigo} stopOpacity={0.03} /></linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="checkins" name="Check-ins" stroke={C.indigo} strokeWidth={2.5} fill="url(#hourFill)" isAnimationActive={false} />
              <Line type="monotone" dataKey="failures" name="Failed attempts" stroke={C.rose} strokeWidth={2} dot={{ r: 2.5, fill: C.rose }} isAnimationActive={false} />
            </ComposedChart>
          ), {
            rows: t.hours, rowKey: (h) => String(h.hour),
            columns: [
              { key: 'label', label: 'Hour' },
              { key: 'checkins', label: 'Check-ins', align: 'right' },
              { key: 'failures', label: 'Failed attempts', align: 'right' },
            ],
          }),
        };
      case 'lateness':
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        return {
          count: sum(t.lateness, (l) => l.count),
          node: chartOrTable('lateness', t.lateness.every((l) => l.count === 0), (
            <BarChart data={t.lateness} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
              <Bar dataKey="count" name="Check-ins" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 10 }}>
                {t.lateness.map((l, i) => <Cell key={l.bucket} fill={i <= 2 ? C.emerald : i === 3 ? C.amber : C.rose} />)}
              </Bar>
            </BarChart>
          ), {
            rows: t.lateness, rowKey: (l) => l.bucket,
            columns: [
              { key: 'label', label: 'After the start' },
              { key: 'count', label: 'Check-ins', align: 'right' },
              { key: 'share', label: 'Share', align: 'right', value: (l) => pct(l.count, sum(t.lateness, (x) => x.count)), render: (l) => `${pct(l.count, sum(t.lateness, (x) => x.count))}%` },
            ],
          }),
        };
      case 'heatmap':
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        return { node: <Heatmap heat={t.heat} max={t.heatMax} hours={t.hours.map((h) => h.hour)} /> };
      case 'rssi-trend': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const rows = t.rssiByDay.map((d) => ({ ...d, label: fmtB(d.day) }));
        return {
          node: chartOrTable('rssi-trend', rows.length === 0, (
            <LineChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => `${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} dBm`} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={rssiThreshold} stroke={C.rose} strokeDasharray="5 5" label={{ value: `Threshold ${rssiThreshold}`, fill: '#94a3b8', fontSize: 10, position: 'insideBottomRight' }} />
              <Line type="monotone" dataKey="max" name="Strongest" stroke={C.emerald} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="avg" name="Average" stroke={C.indigo} strokeWidth={3} dot={{ r: 3, fill: C.indigo }} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="min" name="Weakest" stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="failAvg" name="Avg on failed tries" stroke={C.rose} strokeWidth={2} dot={{ r: 3, fill: C.rose }} connectNulls isAnimationActive={false} />
            </LineChart>
          ), {
            rows, rowKey: (d) => d.day,
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (d) => d.day, render: (d) => d.label },
              { key: 'avg', label: 'Average', align: 'right' },
              { key: 'min', label: 'Weakest', align: 'right' },
              { key: 'max', label: 'Strongest', align: 'right' },
              { key: 'failAvg', label: 'Avg on failed', align: 'right' },
            ],
          }),
        };
      }
      case 'signin-trend': {
        if (!t?.hasTrends) return { node: <OldBackendNote /> };
        const keys = t.signInTrend.keys;
        const rows: Record<string, string | number | null>[] = t.signInRateByDay.map((d) => ({ ...d, label: fmtB(String(d.day)) }));
        return {
          node: chartOrTable('signin-trend', rows.every((d) => Number(d.ok) + Number(d.failed) === 0), (
            <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="n" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => (name === 'Success rate' ? `${v}%` : v)} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {keys.map((key, i) => <Bar key={key} yAxisId="n" dataKey={key} name={key} stackId="f" fill={SERIES[i % SERIES.length]} fillOpacity={0.75} />)}
              <Line yAxisId="r" type="monotone" dataKey="rate" name="Success rate" stroke={C.emerald} strokeWidth={3} dot={{ r: 3.5, fill: C.emerald }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          ), {
            rows, rowKey: (d) => String(d.day),
            columns: [
              { key: 'label', label: GRAIN_LABEL[grain], value: (d) => String(d.day), render: (d) => d.label },
              { key: 'ok', label: 'Signed in', align: 'right', value: (d) => Number(d.ok) },
              { key: 'failed', label: 'Failed', align: 'right', value: (d) => Number(d.failed) },
              { key: 'rate', label: 'Success', align: 'right', value: (d) => (d.rate == null ? null : Number(d.rate)), render: (d) => (d.rate == null ? '—' : `${d.rate}%`) },
              ...keys.map((key) => ({ key, label: key, align: 'right' as const, value: (d: (typeof rows)[number]) => Number(d[key] ?? 0) })),
            ],
          }),
        };
      }
      default:
        return null;
    }
  };

  const presetLabel = PRESETS.find((p) => p.id === layout.preset)?.label ?? 'Custom';

  /** Downloads: the whole report (every section, not only the visible ones) as CSV or PDF. */
  const download = async (kind: 'csv' | 'pdf') => {
    if (!data || !k || !t) return;
    setExporting(kind);
    setExportError(null);
    const rate = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);
    const headline = [
      { label: 'Students', value: k.students.toLocaleString() },
      { label: 'Signed in on a phone', value: `${k.signedIn.toLocaleString()} (${pct(k.signedIn, k.students)}%)` },
      { label: 'Attendance rate', value: rate(t.attendanceRate) },
      { label: 'Seats expected / check-ins', value: `${t.expected.toLocaleString()} / ${t.attended.toLocaleString()}` },
      { label: 'Students who attended', value: t.activeStudents.toLocaleString() },
      { label: `Students under ${Math.round(AT_RISK * 100)}%`, value: t.atRisk.length.toLocaleString() },
      { label: 'Never attended', value: t.neverAttended.length.toLocaleString() },
      { label: 'Check-in success rate', value: rate(k.checkInSuccessRate) },
      { label: 'Gave up checking in', value: (k.checkInGaveUpPeriod ?? 0).toLocaleString() },
      { label: 'Failed check-in attempts', value: (k.checkInFailedAttemptsPeriod ?? 0).toLocaleString() },
      { label: 'On-time share', value: rate(t.onTimeShare) },
      { label: 'Check-out rate', value: rate(k.checkOutRate) },
      { label: 'Classes nobody attended', value: `${t.emptyClasses} of ${t.classesHeld}` },
      { label: 'PIN-locked now', value: String(k.pinLockedNow) },
      { label: 'Open tickets', value: String(openTickets.length) },
    ];
    try {
      const sections = reportSections(data, t, insights, headline);
      if (kind === 'csv') downloadReportCsv(data, sections);
      else await downloadReportPdf(data, sections, insights);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'The download failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-5 text-[color:var(--app-text)]">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Activity size={22} className="text-indigo-500" />
            Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {data?.school ? data.school.name : 'Student sign-ins, check-ins and anything that needs your help.'}
            {data && (
              <span className="mt-0.5 block text-xs">
                Last updated {fmtTime(data.generatedAt, 'HH:mm:ss')} · refreshes every minute while this tab is open
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-white/15 dark:bg-slate-900/60" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => { ctl.setDays(p.days); setGrainPick(null); }}
                aria-pressed={days === p.days}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  days === p.days ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <GrainSwitch value={grain} onChange={setGrainPick} days={days} />
          <label className="sr-only" htmlFor="analytics-view">View</label>
          <select
            id="analytics-view"
            value={layout.preset}
            onChange={(e) => e.target.value !== 'custom' && ctl.applyPreset(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100"
            title="Switch view"
          >
            {PRESETS.map((p) => <option key={p.id} value={p.id}>View: {p.label}</option>)}
            {layout.preset === 'custom' && <option value="custom">View: Custom</option>}
          </select>
          <button type="button" onClick={() => setCustomizing(true)} className={clsx(pillBtn, '!border-indigo-300 !text-indigo-700 dark:!border-indigo-400/40 dark:!text-indigo-200')}>
            <SlidersHorizontal size={16} /> Customize
          </button>
          <button type="button" onClick={refreshAll} disabled={loading} className={pillBtn}>
            <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-500' : ''} />
            Refresh
          </button>
          <button type="button" onClick={() => void download('csv')} disabled={!data || exporting != null} className={pillBtn} title="Every section as one spreadsheet">
            <FileSpreadsheet size={16} className="text-emerald-600" /> {exporting === 'csv' ? 'Preparing…' : 'CSV'}
          </button>
          <button type="button" onClick={() => void download('pdf')} disabled={!data || exporting != null} className={clsx(pillBtn, '!border-transparent !bg-indigo-600 !text-white hover:!bg-indigo-700')} title="PDF report with the TCheck logo, findings, charts and tables">
            {exporting === 'pdf' ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />} {exporting === 'pdf' ? 'Building PDF…' : 'PDF report'}
          </button>
        </div>
      </header>

      {/* Jump to a section */}
      {visible.length > 1 && (
        <nav aria-label="Sections" className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-[var(--app-bg,transparent)]/80 px-1 py-2 backdrop-blur">
          <span className="flex flex-shrink-0 items-center px-2 text-xs font-medium text-gray-400">{presetLabel}:</span>
          {visible.map((w) => {
            const Icon = WIDGET_ICON[w.id] ?? Activity;
            return (
              <a key={w.id} href={`#w-${w.id}`} className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white">
                <Icon size={12} /> {w.title}
              </a>
            );
          })}
        </nav>
      )}

      {isSuperAdmin && (
        <div className="flex flex-col gap-2 rounded-2xl border border-indigo-200/70 bg-indigo-50/70 px-4 py-3 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
            <School size={16} />
            Details are for{' '}
            <span className="font-semibold">
              {/* useApi keeps the previous school's data while the new one loads — don't mislabel it. */}
              {schoolId && data?.school?.id !== schoolId ? 'the selected school (loading…)' : data?.school?.name ?? 'the Student ID school'}
            </span>
            {!schoolId && <span className="text-xs text-indigo-700/70 dark:text-indigo-200/60">(default — pick another in All schools)</span>}
          </p>
          {schoolId && (
            <button type="button" onClick={() => selectSchool(null)} className="inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-500/20 sm:self-auto">
              <ArrowLeft size={13} /> Back to the default school
            </button>
          )}
        </div>
      )}

      {exportError && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle size={15} /> Couldn't build the download: {exportError}
        </p>
      )}

      {error && (
        <div className={clsx(cardShell, 'flex flex-col gap-3 border-rose-500/35 bg-gradient-to-r from-rose-500/12 to-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between')}>
          <p className="flex items-center gap-2 text-sm text-rose-900 dark:text-rose-100/90">
            <AlertTriangle size={16} />
            {data ? `Couldn't refresh — showing the last numbers loaded. (${error})` : `Couldn't load analytics: ${error}`}
          </p>
          <button type="button" onClick={refreshAll} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 hover:opacity-95">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      {!data && loading && (
        <div className="flex min-h-[240px] items-center justify-center" role="status" aria-label="Loading">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-white/20 dark:border-t-fuchsia-400" />
        </div>
      )}

      {visible.length === 0 ? (
        <div className={clsx(cardShell, 'p-10 text-center')}>
          <p className="text-sm text-gray-500">Nothing is showing.</p>
          <button type="button" onClick={() => setCustomizing(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <SlidersHorizontal size={16} /> Choose what to show
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-flow-row-dense xl:grid-cols-2">
          {visible.map((w) => {
            const b = body(w);
            if (!b) return null;
            return (
              <WidgetFrame
                key={w.id}
                def={w}
                count={b.count}
                view={layout.views[w.id] ?? 'chart'}
                size={layout.sizes[w.id] ?? w.size}
                collapsed={layout.collapsed.includes(w.id)}
                onView={(v) => ctl.setView(w.id, v)}
                onSize={(s) => ctl.setSize(w.id, s)}
                onCollapse={() => ctl.toggleCollapsed(w.id)}
                onHide={() => ctl.toggleWidget(w.id)}
                headerExtra={w.id === 'kpis' ? (
                  <button type="button" onClick={() => setCustomizing(true)} className="mr-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">Choose numbers</button>
                ) : w.id === 'attendance-trend' ? (
                  <div className="mr-1 flex items-center gap-1">
                    <select value={days} onChange={(e) => { ctl.setDays(Number(e.target.value)); setGrainPick(null); }} aria-label="Period" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
                      {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
                    </select>
                    <GrainSwitch value={grain} onChange={setGrainPick} days={days} compact />
                  </div>
                ) : undefined}
              >
                {b.node}
              </WidgetFrame>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-1.5 pb-2 text-xs text-gray-400">
        <Radio size={12} /> All times are shown in your device's local time. Your layout is saved on this browser.
      </p>

      <CustomizePanel open={customizing} onClose={() => setCustomizing(false)} ctl={ctl} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}

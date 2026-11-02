import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, Users, LogIn, UserCheck, CalendarCheck, LogOut, KeyRound, Smartphone, UserX,
  RefreshCw, Lock, Unlock, RotateCcw, History, ShieldX, BookOpen, LifeBuoy, Siren, Radio,
  BarChart3, AlertTriangle, CheckCircle2, School, ArrowLeft, ArrowUp, ArrowDown, Target,
  Repeat, XCircle, MapPinOff,
} from 'lucide-react';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
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

const REFRESH_MS = 60_000;
/** The beacon threshold the pilot ships with — used when no class in the period carries its own. */
const DEFAULT_RSSI_THRESHOLD = -95;

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
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

/* ---- Formatting — every timestamp is rendered in the browser's own timezone (EAT at Moi). ---- */

const fmtTime = (iso: string | null | undefined, pattern = 'd MMM, HH:mm') => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : format(d, pattern);
};
/** `YYYY-MM-DD` day keys are calendar days, not instants — parseISO reads them as local midnight. */
const fmtDay = (day: string) => {
  const d = parseISO(day);
  return Number.isNaN(d.getTime()) ? day : format(d, 'EEE d MMM');
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
const labelFor = (map: Record<string, string>, code: string) => map[code] ?? code.replace(/_/g, ' ').toLowerCase();

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

/* ---- Small building blocks ---- */

function Section({
  title, icon: Icon, iconClass = 'text-gray-400', count, description, actions, children,
}: {
  title: string;
  icon: typeof Activity;
  iconClass?: string;
  count?: number;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={clsx(cardShell, 'overflow-hidden')}>
      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Icon size={16} className={iconClass} />
            {title}
            {count != null && <Badge color="gray">{count}</Badge>}
          </h3>
          {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function KpiTile({
  label, value, hint, icon: Icon, tone = 'blue', alert = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: typeof Activity;
  tone?: 'blue' | 'green' | 'amber' | 'violet' | 'cyan' | 'red' | 'gray';
  alert?: boolean;
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
  return (
    <div
      className={clsx(
        cardShell,
        'flex items-start gap-3 p-4',
        alert && '!border-red-500/50 !bg-red-50 dark:!bg-red-500/10 ring-1 ring-red-500/30',
      )}
    >
      <div className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', toneClass)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className={clsx('text-xs font-medium', alert ? 'text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400')}>{label}</p>
        <p className={clsx('mt-0.5 text-2xl font-bold leading-tight tabular-nums', alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, description, empty, children }: { title: string; description?: string; empty: boolean; children: ReactNode }) {
  return (
    <div className={clsx(cardShell, 'p-5')}>
      <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="mt-4 h-[260px]">
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

/* ---- Needs help now: wrong-PIN lockouts ---- */

type RowStatus = { kind: 'busy' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

function LockedStudentsCard({ rows, schoolId, onChanged }: { rows: PilotAnalytics['lockedStudents']; schoolId: string | null; onChanged: () => void }) {
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

  return (
    <Section
      title="Needs help now"
      icon={Lock}
      iconClass={rows.length > 0 ? 'text-red-500' : 'text-gray-400'}
      count={rows.length}
      description="Students locked out after 5 wrong PINs. Unlock lets them try their own PIN again; Reset sets the PIN back to 123456."
    >
      <Table head={['Student ID', 'Name', 'Wrong PINs', 'Locked until', '']}>
        {rows.map((r) => {
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
      {doneElsewhere.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 px-4 py-3 dark:border-white/5">
          {doneElsewhere.map(([id, st]) => (
            <p key={id} className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 size={12} /> {st.kind === 'ok' ? st.text : ''}
            </p>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ---- Audit log: paginated by `nextBefore`, filtered by event type + typed student ID ---- */

function AuditLogCard({ reloadKey, schoolId }: { reloadKey: number; schoolId: string | null }) {
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [events, setEvents] = useState<PilotAuditEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the student ID box so each keystroke isn't its own request.
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 400);
    return () => window.clearTimeout(id);
  }, [search]);

  const loadFirstPage = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchPilotAudit({ type, q, schoolId })
      .then((page) => { setEvents(page.events); setNextBefore(page.nextBefore); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the audit log'))
      .finally(() => setLoading(false));
  }, [type, q, schoolId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadFirstPage(); });
    return () => { cancelled = true; };
  }, [loadFirstPage, reloadKey]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPilotAudit({ type, q, before: nextBefore, schoolId });
      setEvents((prev) => [...prev, ...page.events]);
      setNextBefore(page.nextBefore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more events');
    } finally {
      setLoadingMore(false);
    }
  };

  const tone = (t: string): 'green' | 'red' | 'yellow' | 'blue' | 'gray' =>
    t === 'SIGNIN_OK' ? 'green'
      : t === 'SIGNIN_FAILED' || t === 'PIN_LOCKED' ? 'red'
        : t.startsWith('ACCOUNT_') ? 'gray'
          : t.endsWith('_BY_ADMIN') ? 'blue' : 'yellow';

  return (
    <Section
      title="Sign-in audit log"
      icon={History}
      description="Every sign-in attempt and PIN change, newest first."
      actions={
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
          <SearchInput
            placeholder="Search student ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px]"
          />
        </div>
      }
    >
      {error && <p className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <Table head={['Time', 'Event', 'Student ID typed', 'Matched student', 'IP', 'Phone', 'Detail']}>
          {events.map((e) => (
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
      )}
      {!loading && nextBefore && (
        <div className="border-t border-gray-100 p-3 text-center dark:border-white/5">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ---- SUPER_ADMIN only: one row of headline numbers per school ---- */

type SchoolSortKey = keyof Pick<PilotSchoolRow,
  'name' | 'students' | 'signedIn' | 'signInsToday' | 'checkInsToday' | 'checkInsThisWeek' |
  'activeStudentsThisWeek' | 'gaveUpThisWeek' | 'openTickets' | 'lastCheckInAt'>;

const SCHOOL_COLUMNS: { key: SchoolSortKey; label: string }[] = [
  { key: 'name', label: 'School' },
  { key: 'students', label: 'Students' },
  { key: 'signedIn', label: 'Signed in' },
  { key: 'signInsToday', label: 'Sign-ins today' },
  { key: 'checkInsToday', label: 'Check-ins today' },
  { key: 'checkInsThisWeek', label: 'Check-ins this week' },
  { key: 'activeStudentsThisWeek', label: 'Active this week' },
  { key: 'gaveUpThisWeek', label: 'Gave up this week' },
  { key: 'openTickets', label: 'Open tickets' },
  { key: 'lastCheckInAt', label: 'Last check-in' },
];

function AllSchoolsSection({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { data, loading, error, refetch } = useApi<PilotSchoolsSummary>(PILOT_SCHOOLS_PATH, { refetchWhenVisible: true });
  const [sortKey, setSortKey] = useState<SchoolSortKey>('students');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch({ silent: true });
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refetch]);

  const schools = useMemo(() => data?.schools ?? [], [data]);
  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...schools].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // "never checked in" always sinks to the bottom
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [schools, sortKey, sortDir]);

  const totals = schools.reduce(
    (t, s) => ({
      students: t.students + s.students,
      signedIn: t.signedIn + s.signedIn,
      checkInsToday: t.checkInsToday + s.checkInsToday,
      checkInsThisWeek: t.checkInsThisWeek + s.checkInsThisWeek,
      activeStudentsThisWeek: t.activeStudentsThisWeek + s.activeStudentsThisWeek,
      openTickets: t.openTickets + s.openTickets,
    }),
    { students: 0, signedIn: 0, checkInsToday: 0, checkInsThisWeek: 0, activeStudentsThisWeek: 0, openTickets: 0 },
  );
  const nowMs = data ? new Date(data.generatedAt).getTime() : 0;

  const toggleSort = (key: SchoolSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  return (
    <div className="space-y-4">
      <section aria-label="All schools totals" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Students, all schools" value={totals.students.toLocaleString()} icon={Users} tone="blue" />
        <KpiTile label="Signed in" value={totals.signedIn.toLocaleString()} hint={`${pct(totals.signedIn, totals.students)}% of students`} icon={LogIn} tone="green" />
        <KpiTile label="Check-ins today" value={totals.checkInsToday.toLocaleString()} icon={CalendarCheck} tone="cyan" />
        <KpiTile label="Check-ins this week" value={totals.checkInsThisWeek.toLocaleString()} icon={UserCheck} tone="violet" />
        <KpiTile label="Active students this week" value={totals.activeStudentsThisWeek.toLocaleString()} icon={Activity} tone="green" />
        <KpiTile label="Open tickets" value={totals.openTickets.toLocaleString()} icon={LifeBuoy} tone="amber" />
      </section>

      <Section
        title="All schools"
        icon={School}
        iconClass="text-indigo-500"
        count={schools.length}
        description="Click a school to see its full details below."
      >
        {error && <p className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-600 dark:text-red-400">Couldn't load schools: {error}</p>}
        {loading && !data ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.02]">
                <tr>
                  {SCHOOL_COLUMNS.map((col) => (
                    <th key={col.key} className={thClass}>
                      <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 uppercase hover:text-gray-900 dark:hover:text-white">
                        {col.label}
                        {sortKey === col.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-white/5 dark:text-gray-300">
                {sorted.map((s) => {
                  const p = pct(s.signedIn, s.students);
                  const selected = s.id === selectedId;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onSelect(selected ? null : s.id)}
                      className={clsx(
                        'cursor-pointer transition-colors',
                        selected ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.03]',
                      )}
                    >
                      <td className={tdClass}>
                        <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="text-[10px] text-gray-500">{s.code} · {s.staff} staff · {s.courses} courses · {s.classesThisWeek} classes this week</p>
                      </td>
                      <td className={clsx(tdClass, 'tabular-nums')}>{s.students.toLocaleString()}</td>
                      <td className={clsx(tdClass, 'min-w-[130px]')}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                            <div className="h-full rounded-full" style={{ width: `${p}%`, background: C.indigo }} />
                          </div>
                          <span className="tabular-nums text-xs">{p}%</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{s.signedIn.toLocaleString()} students</p>
                      </td>
                      <td className={clsx(tdClass, 'whitespace-nowrap tabular-nums')}>
                        <span className="text-green-600 dark:text-green-400">{s.signInsToday ?? 0}</span>
                        <span className="text-xs text-gray-400"> ok · </span>
                        <span className={s.failedSignInsToday > 0 ? 'text-red-500' : ''}>{s.failedSignInsToday}</span>
                        <span className="text-xs text-gray-400"> failed</span>
                      </td>
                      <td className={clsx(tdClass, 'whitespace-nowrap tabular-nums')}>
                        {s.checkInsToday}
                        <span className="text-xs text-gray-400"> in · </span>
                        <span className={(s.failedCheckInsToday ?? 0) > 0 ? 'text-red-500' : ''}>{s.failedCheckInsToday ?? 0}</span>
                        <span className="text-xs text-gray-400"> failed</span>
                      </td>
                      <td className={clsx(tdClass, 'tabular-nums')}>
                        {s.checkInsThisWeek}
                        {(s.failedCheckInsThisWeek ?? 0) > 0 && <p className="text-[10px] text-gray-500">{s.failedCheckInsThisWeek} failed attempts</p>}
                      </td>
                      <td className={clsx(tdClass, 'tabular-nums')}>{s.activeStudentsThisWeek}</td>
                      <td className={clsx(tdClass, 'tabular-nums', (s.gaveUpThisWeek ?? 0) > 0 && 'font-semibold text-red-500')}>{s.gaveUpThisWeek ?? 0}</td>
                      <td className={clsx(tdClass, 'tabular-nums')}>{s.openTickets}</td>
                      <td className={clsx(tdClass, 'whitespace-nowrap text-xs text-gray-500')} title={s.lastCheckInAt ? fmtTime(s.lastCheckInAt) : undefined}>
                        {timeAgo(s.lastCheckInAt, nowMs)}
                      </td>
                    </tr>
                  );
                })}
                {schools.length === 0 && <EmptyRow cols={SCHOOL_COLUMNS.length} title="No schools yet." />}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ---- Page ---- */

export function PilotAnalyticsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
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

  const [days, setDays] = useState<number>(7);
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

  if (!data && loading && !isSuperAdmin) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-white/20 dark:border-t-fuchsia-400" />
      </div>
    );
  }

  const k = data?.kpis;
  const periodLabel = days === 1 ? 'today' : `last ${days} days`;
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
  const checkInData = (data?.checkInsByDay ?? []).map((d) => ({ ...d, label: fmtDay(d.day) }));
  const signInData = (data?.signInsByDay ?? []).map((d) => ({ ...d, label: fmtDay(d.day) }));
  const generatedMs = data ? new Date(data.generatedAt).getTime() : 0;
  const openTickets = (data?.tickets ?? []).filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));
  const outcomeData = (data?.checkInOutcomesByDay ?? []).map((d) => ({ ...d, label: fmtDay(d.day) }));
  const checkInFailures = [...(data?.checkInFailureReasons ?? [])].sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-[1680px] space-y-6 text-[color:var(--app-text)]">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Activity size={22} className="text-indigo-500" />
            Pilot analytics
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
                onClick={() => setDays(p.days)}
                aria-pressed={days === p.days}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  days === p.days
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-500' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {isSuperAdmin && <AllSchoolsSection selectedId={schoolId} onSelect={selectSchool} />}

      {isSuperAdmin && (
        <div className="flex flex-col gap-2 rounded-2xl border border-indigo-200/70 bg-indigo-50/70 px-4 py-3 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
            <School size={16} />
            Details below are for{' '}
            <span className="font-semibold">
              {/* useApi keeps the previous school's data while the new one loads — don't mislabel it. */}
              {schoolId && data?.school?.id !== schoolId
                ? 'the selected school (loading…)'
                : data?.school?.name ?? 'the Student ID school'}
            </span>
            {!schoolId && <span className="text-xs text-indigo-700/70 dark:text-indigo-200/60">(default)</span>}
          </p>
          {schoolId && (
            <button
              type="button"
              onClick={() => selectSchool(null)}
              className="inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-500/20 sm:self-auto"
            >
              <ArrowLeft size={13} /> Back to the default school
            </button>
          )}
        </div>
      )}

      {!data && loading && isSuperAdmin && (
        <div className="flex min-h-[200px] items-center justify-center" role="status" aria-label="Loading">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-white/20 dark:border-t-fuchsia-400" />
        </div>
      )}

      {error && (
        <div className={clsx(cardShell, 'flex flex-col gap-3 border-rose-500/35 bg-gradient-to-r from-rose-500/12 to-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between')}>
          <p className="flex items-center gap-2 text-sm text-rose-900 dark:text-rose-100/90">
            <AlertTriangle size={16} />
            {data ? `Couldn't refresh — showing the last numbers loaded. (${error})` : `Couldn't load pilot analytics: ${error}`}
          </p>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 hover:opacity-95"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      {data && k && (
        <>
          {/* KPI tiles */}
          <section aria-label="Summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <KpiTile label="Students" value={k.students.toLocaleString()} icon={Users} tone="blue" />
            <KpiTile label="Signed in" value={k.signedIn.toLocaleString()} hint={`${pct(k.signedIn, k.students)}% of students · ${k.signedInToday} today`} icon={LogIn} tone="green" />
            <KpiTile label="Check-ins today" value={k.checkInsToday.toLocaleString()} icon={CalendarCheck} tone="cyan" />
            <KpiTile label={`Check-ins, ${periodLabel}`} value={k.checkInsPeriod.toLocaleString()} icon={UserCheck} tone="violet" />
            <KpiTile
              label="Check-out rate"
              value={k.checkOutRate == null ? '—' : `${Math.round(k.checkOutRate * 100)}%`}
              hint="Check-ins that also checked out"
              icon={LogOut}
              tone="cyan"
            />
            <KpiTile
              label="Sign-ins today"
              value={<><span className="text-green-600 dark:text-green-400">{k.signInsOkToday}</span><span className="text-base font-medium text-gray-400"> ok · </span><span className={k.signInsFailedToday > 0 ? 'text-red-500' : ''}>{k.signInsFailedToday}</span><span className="text-base font-medium text-gray-400"> failed</span></>}
              icon={KeyRound}
              tone="blue"
            />
            <KpiTile label="PIN-locked now" value={k.pinLockedNow} hint={k.pinLockedNow > 0 ? 'See "Needs help now" below' : 'Nobody locked out'} icon={Lock} tone="gray" alert={k.pinLockedNow > 0} />
            <KpiTile label="Pending phone changes" value={k.pendingDeviceChanges} hint="Waiting in Verification" icon={Smartphone} tone="amber" />
            <KpiTile label="Closed accounts" value={k.closedAccounts} hint="Deleted or deactivated" icon={UserX} tone="gray" />
          </section>

          {/* Check-in outcomes — per student-and-class, so one student retrying 4 times is one "retried" */}
          <section aria-label="Check-in outcomes" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <KpiTile
              label="Check-in success rate"
              value={k.checkInSuccessRate == null ? '—' : `${Math.round(k.checkInSuccessRate * 100)}%`}
              hint={`Students who tried and got in, ${periodLabel}`}
              icon={Target}
              tone="green"
            />
            <KpiTile label="Got in first try" value={(k.checkInFirstTryPeriod ?? 0).toLocaleString()} hint={periodLabel} icon={CheckCircle2} tone="green" />
            <KpiTile label="Got in after retrying" value={(k.checkInRetriedPeriod ?? 0).toLocaleString()} hint={periodLabel} icon={Repeat} tone="amber" />
            <KpiTile
              label="Tried but gave up"
              value={(k.checkInGaveUpPeriod ?? 0).toLocaleString()}
              hint={`Never got in, ${periodLabel}`}
              icon={XCircle}
              tone="gray"
              alert={(k.checkInGaveUpPeriod ?? 0) > 0}
            />
            <KpiTile
              label="Failed check-in attempts today"
              value={(k.checkInFailedAttemptsToday ?? 0).toLocaleString()}
              hint={`${(k.checkInFailedAttemptsPeriod ?? 0).toLocaleString()} ${periodLabel}`}
              icon={MapPinOff}
              tone="red"
            />
          </section>

          {/* Onboarding funnel */}
          <section className={clsx(cardShell, 'p-5')}>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Onboarding progress</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">How far students have got with setting up the app.</p>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Students on the list', value: k.students, color: C.slate },
                { label: 'Signed in at least once', value: k.signedIn, color: C.indigo },
                { label: 'Accepted the terms', value: k.termsAccepted, color: C.violet },
                { label: 'Took their baseline photo', value: k.baselineCaptured, color: C.emerald },
              ].map((step) => {
                const p = pct(step.value, k.students);
                return (
                  <div key={step.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate text-slate-600 dark:text-slate-300">{step.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p}%`, background: step.color }} />
                    </div>
                    <span className="w-24 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {step.value.toLocaleString()} <span className="text-xs text-slate-400">({p}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <LockedStudentsCard rows={data.lockedStudents} schoolId={schoolId} onChanged={afterPinAction} />

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Check-in outcomes"
              description="Per student per class: got in first try, got in after retrying, or gave up. The line is the total of failed attempts."
              empty={outcomeData.every((d) => d.firstTry + d.retriedThenIn + d.gaveUp + d.failedAttempts === 0)}
            >
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
            </ChartCard>

            <ChartCard title="Check-ins per day" description="Present, late and other check-ins" empty={checkInData.every((d) => d.present + d.late + d.other === 0)}>
              <BarChart data={checkInData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="present" name="Present" stackId="c" fill={C.emerald} />
                <Bar dataKey="late" name="Late" stackId="c" fill={C.amber} />
                <Bar dataKey="other" name="Other" stackId="c" fill={C.slate} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Sign-ins per day" description="Successful vs failed sign-in attempts" empty={signInData.every((d) => d.ok + d.failed === 0)}>
              <BarChart data={signInData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="ok" name="Signed in" fill={C.indigo} radius={[6, 6, 0, 0]} />
                <Bar dataKey="failed" name="Failed" fill={C.rose} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Why sign-ins failed" description={`All failed attempts, ${periodLabel}`} empty={failureData.length === 0}>
              <BarChart data={failureData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="4 8" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={170} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.06)' }} />
                <Bar dataKey="count" name="Attempts" fill={C.rose} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard
              title="Beacon signal at check-in"
              description={`Signal strength (dBm) when students checked in. Current threshold ${rssiThreshold} dBm — weaker (more negative) signals don't count.`}
              empty={rssiData.length === 0}
            >
              <BarChart data={rssiData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="4 8" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(128,128,128,0.06)' }}
                  labelFormatter={(l) => `${l} to ${Number(l) + 4} dBm`}
                />
                {thresholdBucket && (
                  <ReferenceLine x={thresholdBucket.label} stroke={C.rose} strokeDasharray="5 5" label={{ value: `Threshold ${rssiThreshold}`, fill: '#94a3b8', fontSize: 10, position: 'top' }} />
                )}
                <Bar dataKey="count" name="Check-ins" radius={[6, 6, 0, 0]}>
                  {rssiData.map((b) => (
                    <Cell key={b.rssi} fill={b.rssi + 5 <= rssiThreshold ? C.rose : C.cyan} />
                  ))}
                </Bar>
              </BarChart>
            </ChartCard>
          </div>

          <Section
            title="Why check-ins failed"
            icon={MapPinOff}
            iconClass="text-red-500"
            count={checkInFailures.reduce((n, r) => n + r.count, 0)}
            description={`The message students saw when a check-in didn't go through, ${periodLabel}.`}
          >
            <Table head={['Reason', 'How', 'Attempts', 'Students affected']}>
              {checkInFailures.map((r) => (
                <tr key={`${r.channel}-${r.reason}`} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                  <td className={clsx(tdClass, 'max-w-[420px] text-gray-900 dark:text-white')}>{r.reason}</td>
                  <td className={tdClass}><Badge color="gray">{CHECKIN_CHANNEL_LABEL[r.channel] ?? r.channel}</Badge></td>
                  <td className={clsx(tdClass, 'tabular-nums')}>{r.count}</td>
                  <td className={clsx(tdClass, 'tabular-nums')}>{r.students}</td>
                </tr>
              ))}
              {checkInFailures.length === 0 && <EmptyRow cols={4} title="No failed check-ins in this period." />}
            </Table>
          </Section>

          <AuditLogCard reloadKey={auditReloadKey} schoolId={schoolId} />

          {/* Classes */}
          <Section title="Classes" icon={BookOpen} iconClass="text-indigo-500" count={data.classes.length} description={`Classes ${periodLabel}, plus the next 2 days.`}>
            <Table head={['When', 'Course', 'Room', 'Check-ins', 'Check-outs', 'Failed attempts', 'Gave up', 'Beacon threshold']}>
              {data.classes.map((c) => {
                const upcoming = new Date(c.startTime).getTime() > generatedMs;
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                    <td className={clsx(tdClass, 'whitespace-nowrap text-xs')}>
                      {fmtTime(c.startTime, 'EEE d MMM, HH:mm')}–{fmtTime(c.endTime, 'HH:mm')}
                      {upcoming && <span className="ml-2"><Badge color="blue">Upcoming</Badge></span>}
                    </td>
                    <td className={tdClass}>
                      <p className="font-medium text-gray-900 dark:text-white">{c.course ?? '—'}</p>
                      {c.title && c.title !== c.course && <p className="text-[11px] text-gray-500">{c.title}</p>}
                    </td>
                    <td className={tdClass}>{c.room ?? '—'}</td>
                    <td className={clsx(tdClass, 'tabular-nums')}>{c.checkins}</td>
                    <td className={clsx(tdClass, 'tabular-nums')}>{c.checkouts}</td>
                    <td className={clsx(tdClass, 'tabular-nums', (c.failedAttempts ?? 0) > 0 && 'text-amber-600 dark:text-amber-400')}>{c.failedAttempts ?? 0}</td>
                    <td className={clsx(tdClass, 'tabular-nums', (c.gaveUp ?? 0) > 0 && 'font-semibold text-red-500')}>{c.gaveUp ?? 0}</td>
                    <td className={clsx(tdClass, 'text-xs')}>{c.rssiThreshold != null ? `${c.rssiThreshold} dBm` : 'Default'}</td>
                  </tr>
                );
              })}
              {data.classes.length === 0 && <EmptyRow cols={8} title="No classes in this period." />}
            </Table>
          </Section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Device security events */}
            <Section title="Phone security events" icon={ShieldX} iconClass="text-red-500" count={data.deviceEvents.length} description="Phone switches and blocked attempts. “Blocked” means one phone tried to sign into two accounts.">
              <Table head={['Time', 'Event', 'Student', 'Phone']}>
                {data.deviceEvents.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                    <td className={clsx(tdClass, 'whitespace-nowrap text-xs text-gray-500')}>{fmtTime(e.createdAt)}</td>
                    <td className={clsx(tdClass, 'text-xs')}>
                      <span className={e.type === 'CONFLICT_BLOCKED' ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                        {labelFor(DEVICE_EVENT_LABEL, e.type)}
                      </span>
                      {e.otherStudentId && <p className="text-[11px] text-gray-500">Phone already belongs to {e.otherStudentId}</p>}
                      {e.reason && <p className="text-[11px] text-gray-500">Reason: {labelFor(DEVICE_CHANGE_REASON_LABEL, e.reason)}</p>}
                    </td>
                    <td className={tdClass}>
                      <p className="font-medium text-gray-900 dark:text-white">{e.name ?? '—'}</p>
                      {e.studentId && <p className="text-[10px] text-gray-500">{e.studentId}</p>}
                    </td>
                    <td className={clsx(tdClass, 'text-xs')}>{e.deviceModel ?? '—'}</td>
                  </tr>
                ))}
                {data.deviceEvents.length === 0 && <EmptyRow cols={4} title="No phone security events in this period." />}
              </Table>
            </Section>

            {/* Closed accounts */}
            <Section title="Closed accounts" icon={UserX} count={data.closedAccounts.length} description="Students who deleted their account, or whose account was deactivated.">
              <Table head={['Student ID', 'Name', 'Status', 'When']}>
                {data.closedAccounts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                    <td className={clsx(tdClass, 'font-mono text-xs')}>{a.studentId}</td>
                    <td className={clsx(tdClass, 'font-medium text-gray-900 dark:text-white')}>{a.name}</td>
                    <td className={tdClass}>
                      <Badge color={a.status === 'DELETED' ? 'red' : 'gray'}>{a.status === 'DELETED' ? 'Deleted' : a.status === 'DEACTIVATED' ? 'Deactivated' : a.status}</Badge>
                    </td>
                    <td className={clsx(tdClass, 'text-xs text-gray-500')}>{fmtTime(a.updatedAt)}</td>
                  </tr>
                ))}
                {data.closedAccounts.length === 0 && <EmptyRow cols={4} title="No closed accounts." />}
              </Table>
            </Section>

            {/* Phone models */}
            <Section title="Phone models" icon={Smartphone} count={data.deviceModels.length} description="Which phones students are using.">
              <Table head={['Model', 'Students', '']}>
                {data.deviceModels.map((m) => {
                  const max = Math.max(1, ...data.deviceModels.map((x) => x.count));
                  return (
                    <tr key={m.model} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                      <td className={clsx(tdClass, 'font-medium')}>{m.model || 'Unknown'}</td>
                      <td className={clsx(tdClass, 'tabular-nums')}>{m.count}</td>
                      <td className={clsx(tdClass, 'w-1/3')}>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${pct(m.count, max)}%`, background: C.sky }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.deviceModels.length === 0 && <EmptyRow cols={3} title="No phones registered yet." />}
              </Table>
            </Section>

            {/* Open tickets */}
            <Section title="Open support tickets" icon={LifeBuoy} iconClass="text-blue-500" count={openTickets.length}>
              <Table head={['Opened', 'Subject', 'Student', 'Status']}>
                {openTickets.map((t) => (
                  <tr key={t.id} className="align-top hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                    <td className={clsx(tdClass, 'whitespace-nowrap text-xs text-gray-500')}>{fmtTime(t.createdAt)}</td>
                    <td className={clsx(tdClass, 'text-gray-900 dark:text-white')}>{t.subject}</td>
                    <td className={tdClass}>
                      <p className="font-medium">{t.name ?? '—'}</p>
                      {t.studentId && <p className="text-[10px] text-gray-500">{t.studentId}</p>}
                    </td>
                    <td className={tdClass}><Badge color={t.status === 'OPEN' ? 'yellow' : 'blue'}>{t.status.replace(/_/g, ' ').toLowerCase()}</Badge></td>
                  </tr>
                ))}
                {openTickets.length === 0 && <EmptyRow cols={4} title="No open tickets." />}
              </Table>
            </Section>

            {/* Escalations */}
            <Section title="Escalations" icon={Siren} iconClass="text-amber-500" count={data.escalations.reduce((n, e) => n + e.count, 0)} description="Check-in problems raised for a lecturer or admin to review.">
              <Table head={['Reason', 'Status', 'Count']}>
                {data.escalations.map((e) => (
                  <tr key={`${e.status}-${e.reason}`} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01]">
                    <td className={tdClass}>{e.reason.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className={tdClass}><Badge color={e.status === 'PENDING' || e.status === 'OPEN' ? 'yellow' : 'gray'}>{e.status.replace(/_/g, ' ').toLowerCase()}</Badge></td>
                    <td className={clsx(tdClass, 'tabular-nums')}>{e.count}</td>
                  </tr>
                ))}
                {data.escalations.length === 0 && <EmptyRow cols={3} title="No escalations in this period." />}
              </Table>
            </Section>
          </div>

          <p className="flex items-center gap-1.5 pb-2 text-xs text-gray-400">
            <Radio size={12} /> All times are shown in your device's local time.
          </p>
        </>
      )}
    </div>
  );
}

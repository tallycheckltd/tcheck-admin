import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, AlertTriangle, BadgeCheck, Bluetooth, Download, KeyRound, LogIn, LogOut, Mail, Megaphone, Pause, Play, Radio,
  RotateCcw, Search, ShieldAlert, Smartphone, Table2, UserRound, X, type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useTheme } from '../../context/ThemeContext';
import { ROLE_LABEL } from '../../shared/roles';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Card } from '../insights/InsightsUi';
import { Placeholder, Segmented, Skeleton, inputCls, tdCls, thCls } from '../platform/PlatformUi';
import { AuditDetail, DetailField, actionLabel, type AuditCategory, type AuditRow } from './AuditLogView';

/**
 * 11-11 — the School Admin's activity tracker: everything that happens in the school in one live feed
 * (check-ins and check-outs, refused check-ins, escalations, sign-in codes, phone binding, announcements,
 * emails and the change log), with what's on right now, activity over time and a person/class trail.
 * Reads /audit/tracker* (activityTracker.service.ts).
 */

type Kind = 'change' | 'checkin' | 'checkout' | 'blocked' | 'escalation' | 'signin' | 'password' | 'device' | 'announcement' | 'email';
type Group = 'attendance' | 'access' | 'communication' | 'changes';
type Tone = 'ok' | 'info' | 'warn' | 'bad';
interface Person { id: string; name: string; role: string | null }
interface Item {
  id: string; at: string; kind: Kind; group: Group; tone: Tone; title: string; detail: string | null;
  actor: Person | null; subject: Person | null; target: { type: string; id: string; label: string | null } | null; classId: string | null;
  facts: [string, string][];
  change?: { action: string; category: string; entityType: string; entityId: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null; requestId: string | null };
}
interface FeedPage { items: Item[]; nextCursor: string | null }
interface Summary { unit: 'hour' | 'day'; total: number; kinds: Record<Kind, number>; groups: Record<Group, number>; series: ({ t: string } & Record<Group, number>)[] }
interface LiveSession {
  id: string; title: string; courseCode: string; courseName: string; room: string | null; isOnline: boolean; startLocal: string; endLocal: string;
  state: 'upcoming' | 'live' | 'ended'; enrolled: number; checkedIn: number; late: number; checkedOut: number; lastCheckInAt: string | null;
  openEscalations: number; beacons: { name: string; lastSeenAt: string | null }[];
}
interface PersonHit { id: string; name: string; role: string; email: string; studentId: string | null }

// Series colours: the validated reference palette, slots 1–4 (light and dark steps). Light-mode aqua
// and yellow sit under 3:1 on the surface, so the legend carries counts and a table view is offered.
const GROUPS: { key: Group; label: string; light: string; dark: string }[] = [
  { key: 'attendance', label: 'Attendance', light: '#2a78d6', dark: '#3987e5' },
  { key: 'access', label: 'Sign-in & security', light: '#eb6834', dark: '#d95926' },
  { key: 'communication', label: 'Communication', light: '#1baf7a', dark: '#199e70' },
  { key: 'changes', label: 'Changes', light: '#eda100', dark: '#c98500' },
];
const KIND: Record<Kind, { label: string; group: Group; icon: LucideIcon }> = {
  checkin: { label: 'Check-ins', group: 'attendance', icon: LogIn },
  checkout: { label: 'Check-outs', group: 'attendance', icon: LogOut },
  blocked: { label: 'Refused / flagged', group: 'attendance', icon: ShieldAlert },
  escalation: { label: 'Escalations', group: 'attendance', icon: AlertTriangle },
  signin: { label: 'Sign-in codes', group: 'access', icon: KeyRound },
  password: { label: 'Password emails', group: 'access', icon: BadgeCheck },
  device: { label: 'Phone binding', group: 'access', icon: Smartphone },
  announcement: { label: 'Announcements', group: 'communication', icon: Megaphone },
  email: { label: 'Emails', group: 'communication', icon: Mail },
  change: { label: 'Changes', group: 'changes', icon: Activity },
};
const KINDS = Object.keys(KIND) as Kind[];
const TONE: Record<Tone, { dot: string; chip: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', chip: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10', label: 'OK' },
  info: { dot: 'bg-slate-400', chip: 'text-slate-600 dark:text-slate-300 bg-slate-500/10', label: 'Info' },
  warn: { dot: 'bg-amber-500', chip: 'text-amber-700 dark:text-amber-300 bg-amber-500/10', label: 'Attention' },
  bad: { dot: 'bg-rose-500', chip: 'text-rose-700 dark:text-rose-300 bg-rose-500/10', label: 'Problem' },
};

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
] as const;
type Period = (typeof PERIODS)[number]['key'];
const REFRESH_MS = 15_000;

function periodFrom(p: Period): Date {
  if (p === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  return new Date(Date.now() - (p === '24h' ? 1 : p === '7d' ? 7 : 30) * 86_400_000);
}
const roleLabel = (r: string | null | undefined) => (!r || r === 'SYSTEM' ? 'System' : (ROLE_LABEL as Record<string, string>)[r] ?? r.replace(/_/g, ' ').toLowerCase());
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso); const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}
const since = (iso: string | null) => {
  if (!iso) return 'none yet';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
};
const titleOf = (i: Item) => (i.kind === 'change' && i.change ? actionLabel(i.change.action) : i.title);

export function ActivityTracker() {
  const { dark } = useTheme();
  const [period, setPeriod] = useState<Period>('today');
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [cls, setCls] = useState<{ id: string; label: string } | null>(null);
  const [live, setLive] = useState(true);
  const [rows, setRows] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Item | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [hidden, setHidden] = useState<Set<Group>>(new Set());
  const [exporting, setExporting] = useState(false);

  // `from` is fixed per period so paging doesn't drift; the live refresh re-reads from the top.
  const from = useMemo(() => periodFrom(period).toISOString(), [period]);
  const query = useMemo(() => {
    const p = new URLSearchParams({ from });
    if (kinds.length) p.set('kinds', kinds.join(','));
    if (person) p.set('personId', person.id);
    if (cls) p.set('classId', cls.id);
    return p;
  }, [from, kinds, person, cls]);
  const polling = live && (period === 'today' || period === '24h');

  const { data: summary, refetch: refetchSummary } = useApi<Summary>(`/audit/tracker/summary?from=${encodeURIComponent(from)}`);
  const { data: sessions } = useApi<LiveSession[]>('/audit/tracker/live', { refetchIntervalMs: polling ? REFRESH_MS : false, refetchWhenVisible: true });

  useEffect(() => {
    let alive = true;
    setRows(null); setCursor(null); setError(''); setFresh(new Set());
    api.get<FeedPage>(`/audit/tracker?${query}`).then((p) => { if (alive) { setRows(p.items); setCursor(p.nextCursor); } })
      .catch((e) => { if (alive) { setRows([]); setError(e instanceof Error ? e.message : 'Could not load activity'); } });
    return () => { alive = false; };
  }, [query]);

  // Live: fetch the newest page and prepend whatever is new, highlighting it briefly.
  const rowsRef = useRef<Item[] | null>(null);
  rowsRef.current = rows;
  const poll = useCallback(async () => {
    const p = await api.get<FeedPage>(`/audit/tracker?${query}`).catch(() => null);
    const cur = rowsRef.current;
    if (!p || !cur) return;
    const seen = new Set(cur.map((r) => r.id));
    const add = p.items.filter((i) => !seen.has(i.id));
    if (!add.length) return;
    setRows([...add, ...cur]);
    setFresh(new Set(add.map((a) => a.id)));
    void refetchSummary({ silent: true });
  }, [query, refetchSummary]);
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void poll(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [polling, poll]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const p = new URLSearchParams(query); p.set('cursor', cursor);
      const page = await api.get<FeedPage>(`/audit/tracker?${p}`);
      setRows((r) => [...(r ?? []), ...page.items]); setCursor(page.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load more'); } finally { setLoadingMore(false); }
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await api.getText(`/audit/tracker/export?${query}`);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = `activity-${period}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed'); } finally { setExporting(false); }
  };

  const toggleKind = (k: Kind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const onlyKinds = (ks: Kind[]) => setKinds((cur) => (cur.length === ks.length && ks.every((k) => cur.includes(k)) ? [] : ks));
  const followPerson = (p: Person | null) => { if (p && p.id !== 'system') { setPerson(p); setOpen(null); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const followClass = (id: string, label: string) => { setCls({ id, label }); setOpen(null); };
  const filtered = kinds.length > 0 || !!person || !!cls;
  const reset = () => { setKinds([]); setPerson(null); setCls(null); };

  const k = summary?.kinds;
  const tiles: { label: string; value: number | undefined; sub: string; kinds: Kind[]; icon: LucideIcon; warn?: boolean }[] = [
    { label: 'Check-ins', value: k?.checkin, sub: `${k?.checkout ?? 0} check-outs`, kinds: ['checkin', 'checkout'], icon: LogIn },
    { label: 'Refused or escalated', value: k ? k.blocked + k.escalation : undefined, sub: `${k?.escalation ?? 0} escalations`, kinds: ['blocked', 'escalation'], icon: ShieldAlert, warn: !!k && k.blocked + k.escalation > 0 },
    { label: 'Sign-in codes sent', value: k?.signin, sub: `${k?.device ?? 0} phone events · ${k?.password ?? 0} password`, kinds: ['signin', 'device', 'password'], icon: KeyRound },
    { label: 'Announcements', value: k?.announcement, sub: 'drafted, published, delivered', kinds: ['announcement'], icon: Megaphone },
    { label: 'Emails', value: k ? k.email + k.signin + k.password : undefined, sub: 'all emails sent by TCheck', kinds: ['email', 'signin', 'password'], icon: Mail },
    { label: 'Changes', value: k?.change, sub: 'edits by staff and admins', kinds: ['change'], icon: Activity },
  ];

  const color = (g: (typeof GROUPS)[number]) => (dark ? g.dark : g.light);
  const shownGroups = GROUPS.filter((g) => !hidden.has(g.key));
  const tick = (t: string) => {
    const d = new Date(t); // school-local wall time, written as UTC
    return summary?.unit === 'hour' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };

  // Day headers between rows.
  const grouped = useMemo(() => {
    const out: { day: string; label: string; items: Item[] }[] = [];
    for (const r of rows ?? []) {
      const key = dayKey(r.at);
      if (out[out.length - 1]?.day !== key) out.push({ day: key, label: dayLabel(r.at), items: [] });
      out[out.length - 1].items.push(r);
    }
    return out;
  }, [rows]);

  return (
    <div className="space-y-5" data-testid="activity-tracker">
      <style>{`@keyframes trk-in { from { background-color: rgb(59 130 246 / 0.14); } to { background-color: transparent; } } .trk-fresh { animation: trk-in 2.4s ease-out; }`}</style>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ key: p.key, label: p.label }))} />
        <div className="flex items-center gap-2">
          {(period === 'today' || period === '24h') && (
            <button type="button" onClick={() => setLive((v) => !v)} aria-pressed={live}
              className={clsx('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border', live ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400')}>
              {live ? <><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>Live · every 15 s<Pause size={12} /></> : <><Play size={12} />Resume live</>}
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={() => void exportCsv()} disabled={exporting}><Download size={14} className="mr-1.5" />{exporting ? 'Exporting…' : 'Export CSV'}</Button>
        </div>
      </div>

      {/* Headline counts: each tile filters the feed */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map((t) => {
          const active = kinds.length === t.kinds.length && t.kinds.every((x) => kinds.includes(x));
          return (
            <button key={t.label} type="button" onClick={() => onlyKinds(t.kinds)} aria-pressed={active}
              className={clsx('text-left rounded-xl border p-3.5 transition-colors bg-white dark:bg-white/[0.03]', active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20')}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-medium uppercase tracking-wide">{t.label}</span>
                <t.icon size={14} className={t.warn ? 'text-amber-500' : undefined} />
              </div>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{t.value === undefined ? '—' : t.value.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.sub}</p>
            </button>
          );
        })}
      </div>

      {/* What's on now */}
      <Card title="Sessions now" subtitle="In progress, starting within 30 minutes, or just ended. Updates live. Click a session to see only its activity.">
        {!sessions ? <Skeleton rows={2} /> : sessions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No sessions running right now.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sessions.map((s) => {
              const pct = s.enrolled ? Math.round((s.checkedIn / s.enrolled) * 100) : 0;
              const unseen = !s.isOnline && s.beacons.length > 0 && s.beacons.every((b) => !b.lastSeenAt);
              return (
                <button key={s.id} type="button" onClick={() => followClass(s.id, `${s.courseCode} · ${s.title}`)}
                  className={clsx('text-left rounded-xl border p-3.5 hover:border-blue-400 dark:hover:border-blue-500/60 transition-colors', cls?.id === s.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-white/10')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{s.courseCode} · {s.startLocal}–{s.endLocal}</span>
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', s.state === 'live' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : s.state === 'upcoming' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-slate-500/10 text-slate-500')}>
                      {s.state === 'live' && <Radio size={10} />}{s.state}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white truncate">{s.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.isOnline ? 'Online' : s.room ?? 'No room set'}</p>
                  <div className="mt-2.5 flex items-baseline justify-between text-xs">
                    <span className="text-slate-900 dark:text-white"><span className="text-base font-semibold tabular-nums">{s.checkedIn}</span> / {s.enrolled} checked in</span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checked in">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{s.late} late</span><span>{s.checkedOut} out</span><span>last check-in {since(s.lastCheckInAt)}</span>
                    {s.openEscalations > 0 && <span className="text-rose-600 dark:text-rose-400">{s.openEscalations} open escalation{s.openEscalations > 1 ? 's' : ''}</span>}
                  </div>
                  {!s.isOnline && (
                    <p className={clsx('mt-1.5 flex items-center gap-1 text-[11px]', unseen || !s.beacons.length ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>
                      <Bluetooth size={11} />
                      {s.beacons.length ? s.beacons.map((b) => b.name).join(', ') : 'No beacon linked'}
                      {unseen && ' · never detected yet'}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Activity over time */}
      <Card
        title="Activity over time"
        subtitle={summary ? `${summary.total.toLocaleString()} events · per ${summary.unit} · school time` : 'Loading…'}
        action={<button type="button" onClick={() => setShowTable((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"><Table2 size={13} />{showTable ? 'Show chart' : 'Show table'}</button>}
      >
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Series">
          {GROUPS.map((g) => (
            <button key={g.key} type="button" onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
              aria-pressed={!hidden.has(g.key)}
              className={clsx('inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs', hidden.has(g.key) ? 'border-dashed border-gray-300 dark:border-white/15 text-slate-400' : 'border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-200')}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: hidden.has(g.key) ? 'transparent' : color(g), border: `1.5px solid ${color(g)}` }} aria-hidden />
              {g.label}<span className="tabular-nums text-slate-500 dark:text-slate-400">{summary ? summary.groups[g.key].toLocaleString() : '—'}</span>
            </button>
          ))}
        </div>
        {!summary ? <Skeleton rows={4} /> : showTable ? (
          <div className="overflow-x-auto max-h-72 -mx-5">
            <table className="w-full">
              <thead><tr><th className={thCls}>{summary.unit === 'hour' ? 'Hour' : 'Day'}</th>{GROUPS.map((g) => <th key={g.key} className={clsx(thCls, 'text-right')}>{g.label}</th>)}</tr></thead>
              <tbody>
                {summary.series.filter((r) => GROUPS.some((g) => r[g.key])).map((r) => (
                  <tr key={r.t}><td className={tdCls}>{tick(r.t)}</td>{GROUPS.map((g) => <td key={g.key} className={clsx(tdCls, 'text-right tabular-nums')}>{r[g.key]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-56" aria-label="Activity over time, stacked by kind">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'} />
                <XAxis dataKey="t" tickFormatter={tick} tick={{ fontSize: 11, fill: dark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: dark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                  content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium text-slate-900 dark:text-white mb-1">{tick(String(label))}</p>
                      {[...payload].reverse().map((p) => (
                        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{GROUPS.find((g) => g.key === p.dataKey)?.label}
                          <span className="ml-auto pl-3 tabular-nums text-slate-900 dark:text-white">{String(p.value)}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                />
                {shownGroups.map((g, i) => (
                  <Bar key={g.key} dataKey={g.key} stackId="a" fill={color(g)} stroke={dark ? '#0f172a' : '#ffffff'} strokeWidth={1}
                    radius={i === shownGroups.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={28} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* The feed */}
      <Card title="Activity feed" subtitle="Newest first. Click any event for every detail; click a name to follow that person.">
        <div className="space-y-3 mb-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <PersonPicker value={person} onChange={setPerson} />
            <div className="flex flex-wrap gap-1.5 flex-1" role="group" aria-label="Kinds of activity">
              {KINDS.map((kd) => {
                const on = kinds.includes(kd); const K = KIND[kd];
                return (
                  <button key={kd} type="button" onClick={() => toggleKind(kd)} aria-pressed={on}
                    className={clsx('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', on ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-white/20')}>
                    <K.icon size={12} />{K.label}<span className="tabular-nums text-slate-400">{summary?.kinds[kd] ?? ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {filtered && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {person && <Pill onClear={() => setPerson(null)}><UserRound size={12} />Following {person.name}</Pill>}
              {cls && <Pill onClear={() => setCls(null)}><Radio size={12} />{cls.label}</Pill>}
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"><RotateCcw size={12} />Clear all</button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        {!rows ? <Skeleton rows={8} /> : rows.length === 0 ? (
          <Placeholder icon={<Activity size={22} />} title={filtered ? 'Nothing matches these filters' : 'No activity in this period'}>
            {filtered ? 'Try a longer period or clear the filters.' : 'Check-ins, sign-ins, announcements and changes will appear here as they happen.'}
          </Placeholder>
        ) : (
          <>
            <div className="-mx-5">
              {grouped.map((g) => (
                <section key={g.day}>
                  <h3 className="sticky top-0 z-10 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur border-y border-gray-100 dark:border-white/5">
                    {g.label} <span className="font-normal normal-case tracking-normal">· {g.items.length}{cursor && g === grouped[grouped.length - 1] ? '+' : ''} events</span>
                  </h3>
                  <ol>
                    {g.items.map((r) => <FeedRow key={r.id} r={r} fresh={fresh.has(r.id)} onOpen={() => setOpen(r)} onPerson={followPerson} onClass={followClass} dark={dark} />)}
                  </ol>
                </section>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 text-xs text-slate-500 dark:text-slate-400">
              <span>Showing {rows.length.toLocaleString()}{summary && !filtered ? ` of ${summary.total.toLocaleString()}` : ''}</span>
              {cursor && <Button variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load older'}</Button>}
            </div>
          </>
        )}
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? titleOf(open) : ''}>
        {open && <ItemDetail r={open} onPerson={followPerson} onClass={followClass} />}
      </Modal>
    </div>
  );
}

function FeedRow({ r, fresh, onOpen, onPerson, onClass, dark }: { r: Item; fresh: boolean; onOpen: () => void; onPerson: (p: Person | null) => void; onClass: (id: string, label: string) => void; dark: boolean }) {
  const K = KIND[r.kind];
  const g = GROUPS.find((x) => x.key === r.group)!;
  const c = dark ? g.dark : g.light;
  return (
    <li className={clsx('group flex gap-3 px-5 py-2.5 border-b border-gray-100 dark:border-white/5 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] cursor-pointer', fresh && 'trk-fresh')}
      onClick={onOpen} data-testid="tracker-row">
      <span className="w-[84px] shrink-0 whitespace-nowrap pt-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400" title={new Date(r.at).toLocaleString()}>{clock(r.at)}</span>
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: `${c}1f`, color: c }} aria-hidden><K.icon size={13} /></span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
          {r.actor && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onPerson(r.actor); }} className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline">{r.actor.name}</button>
          )}
          <span className="text-slate-700 dark:text-slate-300">{r.actor ? titleOf(r).replace(/^./, (m) => m.toLowerCase()) : titleOf(r)}</span>
          {r.subject && r.subject.id !== r.actor?.id && (
            <><span className="text-slate-400">·</span><button type="button" onClick={(e) => { e.stopPropagation(); onPerson(r.subject); }} className="text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:underline">{r.subject.name}</button></>
          )}
          {r.tone !== 'ok' && r.tone !== 'info' && <span className={clsx('rounded px-1.5 py-px text-[10px] font-semibold uppercase', TONE[r.tone].chip)}>{TONE[r.tone].label}</span>}
        </p>
        {r.detail && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {r.classId && r.target ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onClass(r.classId!, r.target!.label ?? 'Session'); }} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">{r.detail}</button>
            ) : r.detail}
          </p>
        )}
      </div>
      <span className="hidden sm:block shrink-0 pt-0.5 text-[11px] text-slate-400">{roleLabel(r.actor?.role)}</span>
    </li>
  );
}

function ItemDetail({ r, onPerson, onClass }: { r: Item; onPerson: (p: Person | null) => void; onClass: (id: string, label: string) => void }) {
  if (r.kind === 'change' && r.change) {
    const row: AuditRow = {
      id: r.id.slice('change:'.length), at: r.at, actorId: r.actor?.id === 'system' ? null : r.actor?.id ?? null, actorRole: r.actor?.role ?? 'SYSTEM',
      actorName: r.actor?.id === 'system' ? null : r.actor?.name ?? null, action: r.change.action, category: r.change.category as AuditCategory,
      entityType: r.change.entityType, entityId: r.change.entityId, entityLabel: r.target?.label ?? null, subjectUserId: r.subject?.id ?? null,
      subjectName: r.subject?.name ?? null, cohortId: null, cohortName: null, before: r.change.before, after: r.change.after, reason: r.change.reason, requestId: r.change.requestId,
    };
    return <AuditDetail row={row} />;
  }
  const fmt = (v: string) => (/^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString() : v);
  return (
    <div className="space-y-4" data-testid="tracker-detail">
      <dl>
        <DetailField label="When">{new Date(r.at).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' })}</DetailField>
        <DetailField label="What"><span className="inline-flex items-center gap-2"><span className={clsx('h-2 w-2 rounded-full', TONE[r.tone].dot)} />{titleOf(r)}</span></DetailField>
        <DetailField label="Kind">{KIND[r.kind].label} · {GROUPS.find((g) => g.key === r.group)?.label}</DetailField>
        {r.actor && <DetailField label="Who"><button type="button" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => onPerson(r.actor)}>{r.actor.name}</button> <span className="text-slate-500">· {roleLabel(r.actor.role)}</span></DetailField>}
        {r.subject && <DetailField label="Person affected"><button type="button" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => onPerson(r.subject)}>{r.subject.name}</button></DetailField>}
        {r.target && <DetailField label={r.target.type === 'Class' ? 'Session' : 'On'}>{r.classId ? <button type="button" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => onClass(r.classId!, r.target!.label ?? 'Session')}>{r.target.label}</button> : r.target.label ?? '—'}</DetailField>}
        {r.detail && !['signin', 'password', 'email'].includes(r.kind) && <DetailField label="Context">{r.detail}</DetailField>}
        {r.facts.map(([k, v]) => <DetailField key={k} label={k}>{fmt(v)}</DetailField>)}
      </dl>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer select-none">Technical details</summary>
        <dl className="mt-2 space-y-1 font-mono">
          <div>event: {r.id}</div>
          {r.actor && <div>actor: {r.actor.id}</div>}
          {r.subject && <div>subject: {r.subject.id}</div>}
          {r.target && <div>{r.target.type}: {r.target.id}</div>}
        </dl>
      </details>
    </div>
  );
}

function Pill({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 font-medium text-blue-700 dark:text-blue-300">
      {children}
      <button type="button" onClick={onClear} aria-label="Remove filter" className="hover:text-blue-900 dark:hover:text-white"><X size={12} /></button>
    </span>
  );
}

/** Search anyone in the school by name, email or student ID, and follow their trail. */
function PersonPicker({ value, onChange }: { value: Person | null; onChange: (p: Person | null) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [openList, setOpenList] = useState(false);
  useEffect(() => {
    if (!openList) return;
    const t = setTimeout(() => { api.get<PersonHit[]>(`/audit/tracker/people?q=${encodeURIComponent(q)}`).then(setHits).catch(() => setHits([])); }, 200);
    return () => clearTimeout(t);
  }, [q, openList]);
  return (
    <div className="relative w-full lg:w-72 shrink-0 self-start">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        value={q} onChange={(e) => { setQ(e.target.value); setOpenList(true); }} onFocus={() => setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)}
        placeholder={value ? `Following ${value.name}` : 'Follow a person: name, email or ID'} aria-label="Follow a person"
        className={clsx(inputCls, '!py-1.5 pl-9 text-[13px]')}
      />
      {openList && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg py-1">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ id: h.id, name: h.name, role: h.role }); setQ(''); setOpenList(false); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5">
                <p className="text-[13px] text-slate-900 dark:text-white">{h.name}</p>
                <p className="text-[11px] text-slate-500">{roleLabel(h.role)}{h.studentId ? ` · ${h.studentId}` : ''} · {h.email}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

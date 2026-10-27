import { useEffect, useState } from 'react';
import type { ElementType } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowUpRight, Bell, CalendarClock, CheckCircle2, Clock, Download, Flag, FolderOpen, LifeBuoy, MessageSquare, Phone,
  Send, StickyNote, Target, Timer, TrendingUp, UserCheck, Users, X,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';

/**
 * Follow-ups (F3, spec 2026-10-20) — where advisers work the students the weekly rules flagged.
 * Tabs: My cases, Unassigned, All (within reach), Closed. A case opens in a panel: why the student was
 * flagged, eight weeks of attendance, the timeline, and every action — assign, message (through
 * TALI's action engine: preview, then send), log a call or meeting, note (optionally sensitive), next
 * step, escalate, close with an outcome. VC and DVC see the numbers only.
 * Server: /follow-ups/* and POST /agent/actions (followup.message).
 */

type Tab = 'mine' | 'unassigned' | 'all' | 'closed';
interface Person { id: string; name: string; studentNumber?: string | null }
interface Row { id: string; status: string; openedAt: string; nextStepDue: string | null; overdue: boolean; student: Person; cohort: string | null; reasons: string[]; owner: Person | null; escalatedTo: Person | null }
interface Stats { nudged?: number; open: number; contacted: number; escalated: number; closed: number; total: number; contactedPercent: number | null; recoveredPercent: number | null; medianDaysToContact: number | null }
interface ListResponse { countsOnly?: boolean; cases?: Row[]; counts?: Record<Tab, number>; stats?: Stats }
interface CaseDetail {
  id: string; status: string; openedAt: string; firstContactAt: string | null; nextStepDue: string | null; overdue: boolean;
  outcome: string | null; outcomeReason: string | null; recoveredAt: string | null; recoveryRate: number | null; recoveredBy: string | null; student: Person; owner: Person | null; escalatedTo: Person | null;
  reasons: { text: string; at: string }[]; strip: { weekStart: string; held: number; attended: number }[];
  recovery: { before: { percent: number } | null; since: { percent: number } | null; recovered: boolean } | null;
  canAssign: boolean; timeline: { id: string; kind: string; at: string; by: string | null; sensitive: boolean; body: string | null }[];
}

const muted = 'text-slate-600 dark:text-slate-400';
const inputCls = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—');
const DAY_MS = 86_400_000;
/** "today", "in 3 days", "2 days late": how far a date is from today, by calendar day. */
const rel = (s: string) => {
  const a = new Date(s); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const d = Math.round((a.getTime() - b.getTime()) / DAY_MS);
  return d === 0 ? 'today' : d === 1 ? 'tomorrow' : d === -1 ? 'yesterday' : d > 0 ? `in ${d} days` : `${-d} days ago`;
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return <span aria-hidden className={clsx('shrink-0 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 font-semibold flex items-center justify-center', size === 'lg' ? 'w-11 h-11 text-sm' : 'w-8 h-8 text-xs')}>{initials(name) || '?'}</span>;
}
const when = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  NUDGED: { label: 'Nudged, watching', cls: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300', dot: 'bg-teal-500' },
  OPEN: { label: 'Not contacted', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500' },
  CONTACTED: { label: 'Contacted', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300', dot: 'bg-blue-500' },
  MONITORING: { label: 'Check outcome', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300', dot: 'bg-indigo-500' },
  ESCALATED: { label: 'Escalated', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500' },
  CLOSED: { label: 'Closed', cls: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300', dot: 'bg-gray-400' },
};
const EVENT: Record<string, string> = {
  FLAGGED: 'Flagged', NUDGE_SENT: 'Student nudged', CASE_OPENED: 'Case opened', RECOVERED: 'Recovered (confirmed by attendance)', ASSIGNED: 'Assigned', MESSAGE_SENT: 'Message sent', CONTACT_LOGGED: 'Contact logged', NOTE: 'Note', REMINDER: 'Reminder',
  ESCALATED: 'Escalated', NEXT_STEP: 'Next step set', OUTCOME_DUE: 'Outcome due', CLOSED: 'Closed',
};
const EVENT_ICON: Record<string, { icon: ElementType; cls: string }> = {
  FLAGGED: { icon: Flag, cls: 'bg-amber-500/10 text-amber-600' }, NUDGE_SENT: { icon: Bell, cls: 'bg-teal-500/10 text-teal-600' },
  CASE_OPENED: { icon: FolderOpen, cls: 'bg-gray-500/10 text-gray-500' }, RECOVERED: { icon: TrendingUp, cls: 'bg-green-500/10 text-green-600' },
  ASSIGNED: { icon: UserCheck, cls: 'bg-blue-500/10 text-blue-600' }, MESSAGE_SENT: { icon: Send, cls: 'bg-blue-500/10 text-blue-600' },
  CONTACT_LOGGED: { icon: Phone, cls: 'bg-blue-500/10 text-blue-600' }, NOTE: { icon: StickyNote, cls: 'bg-gray-500/10 text-gray-500' },
  REMINDER: { icon: Clock, cls: 'bg-amber-500/10 text-amber-600' }, ESCALATED: { icon: ArrowUpRight, cls: 'bg-red-500/10 text-red-600' },
  NEXT_STEP: { icon: CalendarClock, cls: 'bg-indigo-500/10 text-indigo-600' }, OUTCOME_DUE: { icon: Target, cls: 'bg-indigo-500/10 text-indigo-600' },
  CLOSED: { icon: CheckCircle2, cls: 'bg-gray-500/10 text-gray-500' },
};
const OUTCOMES = [['BACK_ON_TRACK', 'Back on track'], ['WITHDREW', 'Withdrew'], ['TRANSFERRED', 'Transferred'], ['OTHER', 'Other']] as const;
const OUTCOME_WORDS: Record<string, string> = { BACK_ON_TRACK: 'Back on track', WITHDREW: 'Withdrew', TRANSFERRED: 'Transferred', OTHER: 'Other', NO_FURTHER_SIGNS: 'No new signs (recovery not confirmed)' };
const REASONS = [['FEES', 'Fees / HELB'], ['FAMILY', 'Family'], ['HEALTH', 'Health'], ['ACADEMIC', 'Academic'], ['WORK', 'Work'], ['OTHER', 'Other'], ['NONE', 'No reason given']] as const;
const HOW = [['CALL', 'Phone call'], ['MEETING', 'Met in person'], ['MESSAGE_ELSEWHERE', 'Messaged elsewhere'], ['NO_ANSWER', 'Tried, no answer']] as const;

function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: '' };
  return <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', s.cls)}><span className={clsx('w-1.5 h-1.5 rounded-full', s.dot ?? 'bg-gray-400')} />{s.label}</span>;
}

/** Where every case is right now (a stage strip, coloured like the status chips), then how well the work is going. */
function Numbers({ s }: { s: Stats }) {
  const stages: [string, number][] = [['NUDGED', s.nudged ?? 0], ['OPEN', s.open], ['CONTACTED', s.contacted], ['ESCALATED', s.escalated], ['CLOSED', s.closed]];
  const total = stages.reduce((n, [, v]) => n + v, 0);
  return (
    <div className="space-y-3">
      <GlassCard className="!p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Where cases are</p>
          <p className={clsx('text-xs', muted)}>{total} in total</p>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10" aria-hidden>
          {total > 0 && stages.map(([k, v]) => v > 0 && <div key={k} className={STATUS[k]!.dot} style={{ width: `${(v / total) * 100}%` }} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
          {stages.map(([k, v]) => (
            <div key={k}>
              <p className={clsx('text-xs flex items-center gap-1.5', muted)}><span className={clsx('w-2 h-2 rounded-full', STATUS[k]!.dot)} />{k === 'NUDGED' ? 'Nudged' : STATUS[k]!.label}</p>
              <p className="text-xl font-semibold text-slate-950 dark:text-white tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </GlassCard>
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard size="compact" color="blue" icon={<MessageSquare size={18} />} title="Contacted" value={s.contactedPercent === null ? '—' : `${s.contactedPercent}%`} />
        <StatCard size="compact" color="green" icon={<TrendingUp size={18} />} title="Back on track" value={s.recoveredPercent === null ? '—' : `${s.recoveredPercent}%`} />
        <StatCard size="compact" color="amber" icon={<Timer size={18} />} title="Days to first contact" value={s.medianDaysToContact ?? '—'} />
      </div>
    </div>
  );
}

interface TrackRecord {
  nudge: { nudged: number; recovered: number; recoveredPercent: number | null; wentToAdviser: number; stillWatching: number; noFurtherSigns: number; medianDaysToRecover: number | null };
  adviser: { contacted: number; recovered: number; recoveredPercent: number | null; medianDaysToRecover: number | null; reportedNotConfirmed: number; withdrew: number };
  attendance: { before: number | null; after: number | null };
  byReason: { code: string; cases: number; recovered: number; recoveredPercent: number }[];
}
const REASON_WORDS: Record<string, string> = { low_rate: 'Low attendance', drop: 'Sudden drop', silence: 'Gone quiet', exam_risk: 'Exam risk', term_start: 'Nothing since term start', other: 'Other' };

/** What happened after nudges and after advisers, confirmed by attendance (checked in AND out). Numbers only. */
function TrackRecordCard() {
  const { data: t } = useApi<TrackRecord>('/follow-ups/track-record');
  const [msg, setMsg] = useState('');
  if (!t || (!t.nudge.nudged && !t.adviser.contacted)) return null;
  const exportCsv = async () => {
    try {
      const csv = await api.getText('/follow-ups/track-record?format=csv');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = 'follow-up-track-record.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not export'); }
  };
  const box = (title: string, main: string, sub: string) => (
    <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3"><p className={clsx('text-xs font-medium', muted)}>{title}</p><p className="text-lg font-semibold text-slate-950 dark:text-white mt-0.5">{main}</p><p className={clsx('text-xs mt-0.5', muted)}>{sub}</p></div>
  );
  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Track record</h2>
          <p className={clsx('text-xs', muted)}>Recovery counts only when attendance shows it: the student checking in and out again on their own. No names; safe to share.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void exportCsv()}><Download size={14} className="mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {box('After a nudge', t.nudge.recoveredPercent === null ? '—' : `${t.nudge.recovered} of ${t.nudge.nudged} recovered (${t.nudge.recoveredPercent}%)`, `${t.nudge.wentToAdviser} needed an adviser · ${t.nudge.stillWatching} still watching${t.nudge.medianDaysToRecover !== null ? ` · ${t.nudge.medianDaysToRecover} days to recover` : ''}`)}
        {box('After an adviser', t.adviser.recoveredPercent === null ? '—' : `${t.adviser.recovered} of ${t.adviser.contacted} recovered (${t.adviser.recoveredPercent}%)`, `${t.adviser.withdrew} withdrew${t.adviser.medianDaysToRecover !== null ? ` · ${t.adviser.medianDaysToRecover} days to recover` : ''}`)}
        {box('Attendance of recovered students', t.attendance.before === null ? '—' : `${t.attendance.before}% → ${t.attendance.after}%`, 'before help → after (checked in and out)')}
        {box('Closed as back on track, not confirmed', String(t.adviser.reportedNotConfirmed), "an adviser's word, not yet shown in attendance")}
      </div>
      {t.byReason.length > 0 && (
        <div className="mt-4 space-y-2" aria-label="Recovery by why students were flagged">
          <p className={clsx('text-xs font-medium', muted)}>Recovery by why students were flagged</p>
          {t.byReason.map((r) => (
            <div key={r.code} className="grid grid-cols-[9rem_1fr_6.5rem] items-center gap-3 text-sm text-slate-950 dark:text-white">
              <span className="truncate">{REASON_WORDS[r.code] ?? r.code}</span>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-green-500" style={{ width: `${r.recoveredPercent}%` }} /></div>
              <span className="text-xs tabular-nums text-right">{r.recovered} of {r.cases} ({r.recoveredPercent}%)</span>
            </div>
          ))}
        </div>
      )}
      {msg && <p role="status" className={clsx('text-xs mt-2', muted)}>{msg}</p>}
    </GlassCard>
  );
}

interface Summary { needYou: number; nudged: number; newThisWeek: number; waitingOverWeek: number; students: number; byDepartment: { name: string; students: number }[]; hiddenDepartments: number; minGroupSize: number; attendance: { lastWeek: string; change: string } | null }

/** This week in one line (what TALI's "This week" used to show), with where the students are, folded. */
function WeekLine() {
  const { data: w } = useApi<Summary>('/follow-ups/summary');
  const [open, setOpen] = useState(false);
  if (!w) return null;
  const ch = w.attendance?.change ?? '—';
  const trend = !w.attendance || ch === '—' ? '' : ch.startsWith('-') ? `, down ${ch.slice(1)}` : ch.startsWith('+') ? `, up ${ch.slice(1)}` : ', no change';
  const max = Math.max(1, ...w.byDepartment.map((d) => d.students));
  const bold = (n: number, words: string) => <strong className="font-semibold text-slate-950 dark:text-white">{n} {words}</strong>;
  return (
    <GlassCard className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">This week</p>
      <p className={clsx('text-[15px] leading-relaxed mt-1', muted)}>
        {w.needYou ? bold(w.needYou, w.needYou === 1 ? 'student needs someone' : 'students need someone') : <strong className="font-semibold text-slate-950 dark:text-white">Nobody needs a check-in right now</strong>}
        {w.newThisWeek > 0 && <>, {w.newThisWeek} new since Monday</>}
        {w.waitingOverWeek > 0 && <>, <span className="text-red-600 dark:text-red-400 font-medium">{w.waitingOverWeek} waiting over a week with nobody in touch</span></>}.
        {w.nudged > 0 && <> {w.nudged} more were nudged and are being watched.</>}
        {w.attendance && <> Attendance in the last 7 days: <strong className="font-semibold text-slate-950 dark:text-white">{w.attendance.lastWeek}</strong>{trend}.</>}
      </p>
      {w.byDepartment.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300 cursor-pointer hover:underline">{open ? 'Hide' : 'Where they are, by department'}</button>
          {open && (
            <div className="mt-3 space-y-1.5 max-w-xl">
              {w.byDepartment.map((d) => (
                <div key={d.name} className="grid grid-cols-[minmax(0,12rem)_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate text-slate-800 dark:text-slate-200">{d.name.replace(/^Department of /, '')}</span>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(d.students / max) * 100}%` }} /></div>
                  <span className={clsx('text-xs tabular-nums text-right', muted)}>{d.students}</span>
                </div>
              ))}
              <p className={clsx('text-[11px] pt-1', muted)}>Students with an open case, by the department that teaches them (a student can count in more than one).{w.hiddenDepartments ? ` ${w.hiddenDepartments} department(s) with fewer than ${w.minGroupSize} are not shown.` : ''}</p>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}

export function FollowUpsPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const qs = new URLSearchParams({ tab, ...(search.trim() ? { search: search.trim() } : {}) });
  const { data, loading, error, refetch } = useApi<ListResponse>(`/follow-ups?${qs}`);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500"><LifeBuoy size={22} /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Follow-ups</h1>
          <p className={clsx('text-sm mt-1 max-w-3xl', muted)}>Students who started missing classes, flagged every Monday from attendance. Milder cases get an automatic nudge first ("Nudged, watching"); the rest need you. Reach out, record what happened, and close each case with an outcome.</p>
        </div>
      </div>

      <WeekLine />

      {data?.countsOnly ? (
        <>
          <GlassCard>
            <Numbers s={data as unknown as Stats} />
            <p className={clsx('text-xs mt-3', muted)}>You see the numbers only. Students' names are visible to the staff working their cases.</p>
          </GlassCard>
          <TrackRecordCard />
        </>
      ) : (
        <>
          {data?.stats && <Numbers s={data.stats} />}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div role="tablist" aria-label="Cases" className="inline-flex flex-wrap rounded-xl bg-gray-100 dark:bg-white/5 p-1 text-sm self-start">
              {(['mine', 'unassigned', 'all', 'closed'] as Tab[]).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={clsx('px-3 py-1.5 rounded-lg cursor-pointer transition-colors', tab === t ? 'bg-white dark:bg-white/15 shadow-sm font-medium text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>
                  {{ mine: 'My cases', unassigned: 'Unassigned', all: 'All', closed: 'Closed' }[t]}
                  {data?.counts && <span className={clsx('ml-1.5 px-1.5 rounded-md text-xs tabular-nums', tab === t ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300' : 'bg-gray-200/70 dark:bg-white/10')}>{data.counts[t]}</span>}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto sm:w-72"><SearchInput aria-label="Search by student" placeholder="Search by student" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <GlassCard className="!p-0 overflow-hidden">
            {error ? <p className="text-sm text-red-600 p-6">{error}</p> : loading && !data ? (
              <div className="p-4 space-y-3" aria-label="Loading">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}</div>
            ) : !data?.cases?.length ? (
              <EmptyState icon={search.trim() ? Users : CheckCircle2} title={search.trim() ? 'No students match that search.' : tab === 'mine' ? 'No cases for you right now.' : tab === 'unassigned' ? 'Nothing waiting to be assigned.' : 'No cases here.'}
                description={!search.trim() && tab === 'mine' ? 'New cases arrive with the Monday run.' : undefined} />
            ) : (
              <>
                {/* Phones: one card per case. */}
                <ul className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
                  {data.cases.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setOpenId(r.id)} className={clsx('w-full text-left p-4 flex gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5', r.overdue && 'border-l-2 border-red-500')}>
                        <Avatar name={r.student.name} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-start justify-between gap-2"><p className="font-medium text-slate-950 dark:text-white truncate">{r.student.name}</p><StatusChip status={r.status} /></div>
                          <div className="flex flex-wrap gap-1">{r.reasons.slice(0, 2).map((x) => <span key={x} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">{x}</span>)}</div>
                          <p className={clsx('text-xs', muted)}>{r.owner?.name ?? 'Unassigned'}{r.nextStepDue ? ` · next step ${rel(r.nextStepDue)}` : ''}{r.overdue ? ' · overdue' : ''}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 dark:bg-white/5"><tr className={clsx('text-left text-xs uppercase tracking-wide', muted)}><th className="py-3 pl-5 pr-3 font-medium">Student</th><th className="pr-3 font-medium">Why</th><th className="pr-3 font-medium">Opened</th><th className="pr-3 font-medium">Owner</th><th className="pr-3 font-medium">Status</th><th className="pr-5 font-medium">Next step</th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {data.cases.map((r) => (
                        <tr key={r.id} onClick={() => setOpenId(r.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(r.id); }}
                          className={clsx('cursor-pointer hover:bg-blue-50/40 dark:hover:bg-white/5 focus:outline-none focus-visible:bg-blue-50/60 text-slate-950 dark:text-white transition-colors', r.overdue && 'shadow-[inset_3px_0_0_0_rgb(239_68_68)]')}>
                          <td className="py-3 pl-5 pr-3"><div className="flex items-center gap-3"><Avatar name={r.student.name} /><div className="min-w-0"><p className="font-medium truncate">{r.student.name}</p><p className={clsx('text-xs', muted)}>{r.cohort ?? r.student.studentNumber ?? ''}</p></div></div></td>
                          <td className="pr-3"><div className="flex flex-wrap gap-1">{r.reasons.slice(0, 2).map((x) => <span key={x} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">{x}</span>)}{r.reasons.length > 2 && <span className={clsx('text-xs', muted)}>+{r.reasons.length - 2}</span>}</div></td>
                          <td className={clsx('pr-3 whitespace-nowrap', muted)}>{day(r.openedAt)}</td>
                          <td className="pr-3 whitespace-nowrap">{r.owner?.name ?? <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}</td>
                          <td className="pr-3"><StatusChip status={r.status} /></td>
                          <td className="pr-5 whitespace-nowrap">{r.nextStepDue ? <span title={day(r.nextStepDue)} className={r.overdue ? 'text-red-600 dark:text-red-400 font-medium' : undefined}>{rel(r.nextStepDue)}</span> : <span className={muted}>—</span>}{r.overdue && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">Overdue</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </GlassCard>
          {data?.stats && <TrackRecordCard />}
        </>
      )}
      {openId && <CasePanel id={openId} onClose={() => setOpenId(null)} onChanged={refetch} />}
    </div>
  );
}

function CasePanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data: c, refetch } = useApi<CaseDetail>(`/follow-ups/${id}`);
  const { data: owners } = useApi<{ owners: { id: string; name: string }[] }>(c?.canAssign ? '/follow-ups/owners' : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [panel, setPanel] = useState<'message' | 'contact' | 'note' | 'close' | null>(null);
  const [text, setText] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [how, setHow] = useState<string>('CALL');
  const [outcome, setOutcome] = useState<string>('BACK_ON_TRACK');
  const [reason, setReason] = useState<string>('NONE');
  const [preview, setPreview] = useState<{ actionId: string; summary: string; warnings: string[] } | null>(null);
  useEffect(() => { setText(''); setSensitive(false); setPreview(null); setMsg(''); }, [panel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); await refetch(); onChanged(); setPanel(null); setMsg(ok); } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  const openMessage = async () => {
    setPanel('message');
    try { const d = await api.get<{ body: string }>(`/follow-ups/${id}/draft`); setText(d.body); } catch { /* the owner writes it */ }
  };
  const previewMessage = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await api.post<{ action: { id: string }; preview: { summary: string; warnings: string[] } }>('/agent/actions', { type: 'followup.message', params: { caseId: id, body: text.trim() } });
      setPreview({ actionId: r.action.id, summary: r.preview.summary, warnings: r.preview.warnings });
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not prepare the message'); } finally { setBusy(false); }
  };
  const send = () => done(async () => {
    const r = await api.post<{ status: string; error?: string | null }>(`/agent/actions/${preview!.actionId}/confirm`, {});
    if (r.status !== 'DONE') throw new Error(r.error || 'The message was not sent');
  }, 'Sent. The student can reply in the app.');

  if (!c) return null;
  const closed = c.status === 'CLOSED';
  const maxHeld = Math.max(1, ...c.strip.map((w) => w.held));
  const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2';
  const form = 'rounded-2xl border border-blue-200/70 dark:border-blue-400/20 bg-blue-50/40 dark:bg-blue-500/5 p-4 space-y-3';
  const formHead = (title: string) => (
    <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p><button type="button" aria-label="Cancel" onClick={() => setPanel(null)} className="p-1 rounded-lg hover:bg-white/70 dark:hover:bg-white/10 cursor-pointer"><X size={14} /></button></div>
  );
  const sensitiveBox = (label: string) => (
    <label className={clsx('flex items-center gap-2 text-xs', muted)}><input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} /> {label}</label>
  );
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div role="dialog" aria-label={`Follow-up for ${c.student.name}`} className="w-full max-w-xl h-full overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-gray-100 dark:border-white/10 px-6 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={c.student.name} size="lg" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white truncate">{c.student.name}</h2>
              <p className={clsx('text-xs', muted)}>{c.student.studentNumber ?? ''} · opened {day(c.openedAt)}{c.owner ? ` · ${c.owner.name}` : ' · unassigned'}{c.escalatedTo ? ` · escalated to ${c.escalatedTo.name}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0"><StatusChip status={c.status} /><button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"><X size={18} /></button></div>
        </div>

        <div className="p-6 space-y-6">
          {c.recoveredAt && (
            <p className="text-sm rounded-xl px-3 py-2.5 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 flex gap-2">
              <TrendingUp size={16} className="mt-0.5 shrink-0" />
              <span>Recovered, confirmed by attendance: {c.recoveryRate}% since the {c.recoveredBy === 'NUDGE' ? 'nudge' : 'first contact'} ({day(c.recoveredAt)}).{c.recoveredBy === 'ADVISER' && !closed ? ' Close the case when you are happy.' : ''}</span>
            </p>
          )}
          {closed && <p className="text-sm rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-white/5 text-slate-950 dark:text-white flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gray-500" /><span>Closed: {OUTCOME_WORDS[c.outcome ?? ''] ?? c.outcome}{c.outcomeReason && c.outcomeReason !== 'NONE' ? ` (${REASONS.find(([v]) => v === c.outcomeReason)?.[1]})` : ''}.</span></p>}

          <section>
            <h3 className={sectionTitle}>Why</h3>
            <ul className="space-y-1.5">{[...c.reasons].reverse().slice(0, 4).map((r, i) => (
              <li key={i} className="text-sm text-slate-800 dark:text-slate-200 flex gap-2"><Flag size={14} className="mt-0.5 shrink-0 text-amber-500" /><span>{r.text} <span className={clsx('text-xs', muted)}>({day(r.at)})</span></span></li>
            ))}</ul>
          </section>

          <section>
            <h3 className={sectionTitle}>Attendance, last 8 weeks</h3>
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <div className="flex items-end gap-1.5 h-24" aria-label="Attended classes per week">
                {c.strip.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${w.attended} of ${w.held} classes, week of ${day(w.weekStart)}`}>
                    <div className="w-full rounded-md bg-gray-200/80 dark:bg-white/10 relative overflow-hidden" style={{ height: `${(w.held / maxHeld) * 64 + 4}px` }}>
                      <div className={clsx('absolute bottom-0 w-full', w.held && w.attended / w.held < 0.5 ? 'bg-red-400' : 'bg-blue-500')} style={{ height: `${w.held ? (w.attended / w.held) * 100 : 0}%` }} />
                    </div>
                    <span className={clsx('text-[10px] tabular-nums', muted)}>{w.held ? `${w.attended}/${w.held}` : '–'}</span>
                  </div>
                ))}
              </div>
              <div className={clsx('flex justify-between text-[10px] mt-1', muted)}><span>{c.strip[0] ? day(c.strip[0].weekStart) : ''}</span><span>this week</span></div>
              {c.recovery && (
                <p className={clsx('text-xs mt-3', c.recovery.recovered ? 'text-green-700 dark:text-green-400' : muted)}>
                  Since first contact: {c.recovery.since ? `${c.recovery.since.percent}%` : 'no classes yet'} (before: {c.recovery.before ? `${c.recovery.before.percent}%` : '—'}).{c.recovery.recovered ? ' Attendance has recovered.' : ''}
                </p>
              )}
            </div>
          </section>

          {!closed && (
            <section className="space-y-3">
              <h3 className={sectionTitle}>Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void openMessage()}><Send size={14} className="mr-1.5" />Message the student</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setPanel('contact')}><Phone size={14} className="mr-1.5" />Log a contact</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setPanel('note')}><StickyNote size={14} className="mr-1.5" />Add a note</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setPanel('close')}><CheckCircle2 size={14} className="mr-1.5" />Close with outcome</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void done(() => api.post(`/follow-ups/${id}/escalate`, {}), 'Escalated.')}><ArrowUpRight size={14} className="mr-1.5" />Escalate</Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {c.canAssign && owners && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className={muted}>Owner</span>
                    <select aria-label="Owner" className={inputCls} value={c.owner?.id ?? ''} disabled={busy}
                      onChange={(e) => void done(() => api.post(`/follow-ups/${id}/assign`, { ownerId: e.target.value || null }), 'Assigned.')}>
                      <option value="">Unassigned</option>
                      {owners.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="flex flex-col gap-1 text-xs">
                  <span className={muted}>Next step by{c.nextStepDue ? ` (${rel(c.nextStepDue)})` : ''}</span>
                  <input type="date" aria-label="Next step date" className={inputCls} defaultValue={c.nextStepDue?.slice(0, 10) ?? ''}
                    onChange={(e) => void done(() => api.post(`/follow-ups/${id}/next-step`, { due: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null }), 'Next step saved.')} />
                </label>
              </div>
            </section>
          )}

          {panel === 'message' && (
            <section className={form}>
              {formHead('Message the student')}
              <textarea aria-label="Message" rows={5} maxLength={1000} className={clsx(inputCls, 'w-full')} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} />
              <p className={clsx('text-[11px] text-right tabular-nums', muted)}>{text.length}/1000</p>
              {!preview ? (
                <Button size="sm" disabled={busy || text.trim().length < 10} onClick={() => void previewMessage()}>Check before sending</Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-950 dark:text-white">{preview.summary}</p>
                  {preview.warnings.map((w) => <p key={w} className="text-xs flex gap-1.5 text-amber-700 dark:text-amber-400"><AlertTriangle size={13} className="mt-0.5" />{w}</p>)}
                  <Button size="sm" disabled={busy} onClick={() => void send()}><Send size={14} className="mr-1.5" />Send</Button>
                </div>
              )}
            </section>
          )}
          {panel === 'contact' && (
            <section className={form}>
              {formHead('Log a contact')}
              <select aria-label="How" className={inputCls} value={how} onChange={(e) => setHow(e.target.value)}>{HOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <textarea aria-label="What happened" rows={3} placeholder="What happened (optional)" className={clsx(inputCls, 'w-full')} value={text} onChange={(e) => setText(e.target.value)} />
              {sensitiveBox('Sensitive (health, family): only you and permitted staff can read it')}
              <Button size="sm" disabled={busy} onClick={() => void done(() => api.post(`/follow-ups/${id}/contact`, { how, ...(text.trim() ? { note: text.trim() } : {}), sensitive }), 'Contact logged.')}>Save</Button>
            </section>
          )}
          {panel === 'note' && (
            <section className={form}>
              {formHead('Add a note')}
              <textarea aria-label="Note" rows={3} className={clsx(inputCls, 'w-full')} value={text} onChange={(e) => setText(e.target.value)} />
              {sensitiveBox('Sensitive (health, family): only you and permitted staff can read it')}
              <Button size="sm" disabled={busy || !text.trim()} onClick={() => void done(() => api.post(`/follow-ups/${id}/note`, { note: text.trim(), sensitive }), 'Note added.')}>Save note</Button>
            </section>
          )}
          {panel === 'close' && (
            <section className={form}>
              {formHead('Close with outcome')}
              <div className="flex flex-wrap gap-2">
                <select aria-label="Outcome" className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)}>{OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <select aria-label="Main reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
              <textarea aria-label="Closing note" rows={2} placeholder="Closing note (optional)" className={clsx(inputCls, 'w-full')} value={text} onChange={(e) => setText(e.target.value)} />
              {sensitiveBox('Sensitive note')}
              <Button size="sm" disabled={busy} onClick={() => void done(() => api.post(`/follow-ups/${id}/close`, { outcome, reason, ...(text.trim() ? { note: text.trim() } : {}), sensitive }), 'Closed.')}>Close the case</Button>
            </section>
          )}
          {msg && <p role="status" className={clsx('text-sm', muted)}>{msg}</p>}

          <section>
            <h3 className={sectionTitle}>Timeline</h3>
            <ol className="relative">
              {[...c.timeline].reverse().map((e, i, all) => {
                const ic = EVENT_ICON[e.kind] ?? { icon: Clock, cls: 'bg-gray-500/10 text-gray-500' };
                const Icon = ic.icon;
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4">
                    {i < all.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-200 dark:bg-white/10" />}
                    <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0', ic.cls)}><Icon size={14} /></span>
                    <div className="min-w-0 text-sm pt-0.5">
                      <p><span className="font-medium text-slate-950 dark:text-white">{EVENT[e.kind] ?? e.kind}</span><span className={clsx('text-xs ml-2', muted)}>{when(e.at)}{e.by ? ` · ${e.by}` : ''}</span></p>
                      {e.body ? <p className="mt-1 text-slate-700 dark:text-slate-300 whitespace-pre-line rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">{e.body}</p> : e.sensitive ? <p className={clsx('text-xs italic mt-0.5', muted)}>Sensitive note, hidden</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <p className={clsx('text-xs flex items-center gap-1', muted)}><LifeBuoy size={12} /> Flagged by attendance rules, not by AI.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

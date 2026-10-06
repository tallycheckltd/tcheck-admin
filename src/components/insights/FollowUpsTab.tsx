import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, HeartHandshake, LogOut, Mail, MessageSquare, Search, Table2, UserX, Users } from 'lucide-react';
import { clsx } from 'clsx';
import type { FollowUpDelegate, FollowUpsReport } from '../../types';
import { dayLabel } from '../../lib/reportsExport';
import { downloadCsv } from '../../lib/csv';
import { Card, Empty, Tile } from './InsightsUi';

/**
 * Insights → Follow-ups (owner 09-28). Delegates are never emailed about a missed session; this is
 * the list a person (their CEM, the school admin, a lecturer for their own course) uses to reach
 * out. Same scope and "attended" rule as Overview. People with a pattern (3+ missed sessions of a
 * programme) lead; each row opens a conversation or an email with a warm draft already written.
 */

type Filter = 'all' | 'pattern' | 'missed' | 'checkout';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'pattern', label: 'Needs a check-in' },
  { key: 'missed', label: 'Missed a session' },
  { key: 'checkout', label: 'No check-out' },
];
const actionBtn = 'inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A warm first line for the conversation, written for the most recent session on the list. */
function draftFor(d: FollowUpDelegate): { subject: string; body: string } {
  const last = d.sessions[0];
  const session = last ? `${last.courseName} — ${last.title}` : 'your recent session';
  if (last?.reason === 'NO_CHECK_OUT' && d.missed === 0) {
    return {
      subject: `Your attendance for ${session}`,
      body: `Hi ${d.firstName}, thank you for joining ${session}. It looks like the check-out didn't go through, so the session isn't counted yet — a quick reminder to check out in the app at the end of each session. Anything I can help with?`,
    };
  }
  return {
    subject: `We missed you at ${session}`,
    body: `Hi ${d.firstName}, we missed you at ${session} and hope all is well. Would the session materials or a quick catch-up help? Just let me know.`,
  };
}

function followUpsCsv(r: FollowUpsReport, scopeLabel: string) {
  downloadCsv(`follow-ups-${r.period.from.slice(0, 10)}-${r.period.to.slice(0, 10)}.csv`,
    ['Name', 'Student ID', 'Email', 'Programme(s)', 'Missed', 'No check-out', 'Needs a check-in', 'Session', 'Date', 'Reason', 'Scope'],
    r.delegates.flatMap((d) => d.sessions.map((s) => [
      d.name, d.studentId, d.email, d.programmes.map((p) => p.name).join('; '), d.missed, d.noCheckOut, d.pattern ? 'Yes' : '',
      `${s.courseName} — ${s.title}`, s.date, s.reason === 'MISSED' ? 'Missed' : 'No check-out', scopeLabel,
    ])));
}

function DelegateRow({ d, threshold, canMessage }: { d: FollowUpDelegate; threshold: number; canMessage: boolean }) {
  const [open, setOpen] = useState(false);
  const draft = draftFor(d);
  const messageTo = `/messages?${new URLSearchParams({ to: d.userId, name: d.name, draft: draft.body })}`;
  const mailto = `mailto:${d.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="flex items-start gap-2 min-w-0 flex-1 text-left cursor-pointer">
          {open ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-slate-400" /> : <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-400" />}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900 dark:text-white">{d.name}</span>
              {d.studentId && <span className="text-xs text-slate-500 dark:text-slate-400">{d.studentId}</span>}
              {d.pattern && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Needs a check-in · {threshold}+ missed
                </span>
              )}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {[d.missed ? plural(d.missed, 'session') + ' missed' : null, d.noCheckOut ? plural(d.noCheckOut, 'check-out') + ' missing' : null].filter(Boolean).join(' · ')}
              {' · '}{d.programmes.map((p) => p.name).join(', ')}
            </span>
          </span>
        </button>
        <div className="flex gap-2 md:shrink-0 pl-6 md:pl-0">
          {canMessage && <Link to={messageTo} className={actionBtn}><MessageSquare size={13} /> Message</Link>}
          <a href={mailto} className={actionBtn}><Mail size={13} /> Email</a>
        </div>
      </div>
      {open && (
        <ul className="mt-2 ml-6 space-y-1">
          {d.sessions.map((s) => (
            <li key={s.classId} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="tabular-nums text-slate-500 dark:text-slate-400 w-24 shrink-0">{dayLabel(s.date)}</span>
              <span className="text-slate-700 dark:text-slate-300">{s.courseName} — {s.title}</span>
              <span className={clsx('font-medium', s.reason === 'MISSED' ? 'text-rose-600 dark:text-rose-400' : 'text-purple-600 dark:text-purple-400')}>
                {s.reason === 'MISSED' ? 'Missed' : 'Checked in, no check-out'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function FollowUpsView({ r, scopeLabel, canMessage }: { r: FollowUpsReport; scopeLabel: string; canMessage: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return r.delegates.filter((d) =>
      (filter === 'all' || (filter === 'pattern' && d.pattern) || (filter === 'missed' && d.missed > 0) || (filter === 'checkout' && d.noCheckOut > 0))
      && (!needle || d.name.toLowerCase().includes(needle) || d.email.toLowerCase().includes(needle) || (d.studentId ?? '').toLowerCase().includes(needle)
        || d.programmes.some((p) => p.name.toLowerCase().includes(needle))));
  }, [r.delegates, filter, q]);
  const t = r.totals;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="To follow up" icon={<Users size={18} />} color="blue" value={String(t.delegates)} basis="delegates who didn't attend a session" />
        <Tile label="Need a check-in" icon={<HeartHandshake size={18} />} color="amber" value={String(t.patterns)} basis={`${r.threshold}+ sessions missed in one programme`}
          onClick={t.patterns ? () => setFilter('pattern') : undefined} hint={t.patterns ? 'Show them' : undefined} />
        <Tile label="Sessions missed" icon={<UserX size={18} />} color="red" value={String(t.missed)} basis="no check-in at all" />
        <Tile label="Check-outs missing" icon={<LogOut size={18} />} color="purple" value={String(t.noCheckOut)} basis="were there, didn't check out — not counted" />
      </div>

      <Card title="Who to reach out to"
        subtitle="Delegates aren't emailed about missed sessions — a personal note from you lands far better. Message or Email opens with a friendly draft you can edit."
        action={r.delegates.length ? <button type="button" className={actionBtn} onClick={() => followUpsCsv(r, scopeLabel)}><Table2 size={13} /> CSV</button> : undefined}>
        {r.delegates.length === 0 ? (
          <Empty title="Everyone attended">No delegate missed a delivered session or a check-out in this period.</Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
                {FILTERS.map((f) => (
                  <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                    className={clsx('px-3 py-1 rounded-lg text-xs font-medium cursor-pointer', filter === f.key ? 'bg-white dark:bg-white/15 text-slate-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400')}>
                    {f.label}
                  </button>
                ))}
              </div>
              <label className="relative ml-auto w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, programme" aria-label="Search delegates"
                  className="w-full rounded-xl pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white" />
              </label>
            </div>
            {shown.length === 0 ? (
              <Empty title="Nobody matches this filter" />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {shown.map((d) => <DelegateRow key={d.userId} d={d} threshold={r.threshold} canMessage={canMessage} />)}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

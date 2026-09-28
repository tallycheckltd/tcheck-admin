import { useMemo, useState } from 'react';
import { Mail, AlertTriangle, CheckCircle, Clock, Ban, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { School } from '../../types';

/**
 * SBS Phase 9 — read-only email activity. What was sent, to whom (masked), and what happened —
 * never the content. Scoped server-side: school admins see their own school only.
 */
interface DeliveryRow {
  id: string; type: string; typeLabel: string; category: string; status: string; statusReason: string | null;
  recipient: string; recipientName: string | null; subject: string | null; attempts: number; error: string | null;
  school: { id: string; name: string } | null; createdAt: string; scheduledFor: string | null;
  sentAt: string | null; deliveredAt: string | null; failedAt: string | null;
}
interface Summary { days: number; total: number; byStatus: Record<string, number> }

const STATUS: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: 'Queued', cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
  PROCESSING: { label: 'Sending', cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
  SENT: { label: 'Accepted by provider', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  DELIVERED: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  BOUNCED: { label: 'Bounced', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  COMPLAINED: { label: 'Marked as spam', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  SUPPRESSED: { label: 'Not sent', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  SKIPPED: { label: 'Not sent', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
};

const REASON: Record<string, string> = {
  UNSUBSCRIBED: 'unsubscribed from programme emails',
  BOUNCED: 'address bounced before',
  COMPLAINED: 'recipient marked earlier mail as spam',
  NO_VALID_ADDRESS: 'no valid email address',
  INACTIVE_ACCOUNT: 'account inactive',
  EMAIL_NOT_CONFIGURED: 'email is not set up on this server',
  ANNOUNCEMENT_WITHDRAWN: 'announcement withdrawn',
  HARD_BOUNCE: 'address does not exist',
  SOFT_BOUNCE: 'temporary bounce',
  DELAYED: 'provider reports a delay',
  MARKED_AS_SPAM: 'marked as spam',
};

const ERROR: Record<string, string> = {
  RATE_LIMITED: 'provider rate limit', TIMEOUT: 'provider timed out', NETWORK_ERROR: 'network error',
  PROVIDER_UNAVAILABLE: 'provider unavailable', PROVIDER_AUTH_FAILED: 'provider credentials rejected',
  REJECTED_BY_PROVIDER: 'rejected by provider', INVALID_SENDER: 'sender address not verified',
  QUOTA_EXCEEDED: 'sending quota reached', TEMPLATE_ERROR: 'could not be built', INTERRUPTED: 'interrupted by a restart',
  INVALID_PROVIDER_RESPONSE: 'unexpected provider response',
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const time = (d: string | null) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const PAGE = 300;

/** Owner 09-27: group by day, and within a day by send (same email type + subject + school), so one
 * announcement to 49 people is one row — "49 emails · 47 accepted · 2 not sent" — that expands to
 * its recipients, instead of 49 separate lines. */
type Outcome = 'ok' | 'waiting' | 'failed' | 'notSent';
const outcomeOf = (status: string): Outcome =>
  status === 'SENT' || status === 'DELIVERED' ? 'ok'
    : status === 'QUEUED' || status === 'PROCESSING' ? 'waiting'
      : status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED' ? 'failed' : 'notSent';
const OUTCOME_LABEL: Record<Outcome, string> = { ok: 'accepted', waiting: 'waiting', failed: 'failed', notSent: 'not sent' };
const OUTCOME_CLS: Record<Outcome, string> = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  waiting: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  notSent: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};
interface Batch { key: string; typeLabel: string; subject: string | null; school: DeliveryRow['school']; rows: DeliveryRow[]; first: string; last: string }
interface Day { key: string; label: string; rows: DeliveryRow[]; batches: Batch[] }

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const [yy, mm, dd] = key.split('-').map(Number);
  const nice = new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  if (key === today) return `Today · ${nice}`;
  if (key === dayKey(y.toISOString())) return `Yesterday · ${nice}`;
  return nice;
}
function groupByDay(rows: DeliveryRow[]): Day[] {
  const days = new Map<string, Day>();
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    const day = days.get(k) ?? { key: k, label: dayLabel(k), rows: [], batches: [] };
    day.rows.push(r);
    days.set(k, day);
  }
  for (const day of days.values()) {
    const batches = new Map<string, Batch>();
    for (const r of day.rows) {
      const bk = `${r.type}|${r.subject ?? ''}|${r.school?.id ?? ''}`;
      const b = batches.get(bk) ?? { key: `${day.key}|${bk}`, typeLabel: r.typeLabel, subject: r.subject, school: r.school, rows: [], first: r.createdAt, last: r.createdAt };
      b.rows.push(r);
      if (r.createdAt < b.first) b.first = r.createdAt;
      if (r.createdAt > b.last) b.last = r.createdAt;
      batches.set(bk, b);
    }
    day.batches = [...batches.values()].sort((a, b) => b.last.localeCompare(a.last));
  }
  return [...days.values()].sort((a, b) => b.key.localeCompare(a.key));
}
function Breakdown({ rows }: { rows: DeliveryRow[] }) {
  const counts = rows.reduce<Record<Outcome, number>>((acc, r) => { acc[outcomeOf(r.status)]++; return acc; }, { ok: 0, waiting: 0, failed: 0, notSent: 0 });
  return (
    <span className="flex flex-wrap gap-1.5">
      {(Object.keys(counts) as Outcome[]).filter((o) => counts[o] > 0).map((o) => (
        <span key={o} className={`rounded-lg px-2 py-0.5 text-xs font-medium ${OUTCOME_CLS[o]}`}>{counts[o]} {OUTCOME_LABEL[o]}</span>
      ))}
    </span>
  );
}
const select = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';

export function EmailActivityPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());
  const [closedDays, setClosedDays] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); return n; };
  const q = new URLSearchParams({ limit: String(PAGE), ...(status ? { status } : {}), ...(category ? { category } : {}), ...(schoolId ? { schoolId } : {}), ...(before ? { before } : {}) });
  const { data: rows, loading } = useApi<DeliveryRow[]>(`/email/deliveries?${q}`);
  const { data: summary } = useApi<Summary>(`/email/deliveries/summary?days=7${schoolId ? `&schoolId=${schoolId}` : ''}`);
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const days = useMemo(() => groupByDay(rows ?? []), [rows]);

  const s = summary?.byStatus ?? {};
  const cards = [
    { label: 'Accepted / delivered', value: (s.SENT ?? 0) + (s.DELIVERED ?? 0), icon: <CheckCircle size={16} className="text-emerald-500" /> },
    { label: 'Waiting', value: (s.QUEUED ?? 0) + (s.PROCESSING ?? 0), icon: <Clock size={16} className="text-slate-500" /> },
    { label: 'Failed / bounced', value: (s.FAILED ?? 0) + (s.BOUNCED ?? 0) + (s.COMPLAINED ?? 0), icon: <AlertTriangle size={16} className="text-red-500" /> },
    { label: 'Not sent (opted out, no address…)', value: (s.SUPPRESSED ?? 0) + (s.SKIPPED ?? 0) + (s.CANCELLED ?? 0), icon: <Ban size={16} className="text-amber-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Email activity</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">What TCheck emailed and what happened. Addresses are masked and message content isn't shown. "Accepted by provider" means the provider took the email; "Delivered" is shown only when the provider confirms it.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">{c.icon} {c.label}</div>
            <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-slate-500">Last 7 days · {summary?.total ?? 0} emails</p>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        {isSuperAdmin && (
          <select value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setBefore(null); }} className={select}>
            <option value="">All institutions</option>
            {schools?.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
        )}
        <select value={status} onChange={(e) => { setStatus(e.target.value); setBefore(null); }} className={select}>
          <option value="">Any status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{k === 'SUPPRESSED' ? 'Not sent — opted out / suppressed' : k === 'SKIPPED' ? 'Not sent — skipped' : v.label}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setBefore(null); }} className={select}>
          <option value="">Any kind</option>
          <option value="PROGRAMME">Programme (optional)</option>
          <option value="OPERATIONAL">Operational</option>
          <option value="TRANSACTIONAL">Account &amp; notices</option>
          <option value="SECURITY">Security</option>
        </select>
      </div>

      <div className="space-y-5">
        {days.map((day) => {
          const dayClosed = closedDays.has(day.key);
          return (
            <section key={day.key}>
              <button type="button" onClick={() => setClosedDays((c) => toggle(c, day.key))}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-2 text-left cursor-pointer">
                {dayClosed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{day.label}</span>
                <span className="text-xs text-slate-500">{day.rows.length} email{day.rows.length === 1 ? '' : 's'} · {day.batches.length} send{day.batches.length === 1 ? '' : 's'}</span>
                <Breakdown rows={day.rows} />
              </button>
              {!dayClosed && (
                <div className="glass-card divide-y divide-gray-100 dark:divide-white/5">
                  {day.batches.map((bt) => {
                    const open = openBatches.has(bt.key);
                    const range = time(bt.first) === time(bt.last) ? time(bt.last) : `${time(bt.first)}–${time(bt.last)}`;
                    return (
                      <div key={bt.key}>
                        <button type="button" onClick={() => setOpenBatches((o) => toggle(o, bt.key))}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                          {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">
                              {bt.typeLabel}{bt.subject ? <span className="font-normal text-slate-600 dark:text-slate-300"> — {bt.subject}</span> : null}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{bt.rows.length} email{bt.rows.length === 1 ? '' : 's'}</span>
                              <Breakdown rows={bt.rows} />
                              {isSuperAdmin && bt.school && <span className="text-slate-400">{bt.school.name}</span>}
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-xs text-slate-500 tabular-nums">{range}</span>
                        </button>
                        {open && (
                          <ul className="border-t border-gray-100 bg-slate-50/60 dark:border-white/5 dark:bg-white/[0.02]">
                            {bt.rows.map((r) => {
                              const st = STATUS[r.status] ?? STATUS.QUEUED;
                              const detail = [r.statusReason ? REASON[r.statusReason] ?? r.statusReason : null, r.error ? ERROR[r.error] ?? r.error : null, r.attempts > 1 ? `${r.attempts} attempts` : null].filter(Boolean).join(' · ');
                              return (
                                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 pl-11 pr-4 text-sm">
                                  <span className="min-w-0">
                                    <span className="text-slate-800 dark:text-slate-200">{r.recipientName ?? '—'}</span>
                                    <span className="ml-2 font-mono text-xs text-slate-500">{r.recipient}</span>
                                    {detail && <span className="block text-xs text-slate-500">{detail}</span>}
                                  </span>
                                  <span className="flex items-center gap-2 whitespace-nowrap">
                                    <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                                    <span className="text-xs text-slate-500" title={fmt(r.deliveredAt ?? r.sentAt ?? r.failedAt ?? r.createdAt)}>
                                      {time(r.deliveredAt ?? r.sentAt ?? r.failedAt ?? (r.status === 'QUEUED' && r.scheduledFor ? r.scheduledFor : r.createdAt))}
                                    </span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {!loading && rows?.length === 0 && (
          <p className="glass-card flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Mail size={16} /> No emails match.</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {before && <button onClick={() => setBefore(null)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 cursor-pointer">Newest</button>}
        {rows && rows.length === PAGE && (
          <button onClick={() => setBefore(rows[rows.length - 1].createdAt)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 cursor-pointer">Older</button>
        )}
      </div>
    </div>
  );
}

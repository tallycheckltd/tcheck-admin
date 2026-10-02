import { useMemo, useState } from 'react';
import { ChevronDown, History, Search } from 'lucide-react';
import { useApi } from '../../hooks/useApi';

type Outcome = 'OPEN' | 'ON_TIME' | 'LATE' | 'EXPIRED';
interface Person { id: string; firstName?: string; lastName?: string }
interface Counts { raised: number; onTime: number; late: number; expired: number; open: number; escalated: number }
interface HistoryTicket {
  id: string; presetType: string; detail: string | null; status: string; priority: string; outcome: Outcome;
  createdAt: string; acknowledgedAt: string | null; resolvedAt: string | null; expiredAt: string | null;
  createdBy: Person | null; assignedTo: Person | null; class: { id: string; title: string; room: string | null } | null;
  programme: { id: string; name: string | null } | null;
  responsibleCem: Person | null; escalatedFrom: Person | null; ackBreachedBy: Person | null; resolveBreachedBy: Person | null;
}
interface HistoryResponse {
  month: string; isCurrentMonth: boolean; today: string;
  days: { key: string; counts: Counts; tickets: HistoryTicket[] }[];
  months: { key: string; counts: Counts }[];
}

const OUTCOME: Record<Outcome, { label: string; cls: string }> = {
  OPEN: { label: 'Open', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  ON_TIME: { label: 'Resolved on time', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  LATE: { label: 'Resolved late', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  EXPIRED: { label: 'Expired — not handled', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
};
const PRESET: Record<string, string> = { AC_TOO_COLD: 'Room temperature', AV_ISSUE: 'Projector / sound', CATERING: 'Refreshments / food', WIFI_INTERNET: 'Wi-Fi / internet', SAFETY_MEDICAL: 'Safety or medical', OTHER: 'Other' };
const name = (p: Person | null | undefined) => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—' : '—');
const time = (s: string | null) => (s ? new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

function dayLabel(key: string, today: string) {
  if (key === today) return 'Today';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const t = new Date(today); t.setDate(t.getDate() - 1);
  if (dt.toDateString() === t.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
const monthLabel = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };
const pct = (c: Counts) => (c.raised ? Math.round((c.onTime / c.raised) * 100) : 0);

function CountChips({ c }: { c: Counts }) {
  return (
    <span className="flex flex-wrap gap-1.5 text-[11px]">
      <span className="rounded-full px-2 py-0.5 bg-gray-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">{c.raised} raised</span>
      {c.onTime > 0 && <span className={`rounded-full px-2 py-0.5 ${OUTCOME.ON_TIME.cls}`}>{c.onTime} on time</span>}
      {c.late > 0 && <span className={`rounded-full px-2 py-0.5 ${OUTCOME.LATE.cls}`}>{c.late} late</span>}
      {c.expired > 0 && <span className={`rounded-full px-2 py-0.5 ${OUTCOME.EXPIRED.cls}`}>{c.expired} expired</span>}
      {c.open > 0 && <span className={`rounded-full px-2 py-0.5 ${OUTCOME.OPEN.cls}`}>{c.open} open</span>}
      {c.escalated > 0 && <span className="rounded-full px-2 py-0.5 bg-red-500 text-white">{c.escalated} escalated</span>}
    </span>
  );
}

/**
 * UAT F21 (2026-09-29) — the Facilities record, below the live (today-only) queue and as the CEM Team
 * board's History tab. This month grouped by day (today open), earlier months folded — each opens to
 * its own days. Every ticket shows its outcome; `showOwners` (CEM Manager / admin) adds which CEM it
 * was escalated from and who held it when a target was missed.
 */
export function FacilitiesHistory({ cohortId, showOwners = false }: { cohortId?: string; showOwners?: boolean }) {
  const qs = (month?: string) => {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (cohortId) p.set('cohortId', cohortId);
    const s = p.toString();
    return `/facility-tickets/history${s ? `?${s}` : ''}`;
  };
  const { data, loading } = useApi<HistoryResponse>(qs(), { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const { data: monthData, loading: monthLoading } = useApi<HistoryResponse>(openMonth ? qs(openMonth) : null);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<Outcome | 'ALL'>('ALL');

  const match = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (t: HistoryTicket) => (outcome === 'ALL' || t.outcome === outcome)
      && (!q || `${PRESET[t.presetType] ?? t.presetType} ${t.detail ?? ''} ${t.class?.title ?? ''} ${t.class?.room ?? ''} ${name(t.createdBy)} ${t.programme?.name ?? ''} ${name(t.responsibleCem)}`.toLowerCase().includes(q));
  }, [search, outcome]);
  const filtering = !!search.trim() || outcome !== 'ALL';

  const renderDays = (resp: HistoryResponse) => resp.days.map((d) => {
    const rows = d.tickets.filter(match);
    if (filtering && !rows.length) return null;
    const isOpen = openDays[d.key] ?? (d.key === resp.today || filtering);
    return (
      <div key={d.key} className="border-t border-gray-100 dark:border-white/5 first:border-t-0">
        <button onClick={() => setOpenDays((p) => ({ ...p, [d.key]: !isOpen }))} aria-expanded={isOpen}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
          <span className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-950 dark:text-white w-28">{dayLabel(d.key, resp.today)}</span>
            <CountChips c={d.counts} />
          </span>
          <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="overflow-x-auto px-4 pb-3">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Issue</th><th className="py-2 pr-3">Class · room</th><th className="py-2 pr-3">Raised by</th>
                  <th className="py-2 pr-3">Raised</th><th className="py-2 pr-3">Acknowledged</th><th className="py-2 pr-3">Closed</th>
                  {showOwners && <><th className="py-2 pr-3">Programme · CEM</th><th className="py-2 pr-3">From CEM</th><th className="py-2 pr-3">Breached by</th></>}
                  <th className="py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100 dark:border-white/5 align-top">
                    <td className="py-2 pr-3"><span className="font-medium text-slate-950 dark:text-white">{PRESET[t.presetType] ?? t.presetType}</span>{t.priority === 'URGENT' && <span className="ml-1.5 text-[10px] rounded px-1.5 py-0.5 bg-red-500 text-white">Urgent</span>}{t.detail && <p className="text-xs text-slate-500">{t.detail}</p>}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{t.class?.title ?? '—'}{t.class?.room ? ` · ${t.class.room}` : ''}</td>
                    <td className="py-2 pr-3">{name(t.createdBy)}</td>
                    <td className="py-2 pr-3">{time(t.createdAt)}</td>
                    <td className="py-2 pr-3">{time(t.acknowledgedAt)}</td>
                    <td className="py-2 pr-3">{time(t.resolvedAt ?? t.expiredAt)}</td>
                    {showOwners && (
                      <>
                        <td className="py-2 pr-3">{t.programme?.name ?? 'Unassigned programme'}<p className="text-xs text-slate-500">{name(t.responsibleCem)}</p></td>
                        <td className="py-2 pr-3">{name(t.escalatedFrom)}</td>
                        <td className="py-2 pr-3">
                          {t.ackBreachedBy && <p>{name(t.ackBreachedBy)} <span className="text-xs text-slate-500">(acknowledge)</span></p>}
                          {t.resolveBreachedBy && <p>{name(t.resolveBreachedBy)} <span className="text-xs text-slate-500">(resolve)</span></p>}
                          {!t.ackBreachedBy && !t.resolveBreachedBy && '—'}
                        </td>
                      </>
                    )}
                    <td className="py-2"><span className={`text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${OUTCOME[t.outcome].cls}`}>{OUTCOME[t.outcome].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  });

  return (
    <section className="space-y-3" data-testid="facilities-history">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2"><History size={18} className="text-blue-500" /> History</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the record…"
              className="pl-8 pr-3 py-1.5 rounded-lg text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10" />
          </div>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome | 'ALL')} aria-label="Outcome"
            className="py-1.5 px-2 rounded-lg text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10">
            <option value="ALL">Every outcome</option>
            {(Object.keys(OUTCOME) as Outcome[]).map((o) => <option key={o} value={o}>{OUTCOME[o].label}</option>)}
          </select>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <p className="px-4 pt-3 text-xs font-bold uppercase tracking-widest text-slate-500">{data ? monthLabel(data.month) : 'This month'}</p>
        {loading && !data && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {data && (data.days.length ? renderDays(data) : <p className="p-4 text-sm text-slate-500">No tickets this month.</p>)}
      </div>

      {data?.months.map((m) => {
        const isOpen = openMonth === m.key;
        return (
          <div key={m.key} className="glass-card overflow-hidden">
            <button onClick={() => setOpenMonth(isOpen ? null : m.key)} aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
              <span className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-950 dark:text-white">{monthLabel(m.key)}</span>
                <CountChips c={m.counts} />
                <span className="text-xs text-slate-500">{pct(m.counts)}% on time</span>
              </span>
              <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (monthLoading || !monthData ? <p className="px-4 pb-3 text-sm text-slate-500">Loading…</p> : renderDays(monthData))}
          </div>
        );
      })}
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { createSocket } from '../../lib/socket';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Radio, Siren, Users2, ShieldCheck, Settings2, Download, History } from 'lucide-react';

/**
 * P9 (A8.6, D-11.8) — the CEM Manager board. A CEM Manager sees their own team (the CEMs who report
 * to them and those CEMs' active cohorts); a School Admin sees the whole tenant. Counts, times and
 * ids only — never message content (D-11.6); per-CEM performance is suppressed below 5 tickets.
 */

type Person = { id: string; firstName?: string; lastName?: string } | null;
const name = (p: Person) => (p && p.firstName ? `${p.firstName} ${p.lastName ?? ''}`.trim() : p ? 'Unknown' : '—');

interface BoardTicket {
  id: string; presetType: string; status: string; priority: string; createdAt: string; acknowledgedAt: string | null; resolvedAt: string | null;
  ownershipAmbiguous: boolean;
  createdBy: Person; assignedTo: Person; class: { id: string; title: string; room: string | null } | null;
  cohort: { id: string; name: string | null } | null; programme: { id: string; name: string | null } | null;
  responsibleCem: Person; currentCem: Person; acknowledgedBy: Person; reassigned: boolean; ageSeconds: number;
  sla: 'RUNNING' | 'ACK_BREACHED' | 'RESOLVE_BREACHED' | 'MET';
  escalations?: { at: string; level: string }[];
}
interface Timing { medianSeconds: number | null; p90Seconds: number | null }
interface TeamRow {
  cem: { id: string; firstName: string; lastName: string; managerId: string | null };
  programmes: number; students: number; tickets: number; openTickets: number; urgentTickets: number; enoughData: boolean;
  acknowledge: Timing | null; resolve: Timing | null; slaBreachRate: number | null; escalationsReceived: number; escalationsRaised: number;
  onboardingCompletion: number | null; dmAwaitingReply: number; dmOldestWaitingSeconds: number | null; dmResponseMedianSeconds: number | null;
}
interface CohortLite { id: string; name: string; status?: string; major?: { id: string; name: string } | null; _count?: { members: number } }
interface Coverage {
  limits: { maxProgrammes: number; maxStudents: number };
  unassignedCohorts: CohortLite[];
  overloaded: { cem: { id: string; firstName: string; lastName: string }; programmes: number; students: number }[];
  unmanagedCems: { id: string; firstName: string; lastName: string }[];
}
interface Roster {
  cems: { id: string; firstName: string; lastName: string; email: string; status: string; managerId: string | null; cohortsAsCem: { id: string; name: string }[] }[];
  managers: { id: string; firstName: string; lastName: string; email: string }[];
}
interface HistoryRow { id: string; startsAt: string; endsAt: string | null; reason: string | null; backfilled: boolean; cem: Person; assignedBy: Person; endedBy: Person }

const PRESET: Record<string, string> = { AC_TOO_COLD: 'Room temperature', AV_ISSUE: 'Projector / sound', CATERING: 'Refreshments / food', WIFI_INTERNET: 'Wi-Fi / internet', SAFETY_MEDICAL: 'Safety or medical' };
const preset = (p: string) => PRESET[p] ?? 'Other issue';
const dur = (s: number | null | undefined) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
};
const slaBadge = (t: BoardTicket) =>
  t.sla === 'RESOLVE_BREACHED' ? <Badge color="red">Resolve SLA breached</Badge>
    : t.sla === 'ACK_BREACHED' ? <Badge color="red">Acknowledge SLA breached</Badge>
      : t.sla === 'MET' ? <Badge color="green">Met</Badge> : <Badge color="gray">Clock running</Badge>;
const stateText = (t: BoardTicket) =>
  t.status === 'RESOLVED' ? 'Resolved'
    : t.status === 'ACKNOWLEDGED' ? `Acknowledged by ${name(t.acknowledgedBy)}${t.acknowledgedAt ? ` · ${new Date(t.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : 'Open — not acknowledged';

type Tab = 'board' | 'escalated' | 'team' | 'coverage' | 'setup';

export function CemTeamPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'CEM_MANAGER';
  const canManage = !isManager || (user?.permissions ?? []).includes('MANAGE_CEM_ASSIGNMENTS');
  const [tab, setTab] = useState<Tab>('board');
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const rangeQs = `from=${from}&to=${to}T23:59:59`;

  const board = useApi<{ tickets: BoardTicket[] }>('/cem-team/board', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const escalated = useApi<{ tickets: BoardTicket[] }>(`/cem-team/escalated?${rangeQs}`, { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const team = useApi<{ team: TeamRow[]; minTickets: number }>(tab === 'team' ? `/cem-team/metrics?${rangeQs}` : null);
  const coverage = useApi<Coverage>(tab === 'coverage' || tab === 'setup' ? '/cem-team/coverage' : null);
  const roster = useApi<Roster>(tab === 'setup' || tab === 'coverage' || tab === 'board' ? '/cem-team/roster' : null);

  // Live: every change in the tenant arrives as an id on the staff room (server/src/socket) → refetch.
  const { refetch: refetchBoard } = board;
  const { refetch: refetchEscalated } = escalated;
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const refresh = () => { refetchBoard({ silent: true }); refetchEscalated({ silent: true }); };
    s.on('facilityTicket:new', refresh);
    s.on('facilityTicket:changed', refresh);
    return () => { s.disconnect(); };
  }, [refetchBoard, refetchEscalated]);

  const tabs: { key: Tab; label: string; icon: typeof Radio; count?: number }[] = [
    { key: 'board', label: 'Live board', icon: Radio, count: board.data?.tickets.length },
    { key: 'escalated', label: 'Escalated', icon: Siren, count: escalated.data?.tickets.filter((t) => t.status !== 'RESOLVED').length },
    { key: 'team', label: 'Team', icon: Users2 },
    { key: 'coverage', label: 'Coverage', icon: ShieldCheck },
    { key: 'setup', label: 'Team setup', icon: Settings2 },
  ];

  return (
    <div className="space-y-6" data-testid="cem-team-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CEM Team</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isManager ? 'Your CEMs and their programmes' : 'Every CEM and programme in this institution'} — tickets as they are acknowledged and resolved, escalations, and each CEM's numbers.
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5 text-sm w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} data-testid={`tab-${t.key}`} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer ${tab === t.key ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            <t.icon size={14} /> {t.label}{t.count ? <span className="ml-1 text-xs rounded-full bg-blue-600 text-white px-1.5">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {(tab === 'escalated' || tab === 'team') && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <label className="text-gray-500">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded-lg border px-2 py-1 dark:bg-white/5" /></label>
          <label className="text-gray-500">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded-lg border px-2 py-1 dark:bg-white/5" /></label>
        </div>
      )}

      {tab === 'board' && <TicketTable data-testid="live-board" rows={board.data?.tickets} loading={board.loading} empty="No open tickets under this team right now." roster={roster.data} canManage={canManage} onChanged={() => refetchBoard({ silent: true })} />}
      {tab === 'escalated' && <TicketTable rows={escalated.data?.tickets} loading={escalated.loading} empty="Nothing escalated in this period." escalated />}
      {tab === 'team' && <TeamTable data={team.data} loading={team.loading} from={from} to={to} />}
      {tab === 'coverage' && <CoverageView data={coverage.data} roster={roster.data} canManage={canManage} onChanged={() => { coverage.refetch(); roster.refetch(); }} />}
      {tab === 'setup' && <SetupView roster={roster.data} isManager={isManager} meId={user?.id} canManage={canManage} onChanged={() => { roster.refetch(); coverage.refetch(); }} />}
    </div>
  );
}

function TicketTable({ rows, loading, empty, escalated, roster, canManage, onChanged, ...rest }: { rows?: BoardTicket[]; loading: boolean; empty: string; escalated?: boolean; roster?: Roster | null; canManage?: boolean; onChanged?: () => void; 'data-testid'?: string }) {
  const [reassign, setReassign] = useState<BoardTicket | null>(null);
  if (loading && !rows) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!rows?.length) return <p className="glass-card p-6 text-sm text-gray-500 text-center">{empty}</p>;
  return (
    <div className="glass-card overflow-x-auto" data-testid={rest['data-testid'] ?? 'escalated-list'}>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="p-3">Ticket</th><th className="p-3">Student</th><th className="p-3">Programme / cohort</th><th className="p-3">Class</th>
            <th className="p-3">CEM</th><th className="p-3">State</th><th className="p-3">Age</th><th className="p-3">SLA</th>
            {escalated && <th className="p-3">Escalations</th>}
            {!escalated && canManage && <th className="p-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-gray-100 dark:border-white/5 align-top" data-testid="board-row">
              <td className="p-3 font-medium">{preset(t.presetType)} {t.priority === 'URGENT' && <Badge color="red">Urgent</Badge>}</td>
              <td className="p-3">{name(t.createdBy)}</td>
              <td className="p-3">{t.programme?.name ?? <span className="text-gray-400">Unassigned programme</span>}{t.cohort ? <div className="text-xs text-gray-500">{t.cohort.name}{t.ownershipAmbiguous ? ' · ambiguous' : ''}</div> : null}</td>
              <td className="p-3">{t.class ? `${t.class.title}${t.class.room ? ` · ${t.class.room}` : ''}` : '—'}</td>
              <td className="p-3">{name(t.currentCem)}{t.reassigned ? <div className="text-xs text-gray-500">was {name(t.responsibleCem)}</div> : null}</td>
              <td className="p-3">{stateText(t)}{t.assignedTo && t.status !== 'OPEN' ? <div className="text-xs text-gray-500">Handled by {name(t.assignedTo)}</div> : null}</td>
              <td className="p-3">{dur(t.ageSeconds)}</td>
              <td className="p-3">{slaBadge(t)}</td>
              {escalated && <td className="p-3 text-xs">{(t.escalations ?? []).map((e, i) => <div key={i}>{new Date(e.at).toLocaleString()} · {e.level.replace(/_/g, ' ').toLowerCase()}</div>)}</td>}
              {!escalated && canManage && <td className="p-3"><Button size="sm" variant="secondary" onClick={() => setReassign(t)}>Reassign</Button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {reassign && <ReassignTicketModal ticket={reassign} roster={roster} onClose={() => setReassign(null)} onDone={() => { setReassign(null); onChanged?.(); }} />}
    </div>
  );
}

function ReassignTicketModal({ ticket, roster, onClose, onDone }: { ticket: BoardTicket; roster?: Roster | null; onClose: () => void; onDone: () => void }) {
  const [cemId, setCemId] = useState('');
  const [reason, setReason] = useState('');
  const { mutate, loading, error } = useMutation<unknown, { cemId: string; reason: string }>('post');
  return (
    <Modal open onClose={onClose} title="Reassign ticket">
      <div className="space-y-3 text-sm">
        <p>{preset(ticket.presetType)} — {name(ticket.createdBy)}</p>
        <select className="w-full rounded-lg border px-2 py-2 dark:bg-white/5" value={cemId} onChange={(e) => setCemId(e.target.value)} data-testid="reassign-ticket-cem">
          <option value="">Choose a CEM…</option>
          {(roster?.cems ?? []).filter((c) => c.status === 'APPROVED' && c.id !== ticket.currentCem?.id).map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
        </select>
        <input className="w-full rounded-lg border px-2 py-2 dark:bg-white/5" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!cemId || loading} onClick={async () => { if (await mutate(`/facility-tickets/${ticket.id}/reassign`, { cemId, reason })) onDone(); }}>Reassign</Button>
        </div>
      </div>
    </Modal>
  );
}

function TeamTable({ data, loading, from, to }: { data: { team: TeamRow[]; minTickets: number } | null; loading: boolean; from: string; to: string }) {
  const csv = useMemo(() => {
    if (!data) return '';
    const head = ['CEM', 'Programmes', 'Students', 'Tickets', 'Open', 'Urgent', 'Ack median (s)', 'Ack p90 (s)', 'Resolve median (s)', 'Resolve p90 (s)', 'SLA breach %', 'Escalations received', 'Escalations raised', 'DMs awaiting reply', 'Oldest waiting (s)', 'DM response median (s)', 'Onboarding %'];
    const rows = data.team.map((r) => [`${r.cem.firstName} ${r.cem.lastName}`, r.programmes, r.students, r.tickets, r.openTickets, r.urgentTickets,
      r.acknowledge?.medianSeconds ?? '', r.acknowledge?.p90Seconds ?? '', r.resolve?.medianSeconds ?? '', r.resolve?.p90Seconds ?? '', r.slaBreachRate ?? '',
      r.escalationsReceived, r.escalationsRaised, r.dmAwaitingReply, r.dmOldestWaitingSeconds ?? '', r.dmResponseMedianSeconds ?? '', r.onboardingCompletion ?? '']);
    return [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  }, [data]);
  if (loading && !data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!data?.team.length) return <p className="glass-card p-6 text-sm text-gray-500 text-center">No CEMs in this team yet.</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Ticket timings need at least {data.minTickets} tickets per CEM — fewer shows “not enough data”. Message counts and times only; message content is never shown.</span>
        <Button size="sm" variant="secondary" onClick={() => {
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          const a = document.createElement('a'); a.href = url; a.download = `cem-team-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
        }}><Download size={14} className="inline mr-1" />Export CSV</Button>
      </div>
      <div className="glass-card overflow-x-auto" data-testid="team-table">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr><th className="p-3">CEM</th><th className="p-3">Programmes</th><th className="p-3">Students</th><th className="p-3">Open</th><th className="p-3">Acknowledge (median / p90)</th><th className="p-3">Resolve (median / p90)</th><th className="p-3">SLA breach</th><th className="p-3">Escalations in / raised</th><th className="p-3">DM backlog</th><th className="p-3">Onboarding</th></tr>
          </thead>
          <tbody>
            {data.team.map((r) => (
              <tr key={r.cem.id} className="border-t border-gray-100 dark:border-white/5">
                <td className="p-3 font-medium">{r.cem.firstName} {r.cem.lastName}</td>
                <td className="p-3">{r.programmes}</td>
                <td className="p-3">{r.students}</td>
                <td className="p-3">{r.openTickets}{r.urgentTickets ? <span className="text-red-600"> ({r.urgentTickets} urgent)</span> : null}</td>
                {r.enoughData ? (
                  <>
                    <td className="p-3">{dur(r.acknowledge?.medianSeconds)} / {dur(r.acknowledge?.p90Seconds)}</td>
                    <td className="p-3">{dur(r.resolve?.medianSeconds)} / {dur(r.resolve?.p90Seconds)}</td>
                    <td className="p-3">{r.slaBreachRate}%</td>
                  </>
                ) : <td className="p-3 text-gray-400" colSpan={3} data-testid="not-enough-data">Not enough data ({r.tickets} ticket{r.tickets === 1 ? '' : 's'})</td>}
                <td className="p-3">{r.escalationsReceived} / {r.escalationsRaised}</td>
                <td className="p-3">{r.dmAwaitingReply} awaiting{r.dmOldestWaitingSeconds !== null ? `, oldest ${dur(r.dmOldestWaitingSeconds)}` : ''}<div className="text-xs text-gray-500">reply median {dur(r.dmResponseMedianSeconds)}</div></td>
                <td className="p-3">{r.onboardingCompletion === null ? '—' : `${r.onboardingCompletion}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssignCohortModal({ cohort, currentCemId, roster, onClose, onDone }: { cohort: { id: string; name: string }; currentCemId: string | null; roster?: Roster | null; onClose: () => void; onDone: () => void }) {
  const [cemId, setCemId] = useState('');
  const [reason, setReason] = useState('');
  const { mutate, loading, error } = useMutation<unknown, { cemId: string | null; reason?: string }>('put');
  const history = useApi<{ history: HistoryRow[] }>(`/cem-team/cohorts/${cohort.id}/history`);
  return (
    <Modal open onClose={onClose} title={`${currentCemId ? 'Reassign' : 'Assign'} ${cohort.name}`}>
      <div className="space-y-3 text-sm">
        <select className="w-full rounded-lg border px-2 py-2 dark:bg-white/5" value={cemId} onChange={(e) => setCemId(e.target.value)} data-testid="assign-cohort-cem">
          <option value="">Choose a CEM…</option>
          {(roster?.cems ?? []).filter((c) => c.status === 'APPROVED' && c.id !== currentCemId).map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
        </select>
        {currentCemId && <input className="w-full rounded-lg border px-2 py-2 dark:bg-white/5" placeholder="Reason (required for a reassignment)" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="assign-cohort-reason" />}
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button data-testid="assign-cohort-save" disabled={!cemId || (!!currentCemId && !reason.trim()) || loading} onClick={async () => { if (await mutate(`/cem-team/cohorts/${cohort.id}/cem`, { cemId, reason: reason || undefined })) onDone(); }}>Save</Button>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1 flex items-center gap-1"><History size={12} /> Assignment history</p>
          {(history.data?.history ?? []).length === 0 ? <p className="text-xs text-gray-400">No history yet.</p> : (
            <ul className="text-xs space-y-1">
              {history.data!.history.map((h) => (
                <li key={h.id}>{name(h.cem)} · {new Date(h.startsAt).toLocaleDateString()} → {h.endsAt ? new Date(h.endsAt).toLocaleDateString() : 'now'}{h.reason ? ` · “${h.reason}”` : ''}{h.backfilled ? ' · (earlier history unknown)' : ''}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CoverageView({ data, roster, canManage, onChanged }: { data: Coverage | null; roster?: Roster | null; canManage: boolean; onChanged: () => void }) {
  const [assign, setAssign] = useState<{ id: string; name: string } | null>(null);
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div className="grid md:grid-cols-3 gap-4" data-testid="coverage">
      <section className="glass-card p-4">
        <h3 className="font-semibold mb-2">Programmes with no CEM ({data.unassignedCohorts.length})</h3>
        {data.unassignedCohorts.length === 0 ? <p className="text-sm text-gray-500">Every active cohort has a CEM.</p> : (
          <ul className="space-y-2 text-sm">
            {data.unassignedCohorts.map((c) => (
              <li key={c.id} className="flex justify-between gap-2" data-testid="unassigned-cohort">
                <span>{c.name}{c.major ? <span className="text-xs text-gray-500"> · {c.major.name}</span> : null}</span>
                {canManage && <Button size="sm" variant="secondary" onClick={() => setAssign({ id: c.id, name: c.name })}>Assign</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="glass-card p-4">
        <h3 className="font-semibold mb-2">Over the load limit</h3>
        <p className="text-xs text-gray-500 mb-2">More than {data.limits.maxProgrammes} programmes or {data.limits.maxStudents} students.</p>
        {data.overloaded.length === 0 ? <p className="text-sm text-gray-500">Nobody.</p> : data.overloaded.map((o) => <p key={o.cem.id} className="text-sm">{o.cem.firstName} {o.cem.lastName} — {o.programmes} programmes, {o.students} students</p>)}
      </section>
      <section className="glass-card p-4">
        <h3 className="font-semibold mb-2">CEMs without a manager</h3>
        {data.unmanagedCems.length === 0 ? <p className="text-sm text-gray-500">Every CEM has a manager.</p> : data.unmanagedCems.map((c) => <p key={c.id} className="text-sm">{c.firstName} {c.lastName}</p>)}
      </section>
      {assign && <AssignCohortModal cohort={assign} currentCemId={null} roster={roster} onClose={() => setAssign(null)} onDone={() => { setAssign(null); onChanged(); }} />}
    </div>
  );
}

function SetupView({ roster, isManager, meId, canManage, onChanged }: { roster?: Roster | null; isManager: boolean; meId?: string; canManage: boolean; onChanged: () => void }) {
  const { mutate, error } = useMutation<unknown, { managerId: string | null }>('put');
  const [assign, setAssign] = useState<{ cohort: { id: string; name: string }; cemId: string } | null>(null);
  if (!roster) return <p className="text-sm text-gray-500">Loading…</p>;
  const setManager = async (cemId: string, managerId: string | null) => { if (await mutate(`/cem-team/cems/${cemId}/manager`, { managerId })) onChanged(); };
  return (
    <div className="glass-card overflow-x-auto" data-testid="team-setup">
      {error && <p className="text-sm text-red-600 p-3">{error}</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-gray-500"><tr><th className="p-3">CEM</th><th className="p-3">Manager</th><th className="p-3">Programmes</th></tr></thead>
        <tbody>
          {roster.cems.map((c) => (
            <tr key={c.id} className="border-t border-gray-100 dark:border-white/5 align-top" data-testid="setup-row">
              <td className="p-3 font-medium">{c.firstName} {c.lastName}<div className="text-xs text-gray-500">{c.email}</div></td>
              <td className="p-3">
                {!canManage ? name(roster.managers.find((m) => m.id === c.managerId) ?? null) : isManager ? (
                  c.managerId === meId
                    ? <Button size="sm" variant="secondary" onClick={() => setManager(c.id, null)}>Release from my team</Button>
                    : <Button size="sm" onClick={() => setManager(c.id, meId!)} data-testid="add-to-team">Add to my team</Button>
                ) : (
                  <select className="rounded-lg border px-2 py-1 dark:bg-white/5" value={c.managerId ?? ''} data-testid="set-manager" onChange={(e) => setManager(c.id, e.target.value || null)}>
                    <option value="">No manager</option>
                    {roster.managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                  </select>
                )}
              </td>
              <td className="p-3">
                {c.cohortsAsCem.length === 0 ? <span className="text-gray-400">None</span> : c.cohortsAsCem.map((co) => (
                  <div key={co.id} className="flex items-center gap-2">{co.name}{canManage && <button className="text-xs text-blue-600 cursor-pointer" onClick={() => setAssign({ cohort: co, cemId: c.id })}>Reassign</button>}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {assign && <AssignCohortModal cohort={assign.cohort} currentCemId={assign.cemId} roster={roster} onClose={() => setAssign(null)} onDone={() => { setAssign(null); onChanged(); }} />}
    </div>
  );
}

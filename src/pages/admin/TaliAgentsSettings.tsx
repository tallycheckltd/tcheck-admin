import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Bot, Download, History } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';

/**
 * Action Engine F7 — Settings > TALI agents (School Admins). Two cards:
 *   - AgentSettingsCard: each agent on or off (all off until switched on) and the sending limits;
 *   - AgentActivityCard: every agent action at the school — who asked, what TALI drafted, who
 *     approved, the result — filterable, with a CSV export.
 * Server: GET/PUT /agent/settings and GET /agent/activity (MANAGE_SCHOOL_SETTINGS).
 */

type AgentKey = 'composer' | 'followUp' | 'classChanges' | 'corrections' | 'reports' | 'autoMode';
interface Limits { maxRecipientsNoConfirm: number; dailySendCap: number; quietHours: { from: string; to: string } | null }
interface FollowUpRules {
  lowRatePercent: number; minHeld: number; seriousRatePercent: number; dropPoints: number; silenceDays: number; examRisk: boolean;
  nudgeFirst: boolean; casesPerOwnerPerWeek: number; paused: boolean; recoveredPercent: number; recoveryMinClasses: number; assignTo: 'cem' | 'hod' | 'queue'; remindAfterDays: number; escalateAfterDays: number; outcomeAfterDays: number;
}
interface AgentSettings { agents: Record<AgentKey, boolean>; limits: Limits; followUp: FollowUpRules }

const AGENTS: { key: AgentKey; title: string; desc: string }[] = [
  { key: 'composer', title: 'Write with TALI', desc: 'Staff describe an announcement and TALI drafts it. Nothing is sent until they press Send.' },
  { key: 'followUp', title: 'Student follow-ups', desc: 'TALI opens a case when a student starts missing classes and drafts the first message for the case owner.' },
  { key: 'classChanges', title: 'Class changes', desc: 'Cancel, move or switch a class to online, and tell the students. Lecturer requests wait for approval.' },
  { key: 'corrections', title: 'Attendance corrections', desc: 'Fix attendance with a reason. Every correction is approved and can be undone for a short time.' },
  { key: 'reports', title: 'Reports with TALI', desc: 'Staff describe the report they need and TALI picks it from the library or asks a question. TALI never sees the results. (Scheduled reports come later.)' },
  { key: 'autoMode', title: 'Auto mode', desc: 'Approved message templates send by themselves when their trigger happens. Only templates an admin approved.' },
];

const muted = 'text-slate-600 dark:text-slate-400';
const inputCls = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50', on ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/20')}>
      <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5', on ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function AgentSettingsCard() {
  const { data, refetch } = useApi<AgentSettings>('/agent/settings');
  const [limits, setLimits] = useState<Limits | null>(null);
  const [rules, setRules] = useState<FollowUpRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) { setLimits(data.limits); setRules(data.followUp); } }, [data]);
  if (!data || !limits || !rules) return null;

  const save = async (body: { agents?: Partial<Record<AgentKey, boolean>>; limits?: Partial<Limits>; followUp?: Partial<FollowUpRules> }) => {
    setBusy(true); setMsg('');
    try { await api.put('/agent/settings', body); await refetch(); setMsg('Saved.'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-1">
        <Bot size={20} className="text-blue-500" />
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">TALI agents</h2>
      </div>
      <p className={clsx('text-xs mb-2', muted)}>Each agent is off until you switch it on. Staff still need the matching permission, and every action shows a preview first.</p>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {AGENTS.map((a) => (
          <div key={a.key} className="flex items-start justify-between gap-4 py-3">
            <div><p className="text-sm font-medium text-slate-950 dark:text-white">{a.title}</p><p className={clsx('text-xs max-w-xl', muted)}>{a.desc}</p></div>
            <Switch on={data.agents[a.key]} disabled={busy} label={a.title} onChange={(v) => void save({ agents: { [a.key]: v } })} />
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-slate-950 dark:text-white mt-4">Sending limits</h3>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <label className="text-xs space-y-1">
          <span className={muted}>Ask again before sending to more than</span>
          <input type="number" min={1} className={clsx(inputCls, 'w-full')} value={limits.maxRecipientsNoConfirm}
            onChange={(e) => setLimits({ ...limits, maxRecipientsNoConfirm: Number(e.target.value) })} />
        </label>
        <label className="text-xs space-y-1">
          <span className={muted}>Most messages agents may send in a day</span>
          <input type="number" min={1} className={clsx(inputCls, 'w-full')} value={limits.dailySendCap}
            onChange={(e) => setLimits({ ...limits, dailySendCap: Number(e.target.value) })} />
        </label>
        <label className="text-xs space-y-1 sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={!!limits.quietHours} onChange={(e) => setLimits({ ...limits, quietHours: e.target.checked ? { from: '21:00', to: '07:00' } : null })} />
          <span className={muted}>Quiet hours: agents send nothing between</span>
          <input type="time" disabled={!limits.quietHours} className={inputCls} value={limits.quietHours?.from ?? '21:00'}
            onChange={(e) => limits.quietHours && setLimits({ ...limits, quietHours: { ...limits.quietHours, from: e.target.value } })} />
          <span className={muted}>and</span>
          <input type="time" disabled={!limits.quietHours} className={inputCls} value={limits.quietHours?.to ?? '07:00'}
            onChange={(e) => limits.quietHours && setLimits({ ...limits, quietHours: { ...limits.quietHours, to: e.target.value } })} />
        </label>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Button size="sm" disabled={busy} onClick={() => void save({ limits })}>Save limits</Button>
        {msg && <p role="status" className={clsx('text-xs', muted)}>{msg}</p>}
      </div>

      {data.agents.followUp && (
        <>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white mt-5">Student follow-ups</h3>
          <p className={clsx('text-xs', muted)}>Every Monday at 06:00, attendance rules look for students who are slipping. Milder signs get the student a friendly nudge first; if they're still slipping a week later, or it's serious, a case opens on the Follow-ups page. For these rules a check-in counts even without a check-out, and classes almost nobody attended are ignored.</p>
          <label className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 bg-amber-50 dark:bg-amber-500/10 text-xs">
            <input type="checkbox" checked={rules.paused} onChange={(e) => setRules({ ...rules, paused: e.target.checked })} />
            <span className="text-amber-900 dark:text-amber-200">Pause follow-ups (a strike, closure or holiday): no flags, reminders or escalations until you switch this off</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <label className="text-xs space-y-1">
              <span className={muted}>Low attendance: below this % over the last 3 weeks</span>
              <input type="number" min={10} max={95} className={clsx(inputCls, 'w-full')} value={rules.lowRatePercent} onChange={(e) => setRules({ ...rules, lowRatePercent: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>…when at least this many classes were held</span>
              <input type="number" min={2} max={40} className={clsx(inputCls, 'w-full')} value={rules.minHeld} onChange={(e) => setRules({ ...rules, minHeld: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Below this %, straight to an adviser (no nudge)</span>
              <input type="number" min={0} max={90} className={clsx(inputCls, 'w-full')} value={rules.seriousRatePercent} onChange={(e) => setRules({ ...rules, seriousRatePercent: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Sudden drop: this many points below the student's own previous 4 weeks</span>
              <input type="number" min={10} max={80} className={clsx(inputCls, 'w-full')} value={rules.dropPoints} onChange={(e) => setRules({ ...rules, dropPoints: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Gone quiet: no attendance for this many days</span>
              <input type="number" min={5} max={30} className={clsx(inputCls, 'w-full')} value={rules.silenceDays} onChange={(e) => setRules({ ...rules, silenceDays: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Most new cases per adviser per week</span>
              <input type="number" min={1} max={200} className={clsx(inputCls, 'w-full')} value={rules.casesPerOwnerPerWeek} onChange={(e) => setRules({ ...rules, casesPerOwnerPerWeek: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Give new cases to</span>
              <select className={clsx(inputCls, 'w-full')} value={rules.assignTo} onChange={(e) => setRules({ ...rules, assignTo: e.target.value as FollowUpRules['assignTo'] })}>
                <option value="queue">Nobody yet (the Unassigned list)</option>
                <option value="cem">The student's CEM</option>
                <option value="hod">The unit's Head of Department</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Remind the adviser if nobody reached out after (days)</span>
              <input type="number" min={1} max={30} className={clsx(inputCls, 'w-full')} value={rules.remindAfterDays} onChange={(e) => setRules({ ...rules, remindAfterDays: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Escalate to their manager or Dean after (days)</span>
              <input type="number" min={2} max={60} className={clsx(inputCls, 'w-full')} value={rules.escalateAfterDays} onChange={(e) => setRules({ ...rules, escalateAfterDays: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Ask for the outcome this many days after first contact</span>
              <input type="number" min={3} max={60} className={clsx(inputCls, 'w-full')} value={rules.outcomeAfterDays} onChange={(e) => setRules({ ...rules, outcomeAfterDays: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>Recovered when attending (in and out) at least this %…</span>
              <input type="number" min={50} max={100} className={clsx(inputCls, 'w-full')} value={rules.recoveredPercent} onChange={(e) => setRules({ ...rules, recoveredPercent: Number(e.target.value) })} />
            </label>
            <label className="text-xs space-y-1">
              <span className={muted}>…of at least this many classes since the nudge or first contact</span>
              <input type="number" min={2} max={20} className={clsx(inputCls, 'w-full')} value={rules.recoveryMinClasses} onChange={(e) => setRules({ ...rules, recoveryMinClasses: Number(e.target.value) })} />
            </label>
            <label className="text-xs flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={rules.nudgeFirst} onChange={(e) => setRules({ ...rules, nudgeFirst: e.target.checked })} />
              <span className={muted}>Nudge the student first for milder signs (recommended)</span>
            </label>
            <label className="text-xs flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={rules.examRisk} onChange={(e) => setRules({ ...rules, examRisk: e.target.checked })} />
              <span className={muted}>Flag students below your exam-eligibility attendance (Attendance Thresholds above)</span>
            </label>
          </div>
          <div className="mt-3"><Button size="sm" disabled={busy} onClick={() => void save({ followUp: rules })}>Save follow-up rules</Button></div>
        </>
      )}
    </GlassCard>
  );
}

interface ActivityRow {
  id: string; at: string; agent: AgentKey | null; label: string; status: string; askedBy: string; approvedBy: string | null;
  summary: string; affected: number | null; ranAt: string | null; undoneAt: string | null; error: string | null;
}

const STATUS_WORDS: Record<string, string> = {
  PREVIEWED: 'Drafted', AWAITING_APPROVAL: 'Waiting for approval', APPROVED: 'Approved', RUNNING: 'Running', DONE: 'Done',
  FAILED: 'Failed', UNDONE: 'Undone', REJECTED: 'Rejected', EXPIRED: 'Expired (not confirmed)', DRAFT: 'Drafted',
};
const when = (s: string) => new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AgentActivityCard() {
  const [agent, setAgent] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = new URLSearchParams({ ...(agent ? { agent } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, loading } = useApi<{ rows: ActivityRow[] }>(`/agent/activity${qs ? `?${qs}` : ''}`);
  const [msg, setMsg] = useState('');

  const exportCsv = async () => {
    setMsg('');
    try {
      const csv = await api.getText(`/agent/activity?${new URLSearchParams({ ...(agent ? { agent } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), format: 'csv' })}`);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'tali-agent-activity.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not export'); }
  };

  const rows = data?.rows ?? [];
  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <History size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Agent activity</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void exportCsv()}><Download size={14} className="mr-1" />Export CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select aria-label="Agent" className={inputCls} value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">All agents</option>
          {AGENTS.map((a) => <option key={a.key} value={a.key}>{a.title}</option>)}
        </select>
        <input aria-label="From" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input aria-label="To" type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {msg && <p role="status" className={clsx('text-xs mb-2', muted)}>{msg}</p>}
      {loading && !data ? <p className={clsx('text-sm', muted)}>Loading…</p> : rows.length === 0 ? (
        <p className={clsx('text-sm', muted)}>No agent activity yet. Everything TALI drafts or does shows here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={clsx('text-left text-xs', muted)}><th className="py-2 pr-3">When</th><th className="pr-3">What</th><th className="pr-3">Asked by</th><th className="pr-3">Approved by</th><th className="pr-3">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id} className="align-top text-slate-950 dark:text-white">
                  <td className="py-2 pr-3 whitespace-nowrap">{when(r.at)}</td>
                  <td className="pr-3"><p>{r.summary || r.label}</p>{r.affected !== null && <p className={clsx('text-xs', muted)}>{r.affected} affected</p>}{r.error && <p className="text-xs text-red-600 dark:text-red-400">{r.error}</p>}</td>
                  <td className="pr-3 whitespace-nowrap">{r.askedBy}</td>
                  <td className="pr-3 whitespace-nowrap">{r.approvedBy ?? '—'}</td>
                  <td className="pr-3 whitespace-nowrap">{STATUS_WORDS[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 && <p className={clsx('text-xs mt-2', muted)}>Showing the latest 100 of {rows.length}. Export the CSV for all of them.</p>}
        </div>
      )}
    </GlassCard>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Play, History } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { startSupportSession } from '../../lib/supportSession';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import type { Ticket } from '../../types';

export interface PlatformGrant {
  id: string; scope: 'ACCOUNT' | 'SETUP'; reason: string; hours: number; state: string; createdAt: string;
  expiresAt: string | null; targetUserId: string | null; ticketId: string | null; school: { id: string; name: string };
}

const table = 'w-full text-sm';
const th = 'text-left text-xs uppercase text-gray-500 p-3';
const td = 'p-3 border-t border-gray-100 dark:border-white/5 align-top';
const STATE_COLOR: Record<string, 'green' | 'blue' | 'gray' | 'red'> = { ACTIVE: 'green', PENDING: 'blue', LAPSED: 'gray', EXPIRED: 'gray', REVOKED: 'gray', REJECTED: 'red' };

/**
 * UAT F6 (2026-09-29) — ask an institution for support access. Reaching into one account needs the
 * support ticket it's for; Institution Setup needs a reason. The School Admin approves (and can
 * shorten) it; a request nobody decides lapses after 72 hours.
 */
export function GrantRequestForm({ schoolId: fixedSchool, onDone }: { schoolId?: string; onDone: () => void }) {
  const { data: schools } = useApi<{ id: string; name: string }[]>(fixedSchool ? null : '/schools');
  const [f, setF] = useState({ schoolId: fixedSchool ?? '', scope: 'ACCOUNT' as 'ACCOUNT' | 'SETUP', targetEmail: '', ticketId: '', reason: '', hours: '24' });
  const { data: tickets } = useApi<Ticket[]>(f.schoolId && f.scope === 'ACCOUNT' ? `/tickets?schoolId=${f.schoolId}` : null);
  const { mutate, loading, error } = useMutation('post');
  const open = (tickets ?? []).filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const ok = !!f.schoolId && f.reason.trim().length >= 5 && (f.scope === 'SETUP' || (!!f.targetEmail && !!f.ticketId));
  const send = async () => {
    const r = await mutate('/platform/support-grants', {
      schoolId: f.schoolId, scope: f.scope, targetEmail: f.scope === 'ACCOUNT' ? f.targetEmail : undefined,
      ticketId: f.ticketId || undefined, reason: f.reason, hours: Number(f.hours),
    });
    if (r) { setF({ ...f, targetEmail: '', ticketId: '', reason: '' }); onDone(); }
  };
  const input = 'rounded-lg border px-2 py-2 dark:bg-white/5';
  return (
    <section className="glass-card p-4 space-y-3 text-sm">
      <h2 className="font-semibold flex items-center gap-2"><ShieldCheck size={16} /> Ask for support access</h2>
      <div className="grid md:grid-cols-3 gap-2">
        {!fixedSchool && (
          <select aria-label="Institution" className={input} value={f.schoolId} onChange={(e) => setF({ ...f, schoolId: e.target.value, ticketId: '' })}>
            <option value="">Institution…</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select aria-label="Scope" className={input} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as 'ACCOUNT' | 'SETUP' })}>
          <option value="ACCOUNT">One account</option><option value="SETUP">Institution Setup</option>
        </select>
        {f.scope === 'ACCOUNT' && <input aria-label="Account email" placeholder="The account's email" className={input} value={f.targetEmail} onChange={(e) => setF({ ...f, targetEmail: e.target.value })} />}
        {f.scope === 'ACCOUNT' && (
          <select aria-label="Support ticket" className={input} value={f.ticketId} onChange={(e) => setF({ ...f, ticketId: e.target.value })} disabled={!f.schoolId}>
            <option value="">{f.schoolId ? (open.length ? 'The ticket it is for…' : 'No open ticket from this institution') : 'Pick the institution first'}</option>
            {open.map((t) => <option key={t.id} value={t.id}>{t.subject}</option>)}
          </select>
        )}
        <input aria-label="Reason" placeholder="What you'll do" className={`${input} md:col-span-2`} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <select aria-label="Hours" className={input} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })}>
          {['1', '2', '4', '8', '24', '48', '72'].map((h) => <option key={h} value={h}>{h} hours</option>)}
        </select>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <Button size="sm" disabled={loading || !ok} onClick={() => void send()}>Send request</Button>
    </section>
  );
}

/** The platform's grants with Use access (starts a support session), Activity and End now. */
export function GrantsTable({ grants, onChanged }: { grants: PlatformGrant[]; onChanged: () => void }) {
  const navigate = useNavigate();
  const [activityFor, setActivityFor] = useState<PlatformGrant | null>(null);
  const use = (g: PlatformGrant) => {
    startSupportSession({ grantId: g.id, schoolId: g.school.id, schoolName: g.school.name, scope: g.scope, targetUserId: g.targetUserId, expiresAt: g.expiresAt! });
    navigate(g.scope === 'SETUP' ? `/platform/setup/${g.school.id}` : '/platform/support-session');
  };
  if (!grants.length) return <p className="glass-card p-6 text-sm text-gray-500 text-center">No support access requests yet.</p>;
  return (
    <div className="glass-card overflow-x-auto">
      <table className={table}>
        <thead><tr><th className={th}>Institution</th><th className={th}>Covers</th><th className={th}>Why</th><th className={th}>State</th><th className={th}>Ends</th><th className={th} /></tr></thead>
        <tbody>{grants.map((g) => (
          <tr key={g.id} data-testid="grant-row">
            <td className={td}>{g.school.name}</td>
            <td className={td}>{g.scope === 'ACCOUNT' ? 'One account' : 'Institution Setup'}</td>
            <td className={td}>{g.reason}</td>
            <td className={td}><Badge color={STATE_COLOR[g.state] ?? 'gray'}>{g.state === 'LAPSED' ? 'lapsed (not decided in 72 h)' : g.state.toLowerCase()}</Badge></td>
            <td className={td}>{g.expiresAt ? new Date(g.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
            <td className={td}>
              <span className="flex flex-wrap gap-1.5 justify-end">
                {g.state === 'ACTIVE' && <Button size="sm" onClick={() => use(g)}><Play size={12} className="mr-1" />Use access</Button>}
                {g.state === 'ACTIVE' && <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/platform/support-grants/${g.id}/revoke`, {}); onChanged(); }}>End now</Button>}
                <Button size="sm" variant="secondary" onClick={() => setActivityFor(g)}><History size={12} className="mr-1" />Activity</Button>
              </span>
            </td>
          </tr>
        ))}</tbody>
      </table>
      {activityFor && <GrantActivityModal path={`/platform/support-grants/${activityFor.id}/activity`} title={`${activityFor.school.name} — what was done`} onClose={() => setActivityFor(null)} />}
    </div>
  );
}

interface Activity { events: { action: string; at: string; actor: { firstName: string; lastName: string } | null; method: string | null; path: string | null; status: number | null }[] }
const ACTION_LABEL: Record<string, string> = {
  'supportGrant.requested': 'Requested', 'supportGrant.approved': 'Approved', 'supportGrant.rejected': 'Declined',
  'supportGrant.revoked': 'Ended', 'support.action': 'Action',
};

/** The grant's record — every request made under it (for the School Admin: access transparency). */
export function GrantActivityModal({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const { data } = useApi<Activity>(path);
  return (
    <Modal open onClose={onClose} title={title}>
      {!data ? <p className="text-sm text-gray-500">Loading…</p> : (
        <ol className="space-y-1.5 text-sm max-h-[60vh] overflow-y-auto">
          {data.events.map((e, i) => (
            <li key={i} className="rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
              <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
              {e.method && <code className="ml-2 text-xs">{e.method} {e.path}</code>}
              {e.status !== null && <span className={`ml-2 text-xs ${e.status < 400 ? 'text-emerald-600' : 'text-rose-600'}`}>{e.status}</span>}
              <p className="text-xs text-gray-500">{e.actor ? `${e.actor.firstName} ${e.actor.lastName} · ` : ''}{new Date(e.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}</p>
            </li>
          ))}
          {!data.events.length && <li className="text-gray-500">Nothing yet.</li>}
        </ol>
      )}
    </Modal>
  );
}

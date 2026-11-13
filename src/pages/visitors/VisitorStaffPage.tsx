import { useMemo, useState } from 'react';
import { CheckCircle, KeyRound, Loader2, MailPlus, ShieldCheck, Upload, UserPlus, Users, XCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SearchInput } from '../../components/ui/SearchInput';
import { stamp } from './visitorsApi';

/**
 * Visitors (2026-11-13) — the people ICT runs the front desk and the gate with (ICT Admin, School
 * Admin): front-desk staff, who sign in to the dashboard and invite visitors, and gate guards, who
 * sign in on the tablet. Add one, or paste a whole list; each person gets an email to set their
 * own password. Resend that link, send a password reset, deactivate or reactivate.
 */

type Kind = 'STAFF' | 'GUARD';
type State = 'ACTIVE' | 'INVITED' | 'INVITE_EXPIRED' | 'DEACTIVATED';
interface StaffRow { id: string; firstName: string; lastName: string; email: string; role: Kind; state: State; createdAt: string; invitedAt: string | null }
interface OtherStaff { id: string; firstName: string; lastName: string; email: string; role: string; roleLabel: string; active: boolean; canInvite: boolean }
interface StaffList { managed: StaffRow[]; otherStaff: OtherStaff[] }
type AddOutcome =
  | { status: 'ADDED' | 'ALREADY_ADDED'; staff: StaffRow }
  | { status: 'HAS_OTHER_ROLE'; existing: { name: string; roleLabel: string; canInvite: boolean } };
interface BulkResult { added: number; existing: number; failed: number; results: { email: string; ok: boolean; outcome?: string; note?: string; error?: string }[] }

const KIND: Record<Kind, { label: string; help: string }> = {
  STAFF: { label: 'Front-desk staff', help: 'Signs in to the dashboard and invites visitors.' },
  GUARD: { label: 'Gate guard', help: 'Signs in on the gate tablet and checks visitors in and out.' },
};
const STATE: Record<State, ['green' | 'blue' | 'yellow' | 'gray', string]> = {
  ACTIVE: ['green', 'Active'], INVITED: ['blue', 'Invite sent'], INVITE_EXPIRED: ['yellow', 'Invite expired'], DEACTIVATED: ['gray', 'Deactivated'],
};

/** "Jane, Doe, jane@x.ke, guard" or tab-separated from a spreadsheet; a header row is skipped. */
function parseRows(text: string, fallback: Kind) {
  const rows: { firstName: string; lastName: string; email: string; kind: Kind }[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const cells = line.split(/\t|,|;/).map((c) => c.trim()).filter((c) => c !== '');
    const email = cells.find((c) => /@/.test(c));
    if (!email) { if (i > 0 || !/name|email/i.test(line)) problems.push(`Line ${i + 1}: no email address`); return; }
    const rest = cells.filter((c) => c !== email);
    const kindCell = rest.find((c) => /^(guard|gate|staff|front[- ]?desk)$/i.test(c));
    const names = rest.filter((c) => c !== kindCell);
    const [first, ...last] = names.length === 1 ? names[0].split(/\s+/) : names;
    if (!first || !last.length) { problems.push(`Line ${i + 1}: needs a first and last name`); return; }
    rows.push({ firstName: first, lastName: last.join(' '), email, kind: kindCell ? (/guard|gate/i.test(kindCell) ? 'GUARD' : 'STAFF') : fallback });
  });
  return { rows, problems };
}

export function VisitorStaffPage() {
  const { data: list, loading, refetch } = useApi<StaffList>('/visitors/staff');
  const data = list?.managed ?? null;
  const [otherSearch, setOtherSearch] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | Kind>('');
  const [mode, setMode] = useState<null | 'one' | 'bulk'>(null);
  const [one, setOne] = useState({ firstName: '', lastName: '', email: '', kind: 'STAFF' as Kind });
  const [bulkText, setBulkText] = useState('');
  const [bulkKind, setBulkKind] = useState<Kind>('STAFF');
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState<StaffRow | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => (!kindFilter || r.role === kindFilter) && (!q || `${r.firstName} ${r.lastName} ${r.email}`.toLowerCase().includes(q)));
  }, [data, search, kindFilter]);
  const parsed = useMemo(() => parseRows(bulkText, bulkKind), [bulkText, bulkKind]);
  const counts = useMemo(() => ({ staff: (data ?? []).filter((r) => r.role === 'STAFF').length, guards: (data ?? []).filter((r) => r.role === 'GUARD').length }), [data]);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key); setNotice(null);
    try { setNotice({ ok: true, text: await fn() }); await refetch({ silent: true }); } catch (e) { setNotice({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' }); } finally { setBusy(null); }
  };
  const addOne = (e: React.FormEvent) => {
    e.preventDefault();
    void run('add', async () => {
      const out = await api.post<AddOutcome>('/visitors/staff', one);
      const who = `${one.firstName} ${one.lastName}`;
      setOne({ firstName: '', lastName: '', email: '', kind: one.kind });
      if (out.status === 'HAS_OTHER_ROLE') {
        return `${out.existing.name} already has a Tcheck account as ${out.existing.roleLabel}, so no new account was made. ${out.existing.canInvite ? 'They can already invite visitors.' : 'Their role isn\u2019t allowed to invite yet — turn it on under Visitor settings.'}`;
      }
      if (out.status === 'ALREADY_ADDED') return `${who} is already on your list.`;
      return `${who} added. They've been emailed a link to set their password.`;
    });
  };
  const addBulk = () => void run('bulk', async () => {
    const r = await api.post<BulkResult>('/visitors/staff/bulk', { rows: parsed.rows });
    setBulkResult(r);
    if (!r.failed) setBulkText('');
    return [`${r.added} added and emailed a link to set their password`, r.existing ? `${r.existing} already had an account (kept as they are)` : '', r.failed ? `${r.failed} not added — see below` : ''].filter(Boolean).join(' · ') + '.';
  });
  const name = (r: StaffRow) => `${r.firstName} ${r.lastName}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Staff &amp; guards</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Front-desk staff invite visitors from the dashboard; gate guards check them in on the tablet. Everyone sets their own password from an emailed link.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={mode === 'bulk' ? 'primary' : 'secondary'} onClick={() => { setMode(mode === 'bulk' ? null : 'bulk'); setBulkResult(null); }}><Upload size={16} className="mr-2" />Add many</Button>
          <Button variant={mode === 'one' ? 'secondary' : 'primary'} onClick={() => setMode(mode === 'one' ? null : 'one')}><UserPlus size={16} className="mr-2" />Add person</Button>
        </div>
      </div>

      {notice && (
        <p role="status" className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 dark:bg-red-500/10 dark:text-red-300'}`}>
          {notice.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}{notice.text}
        </p>
      )}

      {mode === 'one' && (
        <form onSubmit={addOne} className="glass-card p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
            {(['STAFF', 'GUARD'] as Kind[]).map((k) => (
              <button type="button" key={k} role="radio" aria-checked={one.kind === k} onClick={() => setOne({ ...one, kind: k })}
                className={`rounded-2xl border p-4 text-left transition-colors cursor-pointer ${one.kind === k ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/10' : 'border-slate-200 dark:border-white/10 hover:border-slate-300'}`}>
                <span className="flex items-center gap-2 font-medium text-slate-950 dark:text-white">{k === 'GUARD' ? <ShieldCheck size={16} /> : <Users size={16} />}{KIND[k].label}</span>
                <span className="mt-1 block text-xs text-slate-500">{KIND[k].help}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input id="staff-first" label="First name" value={one.firstName} onChange={(e) => setOne({ ...one, firstName: e.target.value })} required />
            <Input id="staff-last" label="Last name" value={one.lastName} onChange={(e) => setOne({ ...one, lastName: e.target.value })} required />
            <Input id="staff-email" label="Work email" type="email" value={one.email} onChange={(e) => setOne({ ...one, email: e.target.value })} required />
          </div>
          <div className="flex justify-end"><Button type="submit" disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : `Add ${KIND[one.kind].label.toLowerCase()}`}</Button></div>
        </form>
      )}

      {mode === 'bulk' && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <p className="font-medium text-slate-950 dark:text-white">Paste your staff list</p>
            <p className="text-xs text-slate-500 mt-0.5">One person per line: first name, last name, email, and optionally "guard" or "staff". Copy straight from Excel or Google Sheets — a header row is skipped.</p>
          </div>
          <textarea id="staff-bulk" aria-label="Staff list" value={bulkText} onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }} rows={7}
            placeholder={'Mary\tNjeri\tmary.njeri@sbs.ac.ke\tstaff\nJoseph\tMutua\tjoseph.mutua@sbs.ac.ke\tguard'}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 font-mono text-sm text-slate-900 dark:text-white" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              Lines without a type are
              <select aria-label="Default account type" value={bulkKind} onChange={(e) => setBulkKind(e.target.value as Kind)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm">
                <option value="STAFF">front-desk staff</option><option value="GUARD">gate guards</option>
              </select>
            </label>
            <Button onClick={addBulk} disabled={!parsed.rows.length || busy === 'bulk'}>
              {busy === 'bulk' ? <><Loader2 size={16} className="mr-2 animate-spin" />Adding…</> : `Add ${parsed.rows.length || ''} ${parsed.rows.length === 1 ? 'person' : 'people'}`}
            </Button>
          </div>
          {parsed.problems.length > 0 && <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">{parsed.problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>}
          {bulkResult && (bulkResult.failed > 0 || bulkResult.existing > 0) && (
            <ul className="text-sm space-y-1">
              {bulkResult.results.filter((r) => !r.ok || r.note).map((r) => (
                <li key={r.email} className={r.ok ? 'text-slate-600 dark:text-slate-400' : 'text-rose-700 dark:text-red-400'}><span className="font-mono">{r.email}</span> — {r.ok ? r.note : r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Filter by type">
          <Button size="sm" role="tab" aria-selected={!kindFilter} variant={!kindFilter ? 'primary' : 'secondary'} onClick={() => setKindFilter('')}>All</Button>
          <Button size="sm" role="tab" aria-selected={kindFilter === 'STAFF'} variant={kindFilter === 'STAFF' ? 'primary' : 'secondary'} onClick={() => setKindFilter('STAFF')}>Front desk · {counts.staff}</Button>
          <Button size="sm" role="tab" aria-selected={kindFilter === 'GUARD'} variant={kindFilter === 'GUARD' ? 'primary' : 'secondary'} onClick={() => setKindFilter('GUARD')}>Guards · {counts.guards}</Button>
        </div>
        <div className="w-full sm:w-72"><SearchInput id="staff-search" aria-label="Search staff" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" /></div>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={data?.length ? 'No one matches' : 'No front-desk staff or guards yet'} description={data?.length ? 'Try another name or clear the filter.' : 'Add the people who will invite visitors and run the gate. You can paste a whole list at once.'} />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Invited</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className={r.state === 'DEACTIVATED' ? 'opacity-60' : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950 dark:text-white">{name(r)}</p>
                    <p className="text-xs text-slate-500">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300"><span className="inline-flex items-center gap-1.5">{r.role === 'GUARD' ? <ShieldCheck size={14} /> : <Users size={14} />}{KIND[r.role].label}</span></td>
                  <td className="px-4 py-3"><Badge color={STATE[r.state][0]}>{STATE[r.state][1]}</Badge></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{stamp(r.invitedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.state === 'DEACTIVATED' ? (
                        <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => run(r.id, async () => { await api.post(`/visitors/staff/${r.id}/reactivate`); return `${name(r)} can sign in again.`; })}>Reactivate</Button>
                      ) : (
                        <>
                          {r.state === 'ACTIVE' ? (
                            <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => run(r.id, async () => {
                              const out = await api.post<{ sent: 'INVITE' | 'RESET' }>(`/visitors/staff/${r.id}/reset-password`);
                              return out.sent === 'RESET' ? `Password reset link sent to ${r.email}. It works for 30 minutes.` : `${name(r)} hasn't set a password yet, so we sent a fresh invite link to ${r.email}.`;
                            })}><KeyRound size={14} className="mr-1.5" />Reset password</Button>
                          ) : (
                            <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => run(r.id, async () => { await api.post(`/visitors/staff/${r.id}/invite`); return `New invite link sent to ${r.email}. The earlier link no longer works.`; })}>
                              <MailPlus size={14} className="mr-1.5" />Resend invite
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => setConfirmOff(r)}>Deactivate</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list && list.otherStaff.length > 0 && (
        <OtherStaffSection
          rows={list.otherStaff} search={otherSearch} onSearch={setOtherSearch} busy={busy}
          onReset={(o) => run(o.id, async () => { await api.post(`/visitors/staff/${o.id}/reset-password`); return `Password reset link sent to ${o.email}. It works for 30 minutes.`; })}
        />
      )}

      <Modal open={!!confirmOff} onClose={() => setConfirmOff(null)} title={confirmOff ? `Deactivate ${name(confirmOff)}?` : ''}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">They're signed out everywhere and can't sign in until you reactivate them. Their past check-ins and invitations stay on record.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOff(null)}>Keep active</Button>
            <Button variant="danger" onClick={() => { const r = confirmOff!; setConfirmOff(null); void run(r.id, async () => { await api.post(`/visitors/staff/${r.id}/deactivate`); return `${name(r)} has been deactivated.`; }); }}>Deactivate</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Everyone else on the staff (Dean, CEM, lecturer…): one account each, their role untouched here. */
function OtherStaffSection({ rows, search, onSearch, busy, onReset }: { rows: OtherStaff[]; search: string; onSearch: (v: string) => void; busy: string | null; onReset: (o: OtherStaff) => void }) {
  const q = search.trim().toLowerCase();
  const shown = rows.filter((o) => !q || `${o.firstName} ${o.lastName} ${o.email} ${o.roleLabel}`.toLowerCase().includes(q));
  const blocked = rows.filter((o) => !o.canInvite).length;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Other staff</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            People who already have a Tcheck role — Deans, CEMs, lecturers and others. They keep that one account; whether they can invite follows <Link to="/visitors/settings" className="text-blue-600 dark:text-blue-400 hover:underline">who can invite</Link>.
            {blocked > 0 && ` ${blocked} can't invite with your current settings.`}
          </p>
        </div>
        <div className="w-full sm:w-72"><SearchInput id="other-staff-search" aria-label="Search other staff" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Name, email or role" /></div>
      </div>
      <div className="glass-card overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Can invite visitors</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {shown.map((o) => (
              <tr key={o.id} className={o.active ? undefined : 'opacity-60'}>
                <td className="px-4 py-3"><p className="font-medium text-slate-950 dark:text-white">{o.firstName} {o.lastName}</p><p className="text-xs text-slate-500">{o.email}</p></td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{o.roleLabel}{!o.active && <span className="ml-2"><Badge color="gray">Deactivated</Badge></span>}</td>
                <td className="px-4 py-3">{o.canInvite ? <Badge color="green">Yes</Badge> : <Badge color="gray">Not with current settings</Badge>}</td>
                <td className="px-4 py-3 text-right">{o.active && <Button size="sm" variant="secondary" disabled={busy === o.id} onClick={() => onReset(o)}><KeyRound size={14} className="mr-1.5" />Reset password</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

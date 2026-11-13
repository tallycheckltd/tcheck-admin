import { useMemo, useState } from 'react';
import { CheckCircle, History, Search, Users, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TimeChips, WindowFields } from './InviteForm';
import { tomorrowMorning, toIsoWindow, describeWindow } from './timeWindows';
import type { GuestEntry } from './visitorsApi';

/**
 * Visitors (2026-11-13) — "Invite again": the people you've invited before (admins: the school's),
 * most recent first. Tap one to fill the form; tick several to invite them together to one slot
 * (a meeting, an event) — each still gets their own invitation, code and email.
 */

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null);

export function GuestPicker({ guests, loading, onPick, onGroupDone, admin }: { guests: GuestEntry[]; loading: boolean; onPick: (g: GuestEntry) => void; onGroupDone: () => void; admin: boolean }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [when, setWhen] = useState(tomorrowMorning);
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ invited: number; failed: number; results: { visitorId: string; ok: boolean; name?: string; error?: string }[] } | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return guests.filter((g) => !s || `${g.name} ${g.email ?? ''} ${g.phone} ${g.company ?? ''}`.toLowerCase().includes(s));
  }, [guests, q]);
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const nameOf = useMemo(() => new Map(guests.map((g) => [g.visitorId, g.name])), [guests]);

  const inviteSelected = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await api.post<typeof result & object>('/visitors/invites/group', { visitorIds: [...selected], purpose: purpose || null, ...toIsoWindow(when) });
      setResult(r);
      if (!r.failed) { setSelected(new Set()); setPurpose(''); }
      onGroupDone();
    } catch (e) {
      setResult({ invited: 0, failed: selected.size, results: [{ visitorId: '', ok: false, error: e instanceof Error ? e.message : 'Could not invite' }] });
    } finally { setBusy(false); }
  };

  return (
    <section className="glass-card p-5 space-y-4" aria-labelledby="invite-again">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="invite-again" className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><History size={18} className="text-blue-500" />Invite again</h2>
          <p className="text-xs text-slate-500 mt-0.5">{admin ? 'Everyone invited at your school.' : 'People you have invited before.'} Tap to fill the form, or tick several to invite them together.</p>
        </div>
      </div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input aria-label="Search past guests" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, company, phone or email"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" />
      </div>

      {loading && !guests.length ? <p className="text-sm text-slate-500">Loading…</p>
        : !guests.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-400">Guests you invite appear here, so next time it's one tap.</p>
        : !shown.length ? <p className="text-sm text-slate-500">No past guest matches “{q}”.</p>
        : (
          <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
            {shown.map((g) => {
              const on = selected.has(g.visitorId);
              return (
                <li key={g.visitorId} className={`flex items-center gap-3 rounded-xl px-2 py-2 ring-1 transition-colors ${on ? 'bg-blue-50 ring-blue-300 dark:bg-blue-500/10 dark:ring-blue-500/40' : 'ring-transparent hover:bg-slate-50 dark:hover:bg-white/5'} ${g.isBlocked ? 'opacity-60' : ''}`}>
                  <input type="checkbox" aria-label={`Select ${g.name}`} className="h-4 w-4 shrink-0 accent-blue-600" checked={on} disabled={g.isBlocked} onChange={() => toggle(g.visitorId)} />
                  <button type="button" onClick={() => !g.isBlocked && onPick(g)} disabled={g.isBlocked} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer disabled:cursor-not-allowed">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-semibold text-white">{initials(g.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{g.name}{g.isBlocked && <span className="ml-2 text-xs font-normal text-rose-600">Blocked</span>}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[g.company, `Invited ${g.timesInvited}×`, g.lastVisitAt ? `last here ${shortDate(g.lastVisitAt)}` : g.lastInvitedAt ? `last invited ${shortDate(g.lastInvitedAt)}` : null, admin && g.lastInvitedBy ? `by ${g.lastInvitedBy}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

      {selected.size > 0 && (
        <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Users size={16} />Invite {selected.size} together</p>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-md p-1 text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-500/20 cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{[...selected].map((id) => nameOf.get(id)).filter(Boolean).join(', ')}</p>
          <TimeChips value={when} onPick={setWhen} />
          <WindowFields idPrefix="group" value={when} onChange={setWhen} compact />
          <Input id="group-purpose" label="Purpose (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Board meeting" maxLength={300} />
          <Button onClick={inviteSelected} disabled={busy || !describeWindow(when).ok} className="w-full">{busy ? 'Sending…' : `Send ${selected.size} invitation${selected.size === 1 ? '' : 's'}`}</Button>
          <p className="text-[11px] text-slate-500">Each guest gets their own invitation, code and email, using the details on file.</p>
        </div>
      )}
      {result && (
        <div className={`rounded-xl px-3 py-2 text-sm ${result.failed ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'}`} role="status">
          <p className="flex items-center gap-2 font-medium"><CheckCircle size={15} />{result.invited} invited{result.failed ? `, ${result.failed} not sent` : ''}.</p>
          {result.results.filter((r) => !r.ok).map((r, i) => <p key={i} className="text-xs">{nameOf.get(r.visitorId) ?? 'Guest'} — {r.error}</p>)}
        </div>
      )}
    </section>
  );
}

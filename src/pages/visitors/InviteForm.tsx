import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, History, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { windowLabel, type GuestEntry, type VisitorInvite } from './visitorsApi';
import { todayWindow, tomorrowMorning, sameAsLast, toIsoWindow, type When } from './timeWindows';

/**
 * Visitors (2026-11-13) — the invite form, shared by "Invite a visitor" (every staff member) and the
 * admin Invites page. A past guest can be picked (from "Invite again", the suggestions while typing,
 * or an "Invite again" button elsewhere): their details fill in, the ID on file is reused without
 * being shown, and "same as last time" offers their usual slot next week. One-tap times for the rest.
 */

export function TimeChips({ value, onPick, last }: { value: When; onPick: (w: When) => void; last?: { from: string; until: string } | null }) {
  const chips: { label: string; w: When }[] = [
    // After 5 pm the "today" window is the next four hours, so say that.
    { label: new Date().getHours() >= 17 ? 'Next 4 hours' : 'Today, until 5 pm', w: todayWindow() },
    { label: 'Tomorrow 9–1', w: tomorrowMorning() },
    ...(last ? [{ label: 'Same as last time', w: sameAsLast(last.from, last.until) }] : []),
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick times">
      {chips.map((c) => {
        const on = c.w.date === value.date && c.w.from === value.from && c.w.until === value.until;
        return (
          <button key={c.label} type="button" onClick={() => onPick(c.w)} aria-pressed={on}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors cursor-pointer ${on ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 hover:ring-blue-400 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10'}`}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

const EMPTY = { name: '', email: '', phone: '', nationalId: '', company: '', purpose: '' };

export function InviteForm({ onCreated, prefill, guests = [], onClearPrefill }: {
  onCreated?: (invite: VisitorInvite) => void;
  /** A past guest to invite again. */
  prefill?: GuestEntry | null;
  /** Past guests, for suggestions while typing. */
  guests?: GuestEntry[];
  onClearPrefill?: () => void;
}) {
  const [fields, setFields] = useState(EMPTY);
  const [when, setWhen] = useState<When>(todayWindow);
  const [picked, setPicked] = useState<GuestEntry | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<VisitorInvite | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const pick = (g: GuestEntry) => {
    setPicked(g); setSent(null); setError(null); setSuggestOpen(false);
    setFields({ name: g.name, email: g.email ?? '', phone: g.phone, nationalId: '', company: g.company ?? '', purpose: g.lastPurpose ?? '' });
    if (g.lastValidFrom && g.lastValidUntil) setWhen(sameAsLast(g.lastValidFrom, g.lastValidUntil));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // A guest chosen elsewhere on the page ("Invite again" buttons, the guest list).
  useEffect(() => { if (prefill) pick(prefill); }, [prefill]);

  const clearPick = () => { setPicked(null); setFields(EMPTY); setWhen(todayWindow()); onClearPrefill?.(); };
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    if (k === 'name' || k === 'phone' || k === 'email') setSuggestOpen(true);
  };

  // Past guests matching what's being typed (name, phone or email), when nobody is picked yet.
  const suggestions = useMemo(() => {
    if (picked || !suggestOpen) return [];
    const q = (fields.name || fields.email || fields.phone).trim().toLowerCase().replace(/\s+/g, ' ');
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, '');
    return guests.filter((g) => g.name.toLowerCase().includes(q) || (g.email ?? '').toLowerCase().includes(q) || (digits.length >= 3 && g.phone.replace(/\D/g, '').includes(digits))).slice(0, 5);
  }, [guests, fields.name, fields.email, fields.phone, picked, suggestOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const invite = await api.post<VisitorInvite>('/visitors/invites', {
        name: fields.name, email: fields.email, phone: fields.phone,
        nationalId: fields.nationalId || null, company: fields.company || null, purpose: fields.purpose || null,
        visitorId: picked?.visitorId ?? null, ...toIsoWindow(when),
      });
      setSent(invite);
      onCreated?.(invite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invitation');
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <div className="glass-card p-6 space-y-4">
        <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle size={18} /> Invitation sent to {sent.guestEmail}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{sent.guestName} · {windowLabel(sent.validFrom, sent.validUntil)}</p>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Gate code</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-slate-950 dark:text-white">{sent.code}</p>
          <p className="mt-1 text-xs text-slate-500">The email has this code and a QR code. The visitor gives the code to the guard at the gate.</p>
        </div>
        <Button onClick={() => { setSent(null); clearPick(); }}>Invite another</Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="glass-card p-6 space-y-4 scroll-mt-6">
      {picked && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
          <span className="flex items-start gap-2"><History size={16} className="mt-0.5 shrink-0" />
            <span>Inviting <strong>{picked.name}</strong> again — invited {picked.timesInvited}× before{picked.lastVisitAt ? `, last here ${new Date(picked.lastVisitAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}. Details on file are reused{picked.hasNationalId ? `, including the ID ending ${picked.nationalIdMasked?.slice(-3)}` : ''}.</span>
          </span>
          <button type="button" onClick={clearPick} className="shrink-0 rounded-md p-1 hover:bg-blue-100 dark:hover:bg-blue-500/20 cursor-pointer" aria-label="Start a new guest instead"><X size={16} /></button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <Input id="visitor-name" label="Full name" value={fields.name} onChange={set('name')} required minLength={2} maxLength={120} autoComplete="off"
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)} aria-autocomplete="list" aria-expanded={suggestions.length > 0} />
          {suggestions.length > 0 && (
            <ul role="listbox" aria-label="Past guests" className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
              <li className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-slate-400">Invited before</li>
              {suggestions.map((g) => (
                <li key={g.visitorId}>
                  <button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); pick(g); }} disabled={g.isBlocked}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-white/5 cursor-pointer">
                    <span className="min-w-0"><span className="block truncate font-medium text-slate-900 dark:text-white">{g.name}</span>
                      <span className="block truncate text-xs text-slate-500">{[g.company, g.email].filter(Boolean).join(' · ')}</span></span>
                    <span className="shrink-0 text-xs text-slate-400">{g.isBlocked ? 'Blocked' : `${g.timesInvited}×`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Input id="visitor-email" label="Email" type="email" value={fields.email} onChange={set('email')} required maxLength={200} autoComplete="off" />
        <Input id="visitor-phone" label="Phone" type="tel" value={fields.phone} onChange={set('phone')} required placeholder="0712 345 678" maxLength={20} autoComplete="off" />
        <Input id="visitor-id" label="ID or passport number" value={fields.nationalId} onChange={set('nationalId')} maxLength={30} autoComplete="off"
          placeholder={picked?.hasNationalId ? `On file (ends ${picked.nationalIdMasked?.slice(-3)}) — leave blank to keep` : 'Optional'} />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">When</span>
          <TimeChips value={when} onPick={setWhen} last={picked?.lastValidFrom && picked.lastValidUntil ? { from: picked.lastValidFrom, until: picked.lastValidUntil } : null} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input id="visitor-date" label="Date" type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} required />
          <Input id="visitor-from" label="From" type="time" value={when.from} onChange={(e) => setWhen((w) => ({ ...w, from: e.target.value }))} required />
          <Input id="visitor-until" label="Until" type="time" value={when.until} onChange={(e) => setWhen((w) => ({ ...w, until: e.target.value }))} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="visitor-purpose" label="Purpose (optional)" value={fields.purpose} onChange={set('purpose')} maxLength={300} placeholder="Meeting, interview, delivery…" />
        <Input id="visitor-company" label="Company (optional)" value={fields.company} onChange={set('company')} maxLength={120} />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">The visitor is emailed a QR code and a six-digit code for the gate. Valid only for the time you choose.</p>
        <Button type="submit" disabled={saving}>{saving ? 'Sending…' : picked ? `Invite ${picked.name.split(' ')[0]} again` : 'Send invitation'}</Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { windowLabel, type VisitorInvite } from './visitorsApi';

/**
 * Visitors (2026-11-13) — the invite form, shared by "Invite a visitor" (every staff member) and the
 * admin Invites page. The visitor gets an email with a QR code and the six-digit code; after sending,
 * the code shows here too so the host can pass it on.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Today, from now (to the next quarter hour) until the end of the working day (17:00, or 4 h on if later). */
function defaults() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(17, 0, 0, 0);
  const end = endOfDay > start ? endOfDay : new Date(start.getTime() + 4 * 3_600_000);
  return { date: localDate(start), from: localTime(start), until: localTime(end), untilDate: localDate(end) };
}

const EMPTY = { name: '', email: '', phone: '', nationalId: '', purpose: '' };

export function InviteForm({ onCreated }: { onCreated?: (invite: VisitorInvite) => void }) {
  const [fields, setFields] = useState(EMPTY);
  const [when, setWhen] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<VisitorInvite | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validFrom = new Date(`${when.date}T${when.from}`);
    // A window that ends earlier in the day than it starts runs past midnight into the next day.
    const validUntil = new Date(`${when.date}T${when.until}`);
    if (validUntil <= validFrom) validUntil.setDate(validUntil.getDate() + 1);
    setSaving(true);
    try {
      const invite = await api.post<VisitorInvite>('/visitors/invites', {
        name: fields.name, email: fields.email, phone: fields.phone,
        nationalId: fields.nationalId || null, purpose: fields.purpose || null,
        validFrom: validFrom.toISOString(), validUntil: validUntil.toISOString(),
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
        <Button onClick={() => { setSent(null); setFields(EMPTY); setWhen(defaults()); }}>Invite another</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card p-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="visitor-name" label="Full name" value={fields.name} onChange={set('name')} required minLength={2} maxLength={120} autoComplete="off" />
        <Input id="visitor-email" label="Email" type="email" value={fields.email} onChange={set('email')} required maxLength={200} autoComplete="off" />
        <Input id="visitor-phone" label="Phone" type="tel" value={fields.phone} onChange={set('phone')} required placeholder="0712 345 678" maxLength={20} autoComplete="off" />
        <Input id="visitor-id" label="ID or passport number" value={fields.nationalId} onChange={set('nationalId')} maxLength={30} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input id="visitor-date" label="Date" type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} required />
        <Input id="visitor-from" label="From" type="time" value={when.from} onChange={(e) => setWhen((w) => ({ ...w, from: e.target.value }))} required />
        <Input id="visitor-until" label="Until" type="time" value={when.until} onChange={(e) => setWhen((w) => ({ ...w, until: e.target.value }))} required />
      </div>
      <Input id="visitor-purpose" label="Purpose (optional)" value={fields.purpose} onChange={set('purpose')} maxLength={300} placeholder="Meeting, interview, delivery…" />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">The visitor is emailed a QR code and a six-digit code for the gate.</p>
        <Button type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send invitation'}</Button>
      </div>
    </form>
  );
}

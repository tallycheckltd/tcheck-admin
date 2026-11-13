import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Loader2, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { API_BASE } from '../../lib/apiBase';

/**
 * Visitors (2026-11-13) — the visitor's pass: the link in their invitation email, on the visitor
 * address (visit.…/TCV…) or the dashboard's /pass/TCV…. No sign-in: the random token is the
 * credential, and what is on file is only ever shown masked. Built for a phone at the gate: the
 * status, who invited them and exactly when the pass works, the QR and the code — and, before they
 * arrive, a short form to complete their own details with the privacy consent.
 */

type Status = 'VALID' | 'NOT_YET_VALID' | 'USED' | 'EXPIRED' | 'CANCELLED';
interface Pass {
  schoolName: string;
  logoUrl: string | null;
  guestFirstName: string;
  hostName: string | null;
  hostTitle: string | null;
  purpose: string | null;
  validFrom: string;
  validUntil: string;
  code: string;
  qrToken: string;
  status: Status;
  details: { completed: boolean; canEdit: boolean; fullName: string; phoneMasked: string | null; nationalIdMasked: string | null; hasNationalId: boolean; company: string | null };
}

const STATUS: Record<Status, { label: string; note: string; icon: typeof CheckCircle2; tone: string }> = {
  VALID: { label: 'Valid now', note: 'Show the QR or give the code to the guard at the gate.', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300' },
  NOT_YET_VALID: { label: 'Not yet valid', note: 'Your pass starts working shortly before your visit.', icon: Clock, tone: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300' },
  USED: { label: 'Used', note: 'You were checked in with this pass. Each pass works for one visit.', icon: CheckCircle2, tone: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300' },
  EXPIRED: { label: 'Expired', note: 'This visit is over. Ask the person who invited you for a new invitation.', icon: XCircle, tone: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-red-500/15 dark:text-red-300' },
  CANCELLED: { label: 'Cancelled', note: 'The person who invited you cancelled this visit.', icon: XCircle, tone: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-red-500/15 dark:text-red-300' },
};

function when(from: string, until: string) {
  const d = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const same = new Date(from).toDateString() === new Date(until).toDateString();
  return { day: same ? d(from) : `${d(from)} – ${d(until)}`, time: `${t(from)} – ${t(until)}`, ends: `${same ? '' : `${d(until)}, `}${t(until)}` };
}

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

function DetailsForm({ pass, onSaved }: { pass: Pass; onSaved: (p: Pass) => void }) {
  const [f, setF] = useState({ fullName: pass.details.fullName, phone: '', nationalId: '', company: pass.details.company ?? '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/public/visitor-pass/${encodeURIComponent(pass.qrToken)}/details`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ fullName: f.fullName, phone: f.phone, nationalId: f.nationalId, company: f.company || null, consent: true }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 429 ? 'Too many tries. Please wait a minute.' : body.error ?? 'Your details could not be saved. Please try again.');
      onSaved(body as Pass);
    } catch (err) { setError(err instanceof Error ? err.message : 'Your details could not be saved.'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="vp-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Full name</label>
        <input id="vp-name" className={field} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required minLength={2} maxLength={120} autoComplete="name" />
      </div>
      <div>
        <label htmlFor="vp-phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
        <input id="vp-phone" className={field} type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required minLength={7} maxLength={20} autoComplete="tel"
          placeholder={pass.details.phoneMasked ? `On file: ${pass.details.phoneMasked}` : '0712 345 678'} />
      </div>
      <div>
        <label htmlFor="vp-id" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">ID or passport number</label>
        <input id="vp-id" className={field} value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} required minLength={4} maxLength={30} autoComplete="off"
          placeholder={pass.details.nationalIdMasked ? `On file: ${pass.details.nationalIdMasked}` : 'As on your ID'} />
      </div>
      <div>
        <label htmlFor="vp-company" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Company or organisation <span className="font-normal text-slate-400">(optional)</span></label>
        <input id="vp-company" className={field} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} maxLength={120} autoComplete="organization" />
      </div>
      <label htmlFor="vp-consent" className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300 cursor-pointer">
        <input id="vp-consent" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>I agree that {pass.schoolName} records my name, phone, ID number and the times I arrive and leave for security at the gate, and keeps them as set out in its privacy notice (Kenya Data Protection Act, 2019).</span>
      </label>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={busy || !consent} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-[15px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
        {busy ? 'Saving…' : 'Save my details'}
      </button>
    </form>
  );
}

export function VisitorPassPage() {
  const { qrToken } = useParams();
  const [pass, setPass] = useState<Pass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!qrToken) return;
    fetch(`${API_BASE}/public/visitor-pass/${encodeURIComponent(qrToken)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 404) throw new Error('We couldn’t find this pass. Check that you opened the full link from your email.');
        if (!r.ok) throw new Error('This pass can’t be shown right now. Please try again in a moment.');
        setPass(await r.json());
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'This pass can’t be shown right now.'));
  }, [qrToken]);

  const status = pass ? STATUS[pass.status] : null;
  const live = pass?.status === 'VALID' || pass?.status === 'NOT_YET_VALID';
  const w = pass ? when(pass.validFrom, pass.validUntil) : null;
  const needDetails = !!pass && pass.details.canEdit && (!pass.details.completed || editing);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-6 sm:py-12 flex justify-center">
      <div className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-xl text-center">
            <AlertTriangle size={32} className="mx-auto text-amber-500" />
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{error}</p>
          </div>
        )}
        {!error && !pass && <p className="flex items-center justify-center gap-2 pt-20 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading your pass…</p>}

        {pass && status && w && (
          <>
            <div className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-xl">
              <div className="flex items-center gap-3 px-6 pt-6">
                {pass.logoUrl && <img src={`${API_BASE}${pass.logoUrl}`} alt="" className="h-10 w-10 rounded-xl object-contain bg-white" />}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Visitor pass</p>
                  <p className="truncate font-semibold text-slate-950 dark:text-white">{pass.schoolName}</p>
                </div>
              </div>
              <h1 className="px-6 pt-5 text-2xl font-bold text-slate-950 dark:text-white">Hi {pass.guestFirstName}</h1>

              <div className={`mx-6 mt-4 flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${status.tone}`} role="status">
                <status.icon size={22} className="mt-0.5 shrink-0" />
                <div><p className="font-semibold">{status.label}</p><p className="text-sm opacity-90">{status.note}</p></div>
              </div>

              {live && (
                <div className="px-6 pt-6 text-center">
                  <div className="mx-auto inline-block rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <QRCodeSVG value={pass.qrToken} size={208} level="M" marginSize={0} title="Visitor pass QR code" />
                  </div>
                  <p className="mt-5 text-xs uppercase tracking-[0.14em] text-slate-500">Gate code</p>
                  <p className="mt-1 font-mono text-4xl font-bold tracking-[0.25em] text-slate-950 dark:text-white tabular-nums" aria-label={`Gate code ${pass.code.split('').join(' ')}`}>{pass.code}</p>
                </div>
              )}

              <div className="mx-6 my-6 space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
                {pass.hostName && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><UserRound size={18} /></span>
                    <div><p className="text-xs uppercase tracking-wide text-slate-500">Invited by</p>
                      <p className="font-semibold text-slate-950 dark:text-white">{pass.hostName}</p>
                      {(pass.hostTitle || pass.purpose) && <p className="text-sm text-slate-600 dark:text-slate-400">{[pass.hostTitle, pass.purpose].filter(Boolean).join(' · ')}</p>}</div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"><CalendarClock size={18} /></span>
                  <div><p className="text-xs uppercase tracking-wide text-slate-500">Valid only</p>
                    <p className="font-semibold text-slate-950 dark:text-white">{w.day}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">{w.time} · {pass.status === 'EXPIRED' ? 'expired' : `expires ${w.ends}`}</p></div>
                </div>
              </div>
            </div>

            {pass.details.canEdit && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-xl">
                {needDetails ? (
                  <>
                    <h2 className="text-lg font-bold text-slate-950 dark:text-white">Confirm your details</h2>
                    <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-400">Takes a minute, and the guard won't need to write anything down when you arrive.</p>
                    <DetailsForm pass={pass} onSaved={(p) => { setPass(p); setEditing(false); setJustSaved(true); }} />
                  </>
                ) : (
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"><ShieldCheck size={18} />{justSaved ? 'Thank you — your details are saved' : 'Your details are ready for the gate'}</p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      <dt className="text-slate-500">Name</dt><dd className="text-slate-900 dark:text-slate-100">{pass.details.fullName}</dd>
                      <dt className="text-slate-500">Phone</dt><dd className="text-slate-900 dark:text-slate-100 tabular-nums">{pass.details.phoneMasked ?? '—'}</dd>
                      <dt className="text-slate-500">ID</dt><dd className="text-slate-900 dark:text-slate-100 tabular-nums">{pass.details.nationalIdMasked ?? '—'}</dd>
                      {pass.details.company && <><dt className="text-slate-500">Company</dt><dd className="text-slate-900 dark:text-slate-100">{pass.details.company}</dd></>}
                    </dl>
                    <button type="button" onClick={() => { setEditing(true); setJustSaved(false); }} className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer">Change my details</button>
                  </div>
                )}
              </div>
            )}
            <p className="text-center text-xs text-slate-500">Powered by Tcheck</p>
          </>
        )}
      </div>
    </div>
  );
}

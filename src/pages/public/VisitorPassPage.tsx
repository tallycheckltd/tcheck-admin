import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Loader2, UserRound, XCircle } from 'lucide-react';
import { API_BASE } from '../../lib/apiBase';

/**
 * Visitors (2026-11-13) — the visitor's pass: the link in their invitation email, on the visitor
 * address (visit.…/TCV…) or the dashboard's /pass/TCV…. No sign-in: the random token is the
 * credential, and no phone, ID or email is ever shown. Built for a phone at the gate: the
 * status, who invited them and exactly when the pass works, the QR and the code. The guard records
 * ID details at the gate.
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

export function VisitorPassPage() {
  const { qrToken } = useParams();
  const [pass, setPass] = useState<Pass | null>(null);
  const [error, setError] = useState<string | null>(null);

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

            <p className="text-center text-xs text-slate-500">Powered by Tcheck</p>
          </>
        )}
      </div>
    </div>
  );
}

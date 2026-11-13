import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../lib/apiBase';

/**
 * Visitors (2026-11-13) — "View your pass", the link in the visitor's email. No sign-in: the random
 * token in the URL is the credential, and the API returns no phone, ID or email. Built for a phone
 * at the gate: big code, big QR, and a status you can read at arm's length.
 */

interface Pass {
  schoolName: string;
  logoUrl: string | null;
  guestFirstName: string;
  hostName: string | null;
  validFrom: string;
  validUntil: string;
  code: string;
  qrToken: string;
  status: 'VALID' | 'NOT_YET_VALID' | 'USED' | 'EXPIRED' | 'CANCELLED';
}

const STATUS = {
  VALID: { label: 'Valid', note: 'Show the code or QR to the guard at the gate.', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300' },
  NOT_YET_VALID: { label: 'Not yet valid', note: 'Your pass works from the start of your visit.', icon: Clock, tone: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300' },
  USED: { label: 'Used', note: 'You have been checked in with this pass.', icon: CheckCircle2, tone: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300' },
  EXPIRED: { label: 'Expired', note: 'This visit has ended. Ask your host for a new invitation.', icon: XCircle, tone: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-red-500/15 dark:text-red-300' },
  CANCELLED: { label: 'Cancelled', note: 'Your host cancelled this invitation.', icon: XCircle, tone: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-red-500/15 dark:text-red-300' },
} as const;

function when(from: string, until: string) {
  const d = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return new Date(from).toDateString() === new Date(until).toDateString() ? { day: d(from), time: `${t(from)} – ${t(until)}` } : { day: `${d(from)} – ${d(until)}`, time: `${t(from)} – ${t(until)}` };
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-8 sm:py-14 flex justify-center">
      <div className="w-full max-w-sm">
        {error && (
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-xl text-center">
            <AlertTriangle size={32} className="mx-auto text-amber-500" />
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{error}</p>
          </div>
        )}
        {!error && !pass && <p className="flex items-center justify-center gap-2 pt-20 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading your pass…</p>}

        {pass && status && w && (
          <div className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-xl">
            <div className="flex items-center gap-3 px-6 pt-6">
              {pass.logoUrl && <img src={`${API_BASE}${pass.logoUrl}`} alt="" className="h-10 w-10 rounded-xl object-contain bg-white" />}
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Visitor pass</p>
                <p className="truncate font-semibold text-slate-950 dark:text-white">{pass.schoolName}</p>
              </div>
            </div>

            <div className="px-6 pt-5">
              <h1 className="text-2xl font-bold text-slate-950 dark:text-white text-balance">Hi {pass.guestFirstName}</h1>
              {pass.hostName && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">You're visiting <strong className="text-slate-900 dark:text-slate-200">{pass.hostName}</strong></p>}
            </div>

            <div className={`mx-6 mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${status.tone}`} role="status">
              <status.icon size={22} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{status.label}</p>
                <p className="text-sm opacity-90">{status.note}</p>
              </div>
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

            <dl className="mx-6 my-6 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 border-t border-slate-100 dark:border-white/10 pt-5 text-sm">
              <dt className="text-slate-500">Date</dt><dd className="text-slate-900 dark:text-slate-200 font-medium">{w.day}</dd>
              <dt className="text-slate-500">Time</dt><dd className="text-slate-900 dark:text-slate-200 font-medium tabular-nums">{w.time}</dd>
            </dl>
          </div>
        )}
        {pass && <p className="mt-5 text-center text-xs text-slate-500">Powered by Tcheck</p>}
      </div>
    </div>
  );
}

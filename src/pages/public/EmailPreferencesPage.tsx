import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../lib/apiBase';

/**
 * SBS Phase 9 — where the "Unsubscribe or manage email preferences" link in optional emails lands
 * (`/email-preferences?t=<token>`). Unauthenticated on purpose: the random token in the link is
 * the only credential, and it only grants viewing/changing email preferences. Opening the page
 * never changes anything (mail scanners pre-fetch links); the person presses a button.
 */
interface Prefs { email: string; organisation: string; programmeEmails: boolean; alwaysSent: string[] }

export function EmailPreferencesPage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<'unsubscribed' | 'resubscribed' | null>(null);

  useEffect(() => {
    if (!token) { setError('This link is not valid.'); return; }
    fetch(`${API_BASE}/email/preferences?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error(); setPrefs(await r.json()); })
      .catch(() => setError('This link is not valid or has expired.'));
  }, [token]);

  const change = async (programmeEmails: boolean) => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/email/preferences`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, programmeEmails }),
      });
      if (!r.ok) throw new Error();
      setPrefs((p) => (p ? { ...p, programmeEmails } : p));
      setSaved(programmeEmails ? 'resubscribed' : 'unsubscribed');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
          <Mail size={24} className="text-blue-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-950 dark:text-white">Email preferences</h1>

        {error && (
          <p className="mt-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</p>
        )}
        {!error && !prefs && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>}

        {prefs && (
          <div className="mt-4 space-y-5 text-sm text-slate-700 dark:text-slate-300">
            <p>For <strong className="text-slate-950 dark:text-white">{prefs.email}</strong> at {prefs.organisation}.</p>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
              <p className="font-semibold text-slate-950 dark:text-white">Programme emails</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Announcements sent by email, feedback requests and reminders, session feedback prompts, and programme or session reminders.</p>
              <p className="mt-3 text-sm">
                Status: <strong className={prefs.programmeEmails ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}>{prefs.programmeEmails ? 'Receiving' : 'Unsubscribed'}</strong>
              </p>
              <button
                onClick={() => change(!prefs.programmeEmails)}
                disabled={saving}
                className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 cursor-pointer ${prefs.programmeEmails ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              >
                {saving ? 'Saving…' : prefs.programmeEmails ? 'Unsubscribe from programme emails' : 'Receive programme emails again'}
              </button>
              {saved && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle size={14} /> {saved === 'unsubscribed' ? "Done — you won't receive programme emails. In-app announcements are unaffected." : "Done — you'll receive programme emails again."}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Always sent</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {prefs.alwaysSent.map((a) => <li key={a}>• {a}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

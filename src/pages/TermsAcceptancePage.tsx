import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PrivacyPolicy, TermsOfService } from './LegalPage';

/**
 * QA plan Phase 21 — the gate every admin-created account (Lecturer, CEM, School Admin, every
 * hierarchy role) hits on first login, and everyone hits again when TERMS_VERSION changes. Full
 * page, no navigation: the backend also answers 403 TERMS_REQUIRED to staff API calls until this
 * is accepted, so this isn't only a UI nicety.
 */
export function TermsAcceptancePage() {
  const { user, acceptTerms, logout } = useAuth();
  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reprompt = !!user?.termsAcceptedAt; // accepted an older version before

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await acceptTerms();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen app-shell flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-3xl p-6 md:p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
            {reprompt ? 'Our terms have been updated' : 'Accept Terms to continue'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {reprompt
              ? `Please review and accept the updated Terms of Service and Privacy Policy (${user?.currentTermsVersion}) to keep using Tcheck.`
              : `Welcome${user?.firstName ? `, ${user.firstName}` : ''}. Before you continue, please review and accept the Terms of Service and Privacy Policy (${user?.currentTermsVersion}).`}
          </p>
        </div>

        <div className="flex gap-2">
          {(['terms', 'privacy'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ${
                tab === t
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white dark:bg-white/5 text-slate-800 dark:text-gray-300 border border-gray-200 dark:border-white/10'
              }`}
            >
              {t === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </button>
          ))}
        </div>

        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 p-4">
          {tab === 'terms' ? <TermsOfService /> : <PrivacyPolicy />}
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-800 dark:text-gray-200 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
        </label>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={logout} className="text-sm text-slate-600 dark:text-slate-400 underline cursor-pointer">
            Sign out
          </button>
          <button
            type="button"
            disabled={!agreed || submitting}
            onClick={submit}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-500 text-white disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Saving…' : 'Accept and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

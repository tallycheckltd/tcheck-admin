import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ExternalLink } from 'lucide-react';
import { LEGAL_URLS } from '../lib/legalUrls';

/**
 * QA plan Phase 21 — the gate every admin-created account (Lecturer, CEM, School Admin, every
 * hierarchy role) hits on first login, and everyone hits again when TERMS_VERSION changes. Full
 * page, no navigation: the backend also answers 403 TERMS_REQUIRED to staff API calls until this
 * is accepted, so this isn't only a UI nicety.
 */
export function TermsAcceptancePage() {
  const { user, acceptTerms, logout } = useAuth();
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

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Read the Terms of Service', href: LEGAL_URLS.terms },
            { label: 'Read the Privacy Policy', href: LEGAL_URLS.privacy },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5"
            >
              {l.label}
              <ExternalLink size={16} aria-hidden />
            </a>
          ))}
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

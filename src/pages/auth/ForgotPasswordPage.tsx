import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { AuthShell, AuthBrand } from '../../components/auth/AuthShell';
import {
  authError, authInput, authInputIcon, authLabel, authMutedLink, authPrimaryButton, authSpinner,
  authSubtitle, authSuccess, authTitle, authWarning,
} from '../../components/auth/authStyles';

/** No email provider is configured in this backend yet — outside production the server returns
 * the reset link directly in the response so the flow is testable end-to-end. In production that
 * field is absent and this page just shows the generic "check your email" message. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ message: string; devLink?: string }>('/auth/forgot-password', { email });
      setDevLink(res.devLink || null);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrand className="mb-9 justify-center" />

      <div className="mb-7 text-center">
        <h2 className={`${authTitle} mb-1.5`}>Reset your password</h2>
        <p className={authSubtitle}>Enter your account email and we'll help you get back in.</p>
      </div>

      {submitted ? (
        <div className="space-y-5">
          <div role="status" className={authSuccess}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" aria-hidden="true" />
            <p>If an account exists for that email, password reset instructions have been sent.</p>
          </div>

          {devLink && (
            <div className={`${authWarning} space-y-3`}>
              <p className="text-xs">No email delivery is configured on this server yet — use this link directly for now:</p>
              <Link
                to={devLink.replace(/^https?:\/\/[^/]+/, '')}
                className="block w-full text-center py-2 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
              >
                Continue to Reset Password
              </Link>
            </div>
          )}

          <Link to="/login" className={`flex items-center justify-center gap-1.5 text-sm ${authMutedLink}`}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="forgot-email" className={authLabel}>Email</label>
            <div className="relative group">
              <Mail size={16} className={authInputIcon} aria-hidden="true" />
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@tcheck.app"
                required
                className={`${authInput} pl-10 pr-3.5`}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className={authError}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className={`${authPrimaryButton} mt-2`}>
            {loading ? (
              <>
                <div className={authSpinner} />
                Sending...
              </>
            ) : (
              <>
                Send Reset Link
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </>
            )}
          </button>

          <Link to="/login" className={`flex items-center justify-center gap-1.5 text-sm ${authMutedLink}`}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to Sign In
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

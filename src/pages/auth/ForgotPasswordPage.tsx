import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { AuthShell, AuthBrand, AuthAlert } from '../../components/auth/AuthShell';
import { auth } from '../../components/auth/authStyles';

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
          <div className="flex justify-center mb-7">
            <AuthBrand />
          </div>

          <div className="mb-7 text-center">
            <h2 className={`${auth.title} mb-1.5`}>Reset your password</h2>
            <p className={auth.subtitle}>Enter your account email and we&apos;ll help you get back in.</p>
          </div>

          {submitted ? (
            <div className="space-y-5">
              <AuthAlert tone="success">If an account exists for that email, password reset instructions have been sent.</AuthAlert>

              {devLink && (
                <div className="space-y-3 rounded-xl border px-4 py-3 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
                  <p className="text-xs text-amber-800 dark:text-amber-300">No email delivery is configured on this server yet — use this link directly for now:</p>
                  <Link
                    to={devLink.replace(/^https?:\/\/[^/]+/, '')}
                    className="block w-full text-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                  >
                    Continue to Reset Password
                  </Link>
                </div>
              )}

              <Link to="/login" className={`flex items-center justify-center gap-2 text-sm ${auth.mutedLink}`}>
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="forgot-email" className={auth.label}>Email</label>
                <div className="relative group">
                  <Mail size={17} className={auth.inputIcon} aria-hidden="true" />
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@tcheck.app"
                    required
                    className={`${auth.input} pl-11 pr-4`}
                  />
                </div>
              </div>

              {error && <AuthAlert>{error}</AuthAlert>}

              <button type="submit" disabled={loading} className={auth.primaryButton}>
                {loading ? (
                  <>
                    <div className={auth.spinner} />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <Link to="/login" className={`flex items-center justify-center gap-2 text-sm ${auth.mutedLink}`}>
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </form>
          )}
    </AuthShell>
  );
}

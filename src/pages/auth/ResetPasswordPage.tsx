import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { AuthShell, AuthBrand } from '../../components/auth/AuthShell';
import {
  authError, authIconButton, authInput, authInputIcon, authLabel, authMutedLink, authPrimaryButton,
  authSpinner, authSubtitle, authTitle,
} from '../../components/auth/authStyles';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Best-effort — an invalid/expired token just means the greeting falls back to the generic
  // copy; the actual validity check still happens for real on submit via /auth/reset-password.
  useEffect(() => {
    if (!token) return;
    api
      .get<{ email: string }>(`/auth/reset-password/${token}/email`)
      .then((res) => setEmail(res.email))
      .catch(() => {});
  }, [token]);

  const canSubmit = token.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrand className="mb-9 justify-center" />

      {success ? (
        <div className="text-center space-y-6">
          <CheckCircle2 size={40} className="mx-auto text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div>
            <h2 className={`${authTitle} mb-1.5`}>Password updated</h2>
            <p className={authSubtitle}>Sign in with your new password.</p>
          </div>
          <button type="button" onClick={() => navigate('/login')} className={authPrimaryButton}>
            Back to Sign In
          </button>
        </div>
      ) : (
        <>
          <div className="mb-7 text-center">
            <h2 className={`${authTitle} mb-1.5`}>Set new password</h2>
            <p className={authSubtitle}>
              {email ? (
                <>Choose a new password for <span className="font-medium text-slate-900 dark:text-slate-200">{email}</span>.</>
              ) : (
                'Choose a new password for your account.'
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!searchParams.get('token') && (
              <div className="space-y-1.5">
                <label htmlFor="reset-token" className={authLabel}>Reset code</label>
                <input
                  id="reset-token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  className={`${authInput} px-3.5 font-mono`}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="reset-new" className={authLabel}>New password</label>
              <div className="relative group">
                <Lock size={16} className={authInputIcon} aria-hidden="true" />
                <input
                  id="reset-new"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className={`${authInput} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={authIconButton}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm" className={authLabel}>Confirm new password</label>
              <div className="relative group">
                <Lock size={16} className={authInputIcon} aria-hidden="true" />
                <input
                  id="reset-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`${authInput} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className={authIconButton}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Password must be at least 6 characters</p>
            )}
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Passwords don't match</p>
            )}

            {error && (
              <div role="alert" className={authError}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading || !canSubmit} className={`${authPrimaryButton} mt-2`}>
              {loading ? (
                <div className={authSpinner} />
              ) : (
                <>
                  Update Password
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </>
              )}
            </button>

            <Link to="/login" className={`block text-center text-sm ${authMutedLink}`}>
              Back to Sign In
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}

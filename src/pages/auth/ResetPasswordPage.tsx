import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { AuthShell, AuthBrand, AuthAlert } from '../../components/auth/AuthShell';
import { auth } from '../../components/auth/authStyles';

/** `mode="invite"` (P1 A3.3) is the /accept-invite page: same form, invite copy, and the single-use
 * invite endpoints instead of the reset ones. Nobody else ever chose this person's password. */
export function ResetPasswordPage({ mode = 'reset' }: { mode?: 'reset' | 'invite' } = {}) {
  const invite = mode === 'invite';
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
  const [schoolName, setSchoolName] = useState('');
  const minLength = invite ? 8 : 6;

  // Best-effort — an invalid/expired token just means the greeting falls back to the generic
  // copy; the actual validity check still happens for real on submit via /auth/reset-password.
  useEffect(() => {
    if (!token) return;
    if (invite) {
      // An invalid, used or expired invite is reported up front so nobody types a password for nothing.
      api
        .post<{ email: string; schoolName: string | null }>('/auth/invite/describe', { token })
        .then((res) => { setEmail(res.email); setSchoolName(res.schoolName ?? ''); })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'This invite link is invalid.'));
      return;
    }
    api
      .get<{ email: string }>(`/auth/reset-password/${token}/email`)
      .then((res) => setEmail(res.email))
      .catch(() => {});
  }, [token, invite]);

  const canSubmit = token.length > 0 && newPassword.length >= minLength && newPassword === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      if (invite) await api.post('/auth/accept-invite', { token, newPassword });
      else await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const passwordField = (id: string, label: string, value: string, set: (v: string) => void, shown: boolean, toggleShown: () => void) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className={auth.label}>{label}</label>
      <div className="relative group">
        <Lock size={17} className={auth.inputIcon} aria-hidden="true" />
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => set(e.target.value)}
          required
          className={`${auth.input} pl-11 pr-11`}
        />
        <button
          type="button"
          onClick={toggleShown}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className={auth.inputButton}
        >
          {shown ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );

  return (
    <AuthShell>
          <div className="flex justify-center mb-7">
            <AuthBrand />
          </div>

          {success ? (
            <div className="text-center space-y-6">
              <CheckCircle2 size={44} className="mx-auto text-emerald-500 dark:text-emerald-400" />
              <div>
                <h2 className={`${auth.title} mb-1.5`}>{invite ? "You're all set" : 'Password updated'}</h2>
                <p className={auth.subtitle}>{invite ? 'Sign in with the email and password you just chose.' : 'Sign in with your new password.'}</p>
              </div>
              <button onClick={() => navigate('/login')} className={auth.primaryButton}>
                {invite ? 'Go to Sign In' : 'Back to Sign In'}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-7 text-center">
                <h2 className={`${auth.title} mb-1.5`}>{invite ? (schoolName ? `Welcome to ${schoolName}` : 'Set your password') : 'Set new password'}</h2>
                <p className={auth.subtitle}>
                  {email ? (
                    <>{invite ? 'Choose your password for ' : 'Choose a new password for '}<span className="font-medium text-slate-800 dark:text-slate-200">{email}</span>.</>
                  ) : (
                    invite ? 'Choose your password to finish setting up your account.' : 'Choose a new password for your account.'
                  )}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!searchParams.get('token') && (
                  <div className="space-y-1.5">
                    <label htmlFor="reset-token" className={auth.label}>{invite ? 'Invite code' : 'Reset code'}</label>
                    <input
                      id="reset-token"
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                      className={`${auth.input} px-4 font-mono`}
                    />
                  </div>
                )}

                {passwordField('reset-new', invite ? 'Password' : 'New password', newPassword, setNewPassword, showPassword, () => setShowPassword((v) => !v))}
                {passwordField('reset-confirm', invite ? 'Confirm password' : 'Confirm new password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword((v) => !v))}

                {newPassword.length > 0 && newPassword.length < minLength && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Password must be at least {minLength} characters</p>
                )}
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Passwords don&apos;t match</p>
                )}

                {error && <AuthAlert>{error}</AuthAlert>}

                <button type="submit" disabled={loading || !canSubmit} className={auth.primaryButton}>
                  {loading ? (
                    <div className={auth.spinner} />
                  ) : (
                    <>
                      {invite ? 'Set password' : 'Update Password'}
                      <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                <Link to="/login" className={`block text-center text-sm ${auth.mutedLink}`}>
                  Back to Sign In
                </Link>
              </form>
            </>
          )}
    </AuthShell>
  );
}

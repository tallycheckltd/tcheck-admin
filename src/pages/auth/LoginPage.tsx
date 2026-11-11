import { LEGAL_URLS } from '../../lib/legalUrls';
import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, MailCheck, RotateCw } from 'lucide-react';
import { OtpBoxInput } from '../../components/auth/OtpBoxInput';
import { homeRouteFor } from '../../lib/rbac';
import { getMicrosoftConfig, startMicrosoft } from '../../lib/microsoft';
import { AuthShell, AuthBrand, AuthAlert } from '../../components/auth/AuthShell';
import { auth } from '../../components/auth/authStyles';

const RESEND_COOLDOWN_SECONDS = 30;

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpStage, setOtpStage] = useState(false);
  const [otpErrorTick, setOtpErrorTick] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestOtp, verifyOtp, user } = useAuth();
  // Sign in with Microsoft — shown only when the server has it set up.
  const [microsoftReady, setMicrosoftReady] = useState(false);
  const [microsoftBusy, setMicrosoftBusy] = useState(false);
  useEffect(() => { getMicrosoftConfig().then((c) => setMicrosoftReady(c.enabled)).catch(() => {}); }, []);
  const signInWithMicrosoft = async () => {
    setError(''); setMicrosoftBusy(true);
    try { await startMicrosoft('signin'); } catch (e) { setError(e instanceof Error ? e.message : 'Microsoft sign-in failed.'); setMicrosoftBusy(false); }
  };
  const navigate = useNavigate();
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current); }, []);

  const startResendCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (user) {
      navigate(homeRouteFor(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestOtp(email, password);
      setOtpStage(true);
      startResendCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (submittedCode: string) => {
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await verifyOtp(email, submittedCode);
      navigate(homeRouteFor(loggedInUser.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setCode('');
      setOtpErrorTick((t) => t + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setError('');
    setResending(true);
    try {
      await requestOtp(email, password);
      setCode('');
      startResendCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  const brandPanel = (
    <div className="hidden lg:flex flex-1 flex-col justify-center items-center relative px-16">
      <div className="max-w-lg">
        <div className="mb-8"><AuthBrand size="lg" /></div>

        <h1 className="text-4xl xl:text-[2.75rem] font-semibold tracking-tight leading-[1.1] text-slate-900 dark:text-white mb-5">
          Enterprise<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Attendance
          </span>
        </h1>

        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
          Hardware-verified presence, AI-powered identity checks, and real-time campus analytics — all managed from one unified platform.
        </p>

        <ul className="space-y-4">
          {[
            { label: 'Hardware-Verified Presence', desc: 'Automated Tcheck beacon tracking ensures students are physically inside the lecture hall.' },
            { label: 'Biometric Anti-Cheat', desc: 'AI-powered liveness and identity verification stops buddy-punching and proxy check-ins instantly.' },
            { label: 'Live Campus Analytics', desc: 'Real-time dashboards, role-based access, and forensic audit trails for complete administrative control.' },
          ].map((feature) => (
            <li key={feature.label} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{feature.label}</p>
                <p className="text-xs leading-5 text-slate-500">{feature.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute bottom-8 left-16 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Tcheck. All rights reserved.
      </div>
    </div>
  );

  return (
    <AuthShell aside={brandPanel}>
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <AuthBrand />
          </div>

          {otpStage ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center mb-5">
                  <MailCheck size={26} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className={`${auth.title} mb-2`}>Verify it&apos;s you</h2>
                <p className={auth.subtitle}>
                  Enter the 6-digit code we sent to<br />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{email}</span>
                </p>
              </div>

              <OtpBoxInput
                value={code}
                onChange={setCode}
                onComplete={submitOtp}
                shakeKey={otpErrorTick}
                disabled={loading}
              />

              {error && <AuthAlert>{error}</AuthAlert>}

              {loading && (
                <div className="flex justify-center" role="status" aria-label="Verifying">
                  <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 dark:border-blue-400/30 dark:border-t-blue-400 rounded-full animate-spin" />
                </div>
              )}

              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className={`flex items-center gap-2 text-sm ${auth.link} font-semibold disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer`}
                >
                  <RotateCw size={14} className={resending ? 'animate-spin' : ''} />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpStage(false); setCode(''); setError(''); }}
                  className={`text-sm ${auth.mutedLink} cursor-pointer`}
                >
                  Use a different account
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="mb-7">
            <h2 className={`${auth.title} mb-1.5`}>Welcome back</h2>
            <p className={auth.subtitle}>Sign in to your dashboard</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className={auth.label}>Email</label>
              <div className="relative group">
                <Mail size={17} className={auth.inputIcon} aria-hidden="true" />
                <input
                  id="login-email"
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

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className={auth.label}>Password</label>
                <Link to="/forgot-password" className={`text-xs ${auth.link}`}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <Lock size={17} className={auth.inputIcon} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={`${auth.input} pl-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={auth.inputButton}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <AuthAlert>{error}</AuthAlert>}

            {/* Submit */}
            <button type="submit" disabled={loading} className={auth.primaryButton}>
              {loading ? (
                <>
                  <div className={auth.spinner} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
          {microsoftReady && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className={auth.divider} />
                <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">or</span>
                <div className={auth.divider} />
              </div>
              <button
                type="button"
                onClick={() => void signInWithMicrosoft()}
                disabled={microsoftBusy}
                className={auth.secondaryButton}
              >
                <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
                {microsoftBusy ? 'Opening Microsoft…' : 'Sign in with Microsoft'}
              </button>
              <p className={`mt-2 text-center text-[11px] ${auth.fine}`}>For staff of schools that use Microsoft 365.</p>
            </>
          )}
          </>
          )}

          <div className="mt-7 pt-5 border-t border-slate-200 dark:border-white/[0.06] space-y-2.5">
            <p className={`text-center ${auth.fine}`}>
              Admin &amp; Lecturer access only. Students use the mobile app.
            </p>
            <p className={`text-center ${auth.fine}`}>
              <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className={auth.mutedLink}>
                Privacy Policy
              </a>
              <span className="mx-2" aria-hidden="true">·</span>
              <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className={auth.mutedLink}>
                Legal agreement
              </a>
            </p>
          </div>
    </AuthShell>
  );
}

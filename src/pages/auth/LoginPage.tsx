import { LEGAL_URLS } from '../../lib/legalUrls';
import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, MailCheck, RotateCw } from 'lucide-react';
import { OtpBoxInput } from '../../components/auth/OtpBoxInput';
import { homeRouteFor } from '../../lib/rbac';
import { AuthShell, AuthBrand } from '../../components/auth/AuthShell';
import {
  authError, authIconButton, authInput, authInputIcon, authLabel, authLink, authMutedLink,
  authPrimaryButton, authSpinner, authSubtitle, authTitle,
} from '../../components/auth/authStyles';

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

  const aside = (
    <div className="hidden lg:flex flex-1 flex-col justify-center relative px-14 xl:px-20">
      <div className="max-w-md">
        <AuthBrand className="mb-10" />

        <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.1] text-slate-900 dark:text-white mb-5">
          Enterprise<br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Attendance
          </span>
        </h1>

        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-9">
          Hardware-verified presence, AI-powered identity checks, and real-time campus analytics — all managed from one unified platform.
        </p>

        <ul className="space-y-4">
          {[
            { label: 'Hardware-Verified Presence', desc: 'Automated Tcheck beacon tracking ensures students are physically inside the lecture hall.' },
            { label: 'Biometric Anti-Cheat', desc: 'AI-powered liveness and identity verification stops buddy-punching and proxy check-ins instantly.' },
            { label: 'Live Campus Analytics', desc: 'Real-time dashboards, role-based access, and forensic audit trails for complete administrative control.' },
          ].map((feature) => (
            <li key={feature.label} className="flex items-start gap-3">
              <span className="mt-0.5 w-6 h-6 rounded-md bg-blue-50 border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{feature.label}</span>
                <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{feature.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="absolute bottom-6 left-14 xl:left-20 text-xs text-slate-500 dark:text-slate-500">
        &copy; {new Date().getFullYear()} Tcheck. All rights reserved.
      </p>
    </div>
  );

  return (
    <AuthShell aside={aside}>
      {/* Mobile logo */}
      <AuthBrand className="lg:hidden mb-9 justify-center" />

      {otpStage ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center mb-4">
              <MailCheck size={22} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <h2 className={`${authTitle} mb-1.5`}>Verify it's you</h2>
            <p className={authSubtitle}>
              Enter the 6-digit code we sent to<br />
              <span className="font-medium text-slate-900 dark:text-slate-200">{email}</span>
            </p>
          </div>

          <OtpBoxInput
            value={code}
            onChange={setCode}
            onComplete={submitOtp}
            shakeKey={otpErrorTick}
            disabled={loading}
          />

          {error && (
            <div role="alert" className={authError}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex justify-center" aria-live="polite">
              <div className="w-5 h-5 border-2 border-blue-600/25 border-t-blue-600 dark:border-blue-400/30 dark:border-t-blue-400 rounded-full animate-spin" />
              <span className="sr-only">Verifying…</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-2.5 pt-1 text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className={`flex items-center gap-1.5 cursor-pointer ${authLink} disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed`}
            >
              <RotateCw size={13} className={resending ? 'animate-spin' : ''} aria-hidden="true" />
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={() => { setOtpStage(false); setCode(''); setError(''); }}
              className={`cursor-pointer ${authMutedLink}`}
            >
              Use a different account
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-7">
            <h2 className={`${authTitle} mb-1.5`}>Welcome back</h2>
            <p className={authSubtitle}>Sign in to your dashboard</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className={authLabel}>Email</label>
              <div className="relative group">
                <Mail size={16} className={authInputIcon} aria-hidden="true" />
                <input
                  id="login-email"
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

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className={authLabel}>Password</label>
                <Link to="/forgot-password" className={`text-xs ${authLink}`}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <Lock size={16} className={authInputIcon} aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={`${authInput} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={authIconButton}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" className={authError}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className={`${authPrimaryButton} mt-2`}>
              {loading ? (
                <>
                  <div className={authSpinner} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </>
      )}

      <div className="mt-7 pt-5 border-t border-slate-200 dark:border-white/[0.06] space-y-2 text-center text-xs text-slate-500 dark:text-slate-500">
        <p className="text-balance">Admin &amp; Lecturer access only. Students use the mobile app.</p>
        <p>
          <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className={authMutedLink}>
            Privacy Policy
          </a>
          <span className="mx-2" aria-hidden="true">·</span>
          <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className={authMutedLink}>
            Terms of Service
          </a>
        </p>
      </div>
    </AuthShell>
  );
}

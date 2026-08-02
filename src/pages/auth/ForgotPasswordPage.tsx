import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen flex relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />

      <div className="flex-1 flex items-center justify-center relative px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3 mb-10 justify-center">
            <img src="/logo.svg" alt="Tcheck" className="w-10 h-10" />
            <span className="text-xl font-bold text-white tracking-tight">Tcheck</span>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Reset your password</h2>
            <p className="text-slate-400 text-sm">Enter your account email and we'll help you get back in.</p>
          </div>

          {submitted ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-300">If an account exists for that email, password reset instructions have been sent.</p>
              </div>

              {devLink && (
                <div className="space-y-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-300">No email delivery is configured on this server yet — use this link directly for now:</p>
                  <Link
                    to={devLink.replace(/^https?:\/\/[^/]+/, '')}
                    className="block w-full text-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                  >
                    Continue to Reset Password
                  </Link>
                </div>
              )}

              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Email</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@tcheck.app"
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

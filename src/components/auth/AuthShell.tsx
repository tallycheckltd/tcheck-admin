import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '../../context/ThemeContext';

/** Light/dark switch for the signed-out screens — the same theme (and saved choice) as the dashboard. */
export function AuthThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium border backdrop-blur transition-colors cursor-pointer',
        'bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:text-slate-900 shadow-sm',
        'dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        className,
      )}
    >
      {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

export function AuthBrand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.svg" alt="" aria-hidden="true" className={size === 'lg' ? 'w-11 h-11' : 'w-9 h-9'} />
      <span className={clsx('font-semibold tracking-tight text-slate-900 dark:text-white', size === 'lg' ? 'text-2xl' : 'text-xl')}>Tcheck</span>
    </div>
  );
}

const ALERT_TONE = {
  error: { box: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20', dot: 'bg-red-500 dark:bg-red-400', text: 'text-red-700 dark:text-red-400' },
  success: { box: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20', dot: 'bg-emerald-500 dark:bg-emerald-400', text: 'text-emerald-800 dark:text-emerald-300' },
  warning: { box: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20', dot: 'bg-amber-500 dark:bg-amber-400', text: 'text-amber-800 dark:text-amber-300' },
} as const;

/** Inline message box (errors, confirmations) for the sign-in screens. */
export function AuthAlert({ tone = 'error', children }: { tone?: keyof typeof ALERT_TONE; children: ReactNode }) {
  const t = ALERT_TONE[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3', t.box)}>
      <span className={clsx('mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0', t.dot)} aria-hidden="true" />
      <div className={clsx('text-sm leading-5', t.text)}>{children}</div>
    </div>
  );
}

/**
 * The page every signed-out screen sits on: themed background, the light/dark toggle top-right,
 * an optional marketing panel on the left (login only), and the form in a card.
 */
export function AuthShell({ children, aside, card = true }: { children: ReactNode; aside?: ReactNode; card?: boolean }) {
  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white transition-colors duration-200">
      {/* Background — light: soft cool wash; dark: the original deep navy gradient. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/70 to-indigo-50/60 dark:hidden" />
        <div className="absolute inset-0 hidden dark:block bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.08),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.1),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-[0.03] [--grid:rgba(15,23,42,0.045)] dark:[--grid:rgba(255,255,255,0.1)]"
          style={{
            backgroundImage: 'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-400/15 dark:bg-blue-500/10 rounded-full blur-3xl motion-safe:animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-400/15 dark:bg-indigo-500/10 rounded-full blur-3xl motion-safe:animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10">
        <AuthThemeToggle />
      </div>

      {aside}

      <div className="flex-1 flex items-center justify-center relative px-4 sm:px-6 py-16">
        <div className="w-full max-w-[420px]">
          {card ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/85 shadow-xl shadow-slate-900/[0.06] backdrop-blur-xl p-6 sm:p-8 dark:border-white/[0.07] dark:bg-white/[0.03] dark:shadow-none">
              {children}
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );
}

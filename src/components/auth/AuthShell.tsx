import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '../../context/ThemeContext';

/** Light/dark switch for the signed-out screens. Uses the same ThemeContext (and the same persisted
 * `theme` key) as the dashboard's Appearance toggle, so the choice carries across sign-in. */
export function AuthThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={clsx(
        'inline-flex items-center gap-2 h-8 pl-2 pr-2.5 rounded-full text-xs font-medium cursor-pointer transition-colors',
        'bg-white/80 text-slate-700 border border-slate-200 shadow-sm hover:bg-white hover:text-slate-900 backdrop-blur',
        'dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/10 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        className,
      )}
    >
      {/* Shows the mode it switches to (same convention as the main dashboard's login). */}
      {dark ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

/** Background, theme toggle and centred form column shared by every auth screen. `aside` renders a
 * branding panel to the left of the form on large screens (login only). */
export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white transition-colors duration-200">
      {/* Background — soft and matte in light mode, deep navy in dark mode */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.10),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.07),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.10),transparent_50%)]" />
        <div className="auth-grid absolute inset-0" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <AuthThemeToggle />
      </div>

      {aside}

      <div className="flex-1 flex items-center justify-center relative px-5 py-16 sm:px-6">
        <div className="w-full max-w-[400px] rounded-2xl border p-6 sm:p-8 bg-white/90 border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-8px_rgba(15,23,42,0.10)] backdrop-blur dark:bg-white/[0.04] dark:border-white/10 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthBrand({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <img src="/logo.svg" alt="" className="w-9 h-9" />
      <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Tcheck</span>
    </div>
  );
}

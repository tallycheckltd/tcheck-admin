/**
 * Shared classes for the sign-in screens (login + OTP, forgot / reset password, accept invite,
 * Microsoft callback). Every class carries both its light and its `dark:` value, so each screen
 * follows the app theme (system preference by default, the toggle in AuthShell otherwise).
 */
export const auth = {
  title: 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-white',
  subtitle: 'text-sm text-balance text-slate-500 dark:text-slate-400',
  label: 'block text-[13px] font-medium text-slate-700 dark:text-slate-300',
  input:
    'w-full py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-500/50 transition-all',
  /** Leading icon inside an input (wrap the input in `relative group`). */
  inputIcon:
    'absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors pointer-events-none',
  /** Trailing show/hide button inside an input. */
  inputButton:
    'absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer',
  primaryButton:
    'w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-600/20 dark:shadow-lg dark:shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
  secondaryButton:
    'w-full flex items-center justify-center gap-3 py-2.5 px-6 rounded-xl text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-sm dark:text-slate-900 dark:border-white/20 dark:hover:bg-slate-100 transition-colors disabled:opacity-60 cursor-pointer',
  link: 'font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors',
  mutedLink: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors',
  spinner: 'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin',
  divider: 'flex-1 h-px bg-slate-200 dark:bg-white/10',
  fine: 'text-xs text-slate-500 dark:text-slate-500',
} as const;

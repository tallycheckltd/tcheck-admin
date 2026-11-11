/** Shared class strings for the auth screens (login, forgot/reset password) so every field, button
 * and notice looks identical — and correct — in both light and dark mode. Kept out of the .tsx
 * component files for react-refresh's only-export-components rule. */

export const authLabel = 'block text-xs font-medium text-slate-700 dark:text-slate-300';

export const authInput =
  'w-full py-2.5 rounded-lg text-sm transition-colors ' +
  'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 shadow-sm shadow-slate-900/[0.03] ' +
  'dark:bg-white/[0.04] dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:shadow-none ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400/60';

export const authInputIcon =
  'absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors pointer-events-none';

export const authIconButton =
  'absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';

export const authPrimaryButton =
  'w-full flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold text-white ' +
  'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-sm shadow-blue-600/20 ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950';

export const authLink =
  'font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors';

export const authMutedLink =
  'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors';

export const authTitle = 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-white';
export const authSubtitle = 'text-sm text-balance text-slate-600 dark:text-slate-400';

export const authError =
  'flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm border ' +
  'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300';

export const authSuccess =
  'flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-sm border ' +
  'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300';

export const authWarning =
  'rounded-lg px-3.5 py-3 border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300';

export const authSpinner =
  'w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin';

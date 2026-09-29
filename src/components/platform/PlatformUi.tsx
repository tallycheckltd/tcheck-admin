import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

/**
 * Building blocks for the Super Admin's Watchtower (/platform/*), in the same idiom as the Insights
 * page (components/insights/InsightsUi.tsx): GlassCard sections, tinted-icon tiles, one accent colour,
 * status in words as well as colour.
 */

export const inputCls = 'w-full rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50';
export const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5';
export const thCls = 'text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-5 py-3 whitespace-nowrap';
export const tdCls = 'px-5 py-3.5 border-t border-gray-100 dark:border-white/5 align-middle text-sm text-slate-700 dark:text-slate-300';

/** Page header: eyebrow, title, one-line explanation, actions on the right. */
export function PageHeader({ title, subtitle, actions, eyebrow = 'Watchtower' }: { title: string; subtitle: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white mt-1">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/** A visible, checkable switch (a real checkbox, so labels and assistive tech work). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={clsx(
        'relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full transition-colors',
        'bg-slate-300 dark:bg-white/15 checked:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50',
        "before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow before:transition-transform before:content-['']",
        'checked:before:translate-x-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
      )}
    />
  );
}

const palette = ['bg-blue-500/15 text-blue-700 dark:text-blue-300', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', 'bg-purple-500/15 text-purple-700 dark:text-purple-300', 'bg-amber-500/15 text-amber-700 dark:text-amber-300', 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', 'bg-rose-500/15 text-rose-700 dark:text-rose-300'];
/** Initials in a tinted square — a stable colour per name so a tenant is recognisable across pages. */
export function Avatar({ name, color }: { name: string; color?: string | null }) {
  const initials = name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return (
    <span
      className={clsx('w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', !color && palette[idx])}
      style={color ? { backgroundColor: `${color}26`, color } : undefined}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Segmented control (filters, tabs). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)}
          className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap', value === o.key ? 'bg-white dark:bg-white/15 text-slate-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>
          {o.label}{o.count != null && <span className="ml-1.5 text-xs tabular-nums text-slate-400">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A status dot + words (never colour alone). */
export function Status({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; children: ReactNode }) {
  const dot = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500', info: 'bg-blue-500', muted: 'bg-slate-400' }[tone];
  const text = { ok: 'text-emerald-700 dark:text-emerald-300', warn: 'text-amber-700 dark:text-amber-300', bad: 'text-rose-700 dark:text-rose-300', info: 'text-blue-700 dark:text-blue-300', muted: 'text-slate-500 dark:text-slate-400' }[tone];
  return <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', text)}><span className={clsx('w-1.5 h-1.5 rounded-full', dot)} aria-hidden />{children}</span>;
}

/** Stacked horizontal bar (e.g. healthy / low battery / silent). */
export function StackBar({ parts, label }: { parts: { value: number; className: string; name: string }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden flex" role="img" aria-label={`${label}: ${parts.map((p) => `${p.value} ${p.name}`).join(', ')}`}>
      {total > 0 && parts.map((p) => p.value > 0 && <div key={p.name} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />)}
    </div>
  );
}

/** Wizard progress: numbered steps with a check once passed, and the current step named underneath. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div>
      <ol className="flex items-center gap-2" aria-label="Progress">
        {steps.map((s, i) => {
          const n = i + 1; const done = n < current; const on = n === current;
          return (
            <li key={s} className="flex items-center gap-2 flex-1 last:flex-none" title={s}>
              <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                done ? 'bg-blue-600 text-white' : on ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300 ring-2 ring-blue-600' : 'bg-slate-100 dark:bg-white/10 text-slate-500')}
                aria-current={on ? 'step' : undefined} aria-label={`Step ${n}: ${s}${done ? ' (done)' : ''}`}>
                {done ? <Check size={14} /> : n}
              </span>
              {n < steps.length && <span className={clsx('h-0.5 flex-1 rounded', done ? 'bg-blue-600' : 'bg-slate-200 dark:bg-white/10')} aria-hidden />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Step {current} of {steps.length} · <span className="font-semibold text-slate-800 dark:text-slate-200">{steps[current - 1]}</span></p>
    </div>
  );
}

/** Empty / loading / error placeholder inside a card. */
export function Placeholder({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="py-10 text-center">
      {icon && <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {children && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{children}</p>}
    </div>
  );
}

/** Loading skeleton rows for tables/cards. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />)}
    </div>
  );
}

/** A compact figure (label over number) used in summary strips. */
export function Figure({ label, value, tone }: { label: string; value: ReactNode; tone?: 'warn' | 'bad' }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={clsx('text-xl font-bold tabular-nums leading-tight mt-0.5', tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white')}>{value}</p>
    </div>
  );
}

export function SummaryStrip({ children }: { children: ReactNode }) {
  return <GlassCard className="!p-5"><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">{children}</div></GlassCard>;
}

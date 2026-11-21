/**
 * Visitors (2026-11-21) — the building blocks every Visitors page shares, so the section reads as one
 * calm, premium surface: a page header, pill filters with counts, a slim metrics strip, initials
 * avatars, and person rows (a card list that stays readable on a phone instead of a wide table).
 */
import type { ReactNode } from 'react';

const TONES = ['bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800'];
const DARK = ['dark:bg-sky-500/20 dark:text-sky-200', 'dark:bg-violet-500/20 dark:text-violet-200', 'dark:bg-emerald-500/20 dark:text-emerald-200', 'dark:bg-amber-500/20 dark:text-amber-200', 'dark:bg-rose-500/20 dark:text-rose-200', 'dark:bg-indigo-500/20 dark:text-indigo-200', 'dark:bg-teal-500/20 dark:text-teal-200'];
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function initials(name: string) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1]![0] : '')).toUpperCase() || '?'; }

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const i = hash(name) % TONES.length;
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TONES[i]} ${DARK[i]}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function PageHeader({ eyebrow = 'Visitors', title, intro, actions, live }: { eyebrow?: string; title: string; intro?: ReactNode; actions?: ReactNode; live?: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad] dark:text-blue-300">
          {live && <span className="relative flex h-2 w-2" aria-hidden><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
          {eyebrow}{live && <span className="font-medium normal-case tracking-normal text-slate-500">· live</span>}
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-950 dark:text-white">{title}</h1>
        {intro && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export interface SegmentOption<K extends string> { key: K; label: string; count?: number }

/** Pill filters with counts; one selected. */
export function Segmented<K extends string>({ options, value, onChange, label }: { options: SegmentOption<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-slate-100/80 p-1 dark:bg-white/[0.06]">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button key={o.key || 'all'} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${on ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/15 dark:text-white dark:ring-white/10' : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}>
            {o.label}
            {o.count !== undefined && <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? 'bg-[#004aad] text-white dark:bg-blue-500' : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface Metric { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }

/** A slim row of figures; colour only where something needs attention. */
export function MetricStrip({ items }: { items: Metric[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:ring-white/10 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {items.map((m) => (
        <div key={m.label} className="border-slate-100 px-5 py-4 dark:border-white/5 [&:not(:last-child)]:border-r">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            {m.tone && m.tone !== 'default' && <span className={`h-1.5 w-1.5 rounded-full ${m.tone === 'bad' ? 'bg-rose-500' : m.tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} />}
            {m.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">{m.value}</dd>
          {m.hint && <dd className="mt-0.5 text-xs text-slate-500">{m.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** The card that holds person rows, with an optional caption line (counts, "newest first"). */
export function RowList({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 dark:bg-white/[0.03] dark:ring-white/10">
      {caption && <p className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-white/5">{caption}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-white/5">{children}</ul>
    </section>
  );
}

/**
 * One person in a list: avatar, name and status, a line of details, an aside (time, window) and
 * actions. Highlights an overstay or a blocked person with a soft tint and a side stripe.
 */
export function PersonRow({ name, status, meta, details, aside, actions, highlight }: {
  name: string; status?: ReactNode; meta?: (string | null | undefined | false)[]; details?: ReactNode; aside?: ReactNode; actions?: ReactNode; highlight?: 'warn' | 'bad' | null;
}) {
  const tint = highlight === 'bad' ? 'bg-rose-50/70 dark:bg-rose-500/[0.06] shadow-[inset_3px_0_0_#e11d48]' : highlight === 'warn' ? 'bg-amber-50/70 dark:bg-amber-500/[0.06] shadow-[inset_3px_0_0_#f59e0b]' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]';
  const line = (meta ?? []).filter(Boolean).join(' · ');
  return (
    <li className={`flex flex-col gap-3 px-5 py-4 transition-colors sm:flex-row sm:items-center ${tint}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-950 dark:text-white"><span className="truncate">{name}</span>{status}</p>
          {line && <p className="truncate text-sm text-slate-500 tabular-nums">{line}</p>}
          {details && <div className="mt-0.5 text-xs text-slate-500">{details}</div>}
        </div>
      </div>
      {aside && <div className="text-sm text-slate-600 dark:text-slate-300 sm:w-56 sm:text-right">{aside}</div>}
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </li>
  );
}

/** A soft pill for a person's state. */
export function Pill({ tone = 'gray', children }: { tone?: 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'violet'; children: ReactNode }) {
  const c = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300',
    blue: 'bg-blue-50 text-[#004aad] ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-300',
    gray: 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-white/10 dark:text-slate-300',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/15 dark:text-violet-300',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${c}`}>{children}</span>;
}

/** A calm loading row set instead of a bare spinner. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 dark:bg-white/[0.03] dark:ring-white/10" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 border-b border-slate-100 px-5 py-4 last:border-0 dark:border-white/5">
          <span className="h-10 w-10 animate-pulse rounded-full bg-slate-100 dark:bg-white/10" />
          <span className="flex-1 space-y-2"><span className="block h-3 w-40 animate-pulse rounded bg-slate-100 dark:bg-white/10" /><span className="block h-3 w-64 max-w-full animate-pulse rounded bg-slate-100 dark:bg-white/10" /></span>
        </div>
      ))}
    </div>
  );
}

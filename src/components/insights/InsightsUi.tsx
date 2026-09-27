import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { GlassCard } from '../ui/GlassCard';

/**
 * Building blocks for the Insights page (Overview + Feedback tabs), in the dashboard's own idiom:
 * GlassCard sections, StatCard-style tiles with a tinted icon, recharts for charts. Charts here are
 * always ONE series (brand blue), so there's no legend box — the card title names it; a threshold
 * is a dashed reference line; "below threshold" uses the reserved warning colour with a label.
 */

export const BRAND = '#3B82F6';

const tint = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
} as const;
export type TileColor = keyof typeof tint;

/** A section card: title, optional one-line explanation and a right-hand action. */
export function Card({ title, subtitle, action, children, className, accent }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
  /** 'attention' = amber left edge, for the "needs attention" card only. */
  accent?: 'attention';
}) {
  return (
    <GlassCard className={clsx('!p-0 overflow-hidden', accent === 'attention' && 'border-l-4 !border-l-amber-500', className)}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </GlassCard>
  );
}

/** "↑ 2.1 pts vs previous 30 days" — only when both sides exist. */
export function Delta({ current, previous, unit = 'pts', days }: { current: number | null | undefined; previous: number | null | undefined; unit?: 'pts' | ''; days?: number }) {
  if (current == null || previous == null) return null;
  const d = Math.round((current - previous) * 10) / 10;
  const up = d > 0;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-medium tabular-nums',
      d === 0 ? 'text-slate-500 dark:text-slate-400' : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
      <span aria-hidden>{d === 0 ? '→' : up ? '↑' : '↓'}</span>
      {d === 0 ? 'No change' : `${Math.abs(d).toFixed(1)}${unit ? ` ${unit}` : ''}`}
      {days ? <span className="font-normal text-slate-500 dark:text-slate-400"> vs previous {days} days</span> : null}
    </span>
  );
}

/** KPI tile — same anatomy as StatCard (tinted icon, label, value) plus a basis line and a delta. */
export function Tile({ label, value, suffix, basis, delta, icon, color = 'blue', onClick, hint }: {
  label: string; value: string; suffix?: string; basis?: ReactNode; delta?: ReactNode; icon: ReactNode; color?: TileColor;
  onClick?: () => void; hint?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
        <span className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tint[color])}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white leading-none">
        {value}{suffix && <span className="ml-1 text-base font-medium text-slate-400">{suffix}</span>}
      </p>
      {basis && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{basis}</p>}
      {delta && <div className="mt-1">{delta}</div>}
      {hint && <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">{hint} →</p>}
    </>
  );
  return (
    <GlassCard className="!p-5 h-full">
      {onClick ? <button type="button" onClick={onClick} className="w-full text-left cursor-pointer">{body}</button> : body}
    </GlassCard>
  );
}

/**
 * A 0–max horizontal bar with an optional threshold tick. Below the threshold it turns warning
 * amber AND says so in words (never colour alone).
 */
export function RateBar({ value, max = 100, threshold, label }: { value: number | null; max?: number; threshold?: number; label?: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const below = value != null && threshold != null && value < threshold;
  return (
    <div className="w-full">
      <div className="relative h-2 rounded-full bg-slate-100 dark:bg-white/10" role="img" aria-label={label ?? (value == null ? 'No data' : `${value.toFixed(1)} of ${max}`)}>
        <div className={clsx('absolute inset-y-0 left-0 rounded-full', below ? 'bg-amber-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
        {threshold != null && (
          <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-slate-400 dark:bg-slate-500" style={{ left: `${(threshold / max) * 100}%` }} aria-hidden />
        )}
      </div>
    </div>
  );
}

/** "Below 80%" pill — the words that go with an amber bar. */
export function BelowPill({ threshold }: { threshold: number }) {
  return <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Below {threshold}%</span>;
}

export interface WeekPoint { label: string; value: number | null; sub: string }

/** One series per week (bars), with an optional dashed threshold line. Hover shows the basis. */
export function WeeklyBars({ data, max, threshold, unit, name }: { data: WeekPoint[]; max: number; threshold?: number; unit: string; name: string }) {
  const rows = data.map((d) => ({ ...d, v: d.value ?? 0 }));
  return (
    <div className="h-56 w-full" role="img" aria-label={`${name} by week`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
          <YAxis domain={[0, max]} ticks={max <= 10 ? [0, 2, 4, 6, 8, 10].filter((t) => t <= max) : [0, 25, 50, 75, 100].map((t) => (t / 100) * max)} tick={{ fontSize: 11 }} stroke="#94a3b8" axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v}${unit}`} />
          <Tooltip
            cursor={{ fill: 'rgba(59,130,246,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]!.payload as WeekPoint;
              return (
                <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-lg text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">{p.label}</p>
                  <p className="text-slate-700 dark:text-slate-300 tabular-nums">{name}: {p.value == null ? '—' : `${p.value.toFixed(1)}${unit}`}</p>
                  <p className="text-slate-500 dark:text-slate-400 tabular-nums">{p.sub}</p>
                </div>
              );
            }}
          />
          {threshold != null && (
            <ReferenceLine y={threshold} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `${threshold}${unit} threshold`, position: 'insideTopRight', fontSize: 11, fill: '#64748b' }} />
          )}
          <Bar dataKey="v" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Empty state inside a card. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {children && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{children}</p>}
    </div>
  );
}

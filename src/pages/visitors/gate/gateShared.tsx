/**
 * Gate access (2026-11-20) — shared pieces for Visitors → Gate access (ICT Admin, School Admin) and the
 * Super Admin's Gates pages: the section frame with its tabs, live refresh when the gate changes
 * (socket `gate:changed`, ids only — the page refetches), labels and small display helpers.
 */
import { NavLink } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const GATE_TABS = [
  { to: '/visitors/gate', label: 'Overview', end: true },
  { to: '/visitors/gate/live', label: 'Live feed' },
  { to: '/visitors/gate/doors', label: 'Doors' },
  { to: '/visitors/gate/people', label: 'People' },
  { to: '/visitors/gate/fingerprints', label: 'Fingerprints' },
  { to: '/visitors/gate/codes', label: 'Codes' },
  { to: '/visitors/gate/alerts', label: 'Suspicious activity' },
  { to: '/visitors/gate/jobs', label: 'Sync jobs' },
  { to: '/visitors/gate/check', label: 'BioStar check' },
  { to: '/visitors/gate/reports', label: 'Reports and audit' },
  { to: '/visitors/barrier', label: 'Setup' },
] as const;

export function GateShell({ title, intro, actions, children }: { title: string; intro?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gate access</p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
          {intro && <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <nav aria-label="Gate access pages" className="-mx-1 overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-slate-200 px-1 dark:border-white/10">
          {GATE_TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={'end' in t ? t.end : false}
                className={({ isActive }) => `inline-block border-b-2 px-3 py-2 text-sm whitespace-nowrap ${isActive ? 'border-blue-600 font-medium text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
              >{t.label}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-red-500/10 dark:text-red-300"><XCircle size={16} className="mt-0.5 shrink-0" />{error}</p>;
}

export function Panel({ title, hint, actions, children, className = '' }: { title: string; hint?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-card min-w-0 p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Tile({ label, value, sub, tone = 'default' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const ring = tone === 'bad' ? 'ring-rose-500/30' : tone === 'warn' ? 'ring-amber-500/30' : tone === 'good' ? 'ring-emerald-500/20' : 'ring-slate-900/5 dark:ring-white/10';
  const dot = tone === 'bad' ? 'bg-rose-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'good' ? 'bg-emerald-500' : null;
  return (
    <div className={`rounded-2xl bg-white p-4 ring-1 dark:bg-white/5 ${ring}`}>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">{dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/** A table that scrolls on its own at phone width. */
export function DataTable({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-white/10">{head.map((h) => <th key={h} scope="col" className="px-5 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">{children}</tbody>
      </table>
      {empty && <p className="px-5 py-8 text-center text-sm text-slate-500">{empty}</p>}
    </div>
  );
}


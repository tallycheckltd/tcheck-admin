import { useState } from 'react';
import { ChevronDown, History, Building2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';

interface Period {
  key: string; label: string; from: string; to: string;
  raised: number; resolved: number; open: number;
  medianResolveHours: number | null; medianAcknowledgeHours: number | null;
  categories: Record<string, number>;
}
interface HistoryResponse {
  groups: { institution: { id: string; name: string } | null; tenants: { school: { id: string; name: string }; periods: Period[] }[] }[];
}

const hrs = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`);
const CATEGORY: Record<string, string> = { GENERAL: 'General', BEACON_HEALTH: 'Beacon health' };

/**
 * UAT F7 (2026-09-29) — support history below the inbox: institution → school → term (a school with
 * no terms groups by calendar quarter). Each period is one line with its counts and typical times;
 * the latest term of each school is open, earlier ones folded — not an endless list.
 */
export function SupportHistory() {
  const { data } = useApi<HistoryResponse>('/tickets/history');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!data?.groups.length) return null;
  return (
    <section className="space-y-3" data-testid="support-history">
      <h2 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2"><History size={18} className="text-blue-500" /> History</h2>
      {data.groups.map((g) => (
        <div key={g.institution?.id ?? g.tenants[0]?.school.id} className="glass-card p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Building2 size={12} /> {g.institution?.name ?? g.tenants[0]?.school.name}</p>
          {g.tenants.map((t) => (
            <div key={t.school.id}>
              {g.institution && <p className="text-sm font-semibold text-slate-950 dark:text-white mb-1.5">{t.school.name}</p>}
              {!t.periods.length && <p className="text-xs text-slate-500">No tickets in the last two years.</p>}
              <div className="space-y-1.5">
                {t.periods.map((p, i) => {
                  const key = `${t.school.id}:${p.key}`;
                  const isOpen = open[key] ?? i === 0;
                  return (
                    <div key={key} className="rounded-xl border border-gray-100 dark:border-white/10">
                      <button onClick={() => setOpen((s) => ({ ...s, [key]: !isOpen }))} aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer">
                        <span className="text-sm">
                          <span className="font-medium text-slate-950 dark:text-white">{p.label}</span>
                          <span className="text-slate-500"> · {new Date(p.from).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {new Date(p.to).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </span>
                        <span className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{p.raised} raised · {p.resolved} resolved{p.open ? ` · ${p.open} open` : ''}</span>
                          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-slate-500">Typical time to acknowledge</p><p className="font-semibold text-slate-950 dark:text-white">{hrs(p.medianAcknowledgeHours)}</p></div>
                          <div><p className="text-slate-500">Typical time to resolve</p><p className="font-semibold text-slate-950 dark:text-white">{hrs(p.medianResolveHours)}</p></div>
                          <div className="col-span-2"><p className="text-slate-500">By category</p><p className="font-semibold text-slate-950 dark:text-white">{Object.entries(p.categories).map(([c, n]) => `${CATEGORY[c] ?? c} ${n}`).join(' · ')}</p></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

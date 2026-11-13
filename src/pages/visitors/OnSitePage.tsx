import { useMemo, useState } from 'react';
import { DoorOpen, Clock, AlertTriangle, MailCheck, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { duration, stamp, type AdminVisit } from './visitorsApi';

/**
 * Visitors (2026-11-13) — who is on site right now (ICT Admin, School Admin). Refreshes every 20
 * seconds so check-ins at the gate appear without a reload; overstays sort to the top and are
 * flagged. Full phone and ID numbers: this page is admin-only.
 */
export function OnSitePage() {
  const { data, loading, refetch } = useApi<{ visits: AdminVisit[]; overstayHours: number }>('/visitors/on-site', { refetchIntervalMs: 20_000, refetchWhenVisible: true });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const visits = useMemo(() => data?.visits ?? [], [data]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits
      .filter((v) => !q || [v.name, v.phone, v.nationalId, v.tagNumber, v.hostName, v.company].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.overstay) - Number(a.overstay) || a.checkInAt.localeCompare(b.checkInAt));
  }, [visits, search]);
  const overstays = visits.filter((v) => v.overstay).length;
  const invited = visits.filter((v) => v.invited).length;

  const checkOut = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/visits/${id}/check-out`); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">On site now</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Everyone checked in at the gate and not yet checked out. Updates on its own.</p>
        </div>
        <div className="w-full sm:w-72"><SearchInput id="onsite-search" aria-label="Search visitors on site" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, tag, host…" /></div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard size="compact" title="On site" value={visits.length} icon={<DoorOpen size={18} />} color="blue" />
        <StatCard size="compact" title="Invited" value={invited} icon={<MailCheck size={18} />} color="green" />
        <StatCard size="compact" title={`Over ${data?.overstayHours ?? 8} hours`} value={overstays} icon={<AlertTriangle size={18} />} color={overstays ? 'amber' : 'cyan'} />
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : shown.length === 0 ? (
        <EmptyState icon={DoorOpen} title={search ? 'No one matches' : 'No visitors on site'} description={search ? 'Try a different name, phone number or tag.' : 'When the guard checks a visitor in at the gate, they appear here.'} />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Visitor</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Tag</th>
                <th className="px-4 py-3 font-medium">Arrived</th>
                <th className="px-4 py-3 font-medium">On site</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {shown.map((v) => (
                <tr key={v.id} className={v.overstay ? 'bg-amber-50/60 dark:bg-amber-500/5' : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950 dark:text-white">{v.name}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{v.phone}{v.nationalId ? ` · ID ${v.nationalId}` : ''}{v.company ? ` · ${v.company}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {v.hostName ?? '—'}
                    {v.purpose && <p className="text-xs text-slate-500">{v.purpose}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{v.tagNumber ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {stamp(v.checkInAt)}
                    {v.checkInGate && <span className="block text-xs text-slate-500">{v.checkInGate}</span>}
                    <div className="mt-1"><Badge color={v.invited ? 'green' : 'gray'}>{v.invited ? 'Invited' : 'Walk-in'}</Badge></div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={v.overstay ? 'inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400' : 'inline-flex items-center gap-1 text-slate-700 dark:text-slate-300'}>
                      {v.overstay ? <AlertTriangle size={14} /> : <Clock size={14} />}{duration(v.minutesOnSite)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" disabled={busy === v.id} onClick={() => checkOut(v.id)}>{busy === v.id ? 'Checking out…' : 'Check out'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

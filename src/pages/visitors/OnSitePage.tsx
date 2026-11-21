import { useMemo, useState } from 'react';
import { DoorOpen, Clock, AlertTriangle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchInput } from '../../components/ui/SearchInput';
import { duration, stamp, type AdminVisit } from './visitorsApi';
import { PageHeader, Segmented, MetricStrip, RowList, PersonRow, Pill, ListSkeleton } from './visitorsUi';

/**
 * Visitors (2026-11-13; redesign 2026-11-21) — who is on site right now (ICT Admin, School Admin).
 * Updates on its own; newest arrival first; overstays flagged. Full phone and ID numbers: admin-only.
 */
type Filter = 'all' | 'invited' | 'walkin' | 'overstay';

export function OnSitePage() {
  const { data, loading, refetch } = useApi<{ visits: AdminVisit[]; overstayHours: number }>('/visitors/on-site', { refetchIntervalMs: 10_000, refetchWhenVisible: true });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const visits = useMemo(() => data?.visits ?? [], [data]);
  const overstays = visits.filter((v) => v.overstay).length;
  const invited = visits.filter((v) => v.invited).length;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits
      .filter((v) => filter === 'all' || (filter === 'invited' && v.invited) || (filter === 'walkin' && !v.invited) || (filter === 'overstay' && v.overstay))
      .filter((v) => !q || [v.name, v.phone, v.nationalId, v.tagNumber, v.hostName, v.company].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => b.checkInAt.localeCompare(a.checkInAt));
  }, [visits, search, filter]);

  const checkOut = async (id: string) => {
    setBusy(id);
    try { await api.post(`/visitors/visits/${id}/check-out`); await refetch({ silent: true }); } catch { /* shown by the app's error toast */ } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader live title="On site now" intro="Everyone who came in and hasn't left yet, newest first." />

      <MetricStrip items={[
        { label: 'On site', value: visits.length },
        { label: 'Invited', value: invited, hint: visits.length ? `${Math.round((invited / visits.length) * 100)}% of visitors` : undefined },
        { label: 'Walk-ins', value: visits.length - invited },
        { label: `Over ${data?.overstayHours ?? 8} hours`, value: overstays, tone: overstays ? 'warn' : 'default' },
      ]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Show" value={filter} onChange={setFilter} options={[
          { key: 'all', label: 'Everyone', count: visits.length }, { key: 'invited', label: 'Invited', count: invited },
          { key: 'walkin', label: 'Walk-ins', count: visits.length - invited }, { key: 'overstay', label: 'Overstaying', count: overstays },
        ]} />
        <div className="w-full sm:w-72"><SearchInput id="onsite-search" aria-label="Search visitors on site" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, tag, host…" /></div>
      </div>

      {loading && !data ? <ListSkeleton /> : shown.length === 0 ? (
        <EmptyState icon={DoorOpen} title={search || filter !== 'all' ? 'No one matches' : 'No visitors on site'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'Visitors appear here the moment they come in.'} />
      ) : (
        <RowList caption={`${shown.length} on site`}>
          {shown.map((v) => (
            <PersonRow key={v.id} name={v.name} highlight={v.overstay ? 'warn' : null}
              status={<><Pill tone={v.invited ? 'green' : 'gray'}>{v.invited ? 'Invited' : 'Walk-in'}</Pill>{v.tagNumber && <Pill tone="blue">Tag {v.tagNumber}</Pill>}</>}
              meta={[v.phone, v.nationalId && `ID ${v.nationalId}`, v.company]}
              details={v.hostName ? <>Visiting <span className="font-medium text-slate-700 dark:text-slate-300">{v.hostName}</span>{v.purpose ? ` · ${v.purpose}` : ''}</> : v.purpose}
              aside={<>
                <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${v.overstay ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{v.overstay ? <AlertTriangle size={14} /> : <Clock size={14} />}{duration(v.minutesOnSite)}</span>
                <span className="block text-xs text-slate-500">in at {stamp(v.checkInAt)}{v.checkInGate ? ` · ${v.checkInGate}` : ''}</span>
              </>}
              actions={<Button size="sm" variant="secondary" disabled={busy === v.id} onClick={() => checkOut(v.id)}>{busy === v.id ? 'Checking out…' : 'Check out'}</Button>}
            />
          ))}
        </RowList>
      )}
    </div>
  );
}

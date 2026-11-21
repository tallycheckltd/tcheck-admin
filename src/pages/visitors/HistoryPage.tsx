import { useEffect, useState } from 'react';
import { ClipboardList, Download, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import { duration, stamp, type AdminVisit } from './visitorsApi';
import { PageHeader, Segmented, RowList, PersonRow, Pill, ListSkeleton } from './visitorsUi';

/**
 * Visitors (2026-11-13) — every visit (ICT Admin, School Admin): search, dates, host, status and
 * type filters, and a CSV of exactly what is filtered (the export goes in the audit log).
 */

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function HistoryPage() {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 7 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [search, setSearch] = useState('');
  const [host, setHost] = useState('');
  const [status, setStatus] = useState<'' | 'onsite' | 'left'>('');
  const [type, setType] = useState<'' | 'invited' | 'walkin'>('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const q = useDebounced(search);
  const h = useDebounced(host);

  const params = new URLSearchParams();
  if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
  if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
  if (q.trim()) params.set('search', q.trim());
  if (h.trim()) params.set('host', h.trim());
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  const query = params.toString();
  const { data, loading, error } = useApi<AdminVisit[]>(`/visitors/visits?${query}`, { refetchIntervalMs: 15_000, refetchWhenVisible: true });
  const rows = data ?? [];

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await api.getText(`/visitors/visits?${query}&format=csv`);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `visitors-${from || 'all'}-to-${to || 'now'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Visitor history" intro="Every visit with arrival, departure and time on site."
        actions={<Button variant="secondary" onClick={exportCsv} disabled={exporting || rows.length === 0}>{exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Export CSV</Button>} />

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5 dark:bg-white/[0.03] dark:ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Status" value={status || 'any'} onChange={(k) => setStatus(k === 'any' ? '' : k)} options={[{ key: 'any', label: 'All visits' }, { key: 'onsite', label: 'On site' }, { key: 'left', label: 'Left' }]} />
          <Segmented label="Type" value={type || 'all'} onChange={(k) => setType(k === 'all' ? '' : k)} options={[{ key: 'all', label: 'Everyone' }, { key: 'invited', label: 'Invited' }, { key: 'walkin', label: 'Walk-ins' }]} />
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2"><SearchInput id="history-search" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, ID, tag" /></div>
          <Input id="history-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input id="history-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input id="history-host" label="Host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="Any host" />
        </div>
      </section>

      {exportError && <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading && !data ? <ListSkeleton /> : rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No visits match" description="Widen the dates or clear a filter." />
      ) : (
        <RowList caption={rows.length === 1000 ? 'Showing the newest 1,000 visits. Narrow the dates to see older ones, or export.' : `${rows.length} visit${rows.length === 1 ? '' : 's'}, newest first`}>
          {rows.map((v) => (
            <PersonRow key={v.id} name={v.name}
              status={<><Pill tone={v.invited ? 'green' : 'gray'}>{v.invited ? 'Invited' : 'Walk-in'}</Pill>{!v.checkOutAt && <Pill tone="blue">On site</Pill>}{v.tagNumber && <Pill>Tag {v.tagNumber}</Pill>}</>}
              meta={[v.phone, v.nationalId && `ID ${v.nationalId}`, v.company]}
              details={v.hostName ? <>Visited <span className="font-medium text-slate-700 dark:text-slate-300">{v.hostName}</span>{v.purpose ? ` · ${v.purpose}` : ''}</> : v.purpose}
              aside={<>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{duration(v.minutesOnSite)}</span>
                <span className="block text-xs text-slate-500">in {stamp(v.checkInAt)}{v.checkInGate ? ` · ${v.checkInGate}` : ''}</span>
                <span className="block text-xs text-slate-500">{v.checkOutAt ? <>out {stamp(v.checkOutAt)}{v.checkOutGate ? ` · ${v.checkOutGate}` : ''}</> : 'still on site'}</span>
              </>}
            />
          ))}
        </RowList>
      )}
    </div>
  );
}

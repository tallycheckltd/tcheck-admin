import { useEffect, useState } from 'react';
import { ClipboardList, Download, Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import { duration, stamp, type AdminVisit } from './visitorsApi';

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
  const { data, loading, error } = useApi<AdminVisit[]>(`/visitors/visits?${query}`);
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

  const select = 'w-full h-[42px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-slate-900 dark:text-white';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Visitor history</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Every visit with arrival, departure and time on site.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={exporting || rows.length === 0}>
          {exporting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Download size={16} className="mr-2" />}Export CSV
        </Button>
      </div>

      <div className="glass-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7 items-end">
        <div className="lg:col-span-2"><SearchInput id="history-search" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, ID, tag" /></div>
        <Input id="history-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input id="history-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input id="history-host" label="Host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="Any host" />
        <label htmlFor="history-status" className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
          <select id="history-status" className={select} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Any</option><option value="onsite">On site</option><option value="left">Left</option>
          </select>
        </label>
        <label htmlFor="history-type" className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Type</span>
          <select id="history-type" className={select} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="">All</option><option value="invited">Invited</option><option value="walkin">Walk-in</option>
          </select>
        </label>
      </div>

      {exportError && <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No visits match" description="Widen the dates or clear a filter." />
      ) : (
        <div className="glass-card overflow-x-auto">
          <p className="px-4 pt-3 text-xs text-slate-500">{rows.length === 1000 ? 'Showing the newest 1,000 visits. Narrow the dates to see older ones, or export.' : `${rows.length} visit${rows.length === 1 ? '' : 's'}`}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-gray-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Visitor</th>
                <th className="px-4 py-3 font-medium">ID number</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Tag</th>
                <th className="px-4 py-3 font-medium">Arrived</th>
                <th className="px-4 py-3 font-medium">Left</th>
                <th className="px-4 py-3 font-medium">Time on site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950 dark:text-white">{v.name} <span className="ml-1 align-middle"><Badge color={v.invited ? 'green' : 'gray'}>{v.invited ? 'Invited' : 'Walk-in'}</Badge></span></p>
                    <p className="text-xs text-slate-500 tabular-nums">{v.phone}{v.company ? ` · ${v.company}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">{v.nationalId ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{v.hostName ?? '—'}{v.purpose && <p className="text-xs text-slate-500">{v.purpose}</p>}</td>
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{v.tagNumber ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{stamp(v.checkInAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">{v.checkOutAt ? stamp(v.checkOutAt) : <Badge color="blue">On site</Badge>}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300">{duration(v.minutesOnSite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

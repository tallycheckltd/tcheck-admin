import { useMemo, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Download, Pencil, Printer, TrendingDown, TrendingUp, Minus, Building2, Plus, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { API_BASE } from '../../lib/apiBase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

interface Band { name: string; upTo: number; fee: number }
interface Plan {
  id: string; model: 'BAND' | 'PER_USER'; metric: 'SEAT' | 'USAGE'; currency: string; cycle: 'MONTHLY' | 'ANNUAL';
  bands: Band[]; contractedBand: string | null; overageRate: number; unitPrice: number; vatRate: number; discountPct: number; minimumFee: number;
  startsOn: string | null; notes: string | null; updatedAt: string;
}
interface Invoice { band: (Band & { used: number; pct: number | null }) | null; base: number; overageUsers: number; overage: number; discount: number; minimumTopUp: number; subtotal: number; vat: number; total: number }
interface Row {
  owner: 'INSTITUTION' | 'SCHOOL'; id: string; name: string; schools: { id: string; name: string; code: string }[]; isolated: string[];
  plan: Plan | null; period?: string; partial?: boolean; users?: number | null; perSchool?: { id: string; name: string; users: number | null }[];
  invoice?: Invoice | null; vsPrevious?: number | null; vsLastYear?: number | null; trend?: { period: string; users: number | null }[];
}
interface Invoices { period: string; totals: Record<string, number>; rows: Row[] }

const money = (n: number, c: string) => `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const monthNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthLabel = (p: string) => { const [y, m] = p.split('-').map(Number); return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); };

function Delta({ v, label }: { v: number | null | undefined; label: string }) {
  if (v === null || v === undefined) return <span className="text-xs text-gray-400">— {label}</span>;
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
  return <span className="text-xs text-gray-700 dark:text-gray-200 inline-flex items-center gap-1"><Icon size={12} /> {v > 0 ? '+' : ''}{v}% {label}</span>;
}

/** The contracted band as a bar: amber from 90 %, red above the cap — with the words, not colour alone. */
function BandBar({ band }: { band: NonNullable<Invoice['band']> }) {
  const pct = band.pct ?? 0;
  const tone = pct > 100 ? 'bg-rose-500' : pct >= 90 ? 'bg-amber-500' : 'bg-emerald-500';
  const words = pct > 100 ? `${band.used - band.upTo} over the band` : pct >= 90 ? 'Near the cap' : 'Within the band';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span className="text-gray-600 dark:text-gray-300">{band.name} · up to {band.upTo.toLocaleString()} users</span><span className="font-medium text-gray-900 dark:text-white">{band.used.toLocaleString()} / {band.upTo.toLocaleString()} · {words}</span></div>
      <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden" role="img" aria-label={`${band.used} of ${band.upTo} users (${pct}%)`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

/** 12-month billable users — one series, so no legend; hover shows the month and value. */
function Sparkline({ trend }: { trend: { period: string; users: number | null }[] }) {
  const data = trend.map((t) => ({ label: monthLabel(t.period), users: t.users }));
  if (!data.some((d) => d.users !== null)) return <p className="text-xs text-gray-400">No trend recorded yet (snapshots start this month).</p>;
  return (
    <div className="h-14 w-full" aria-label="Billable users, last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip cursor={{ stroke: 'currentColor', strokeOpacity: 0.2 }} formatter={(v) => [String(v ?? '—'), 'Users']} labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ''} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Line type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * UAT §6 (2026-09-29) — Billing: per institution (a single-campus school is its own), a plan set here
 * (flat fee per band with extra users above its cap, or a price per user), and the calculated invoice
 * for the month — band usage, the lines, VAT, the total, change vs last month and last year, a
 * 12-month trend. Calculated, not issued: export CSV or print an invoice.
 */
export function PlatformBillingPage() {
  const [period, setPeriod] = useState(monthNow);
  const { data, refetch } = useApi<Invoices>(`/platform/billing/invoices?period=${period}`);
  const [edit, setEdit] = useState<Row | null>(null);
  const [print, setPrint] = useState<Row | null>(null);

  const kpis = useMemo(() => {
    const billed = (data?.rows ?? []).filter((r) => r.invoice);
    const users = billed.reduce((n, r) => n + (r.users ?? 0), 0);
    const over = billed.filter((r) => (r.invoice?.overageUsers ?? 0) > 0).length;
    const deltas = billed.map((r) => r.vsPrevious).filter((v): v is number => v !== null && v !== undefined);
    return { users, over, notSetUp: (data?.rows ?? []).filter((r) => !r.plan).length, avgChange: deltas.length ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10 : null };
  }, [data]);

  const exportCsv = async () => {
    const r = await fetch(`${API_BASE}/platform/billing/invoices?period=${period}&format=csv`, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = `invoices-${period}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="platform-billing">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Each institution's plan and its calculated invoice for the month. Calculated only — nothing is sent or charged from here.</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} aria-label="Month" className="rounded-lg border px-2 py-1.5 text-sm dark:bg-white/5" />
          <Button variant="secondary" onClick={() => void exportCsv()}><Download size={14} className="mr-1.5" />Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Billed this month', Object.entries(data?.totals ?? {}).map(([c, v]) => money(v, c)).join(' · ') || '—'],
          ['Billable users', kpis.users.toLocaleString()],
          ['Change vs last month', kpis.avgChange === null ? '—' : `${kpis.avgChange > 0 ? '+' : ''}${kpis.avgChange}% (avg.)`],
          ['Over their band', `${kpis.over} institution${kpis.over === 1 ? '' : 's'}`],
        ].map(([label, value]) => (
          <div key={label} className="glass-card p-4"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p></div>
        ))}
      </div>
      {data?.rows.some((r) => r.partial) && <p className="text-xs text-gray-500">{monthLabel(period)} is still running — its numbers are "so far".</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {(data?.rows ?? []).map((r) => (
          <article key={r.id} className="glass-card p-5 space-y-4" data-testid="billing-card">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Building2 size={15} className="text-blue-500" /> {r.name}</p>
                {(r.schools.length > 1 || r.schools[0]?.name !== r.name) && <p className="text-xs text-gray-500">{r.schools.map((s) => s.name).join(' · ')}</p>}
              </div>
              {r.plan
                ? <Badge color="blue">{r.plan.model === 'BAND' ? `${r.plan.contractedBand} · band` : `${money(r.plan.unitPrice, r.plan.currency)} / user`} · {r.plan.metric === 'SEAT' ? 'seats' : 'usage'} · {r.plan.cycle.toLowerCase()}</Badge>
                : <Badge color="gray">No plan</Badge>}
            </header>

            {!r.plan ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-500">Not set up for billing yet.</p>
                <Button size="sm" onClick={() => setEdit(r)}><Plus size={14} className="mr-1" />Set up billing</Button>
              </div>
            ) : (
              <>
                {r.invoice?.band && <BandBar band={r.invoice.band} />}
                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                  <span className="text-sm"><strong>{r.users === null || r.users === undefined ? 'not recorded' : r.users.toLocaleString()}</strong> billable users</span>
                  <Delta v={r.vsPrevious} label="vs last month" />
                  <Delta v={r.vsLastYear} label="vs last year" />
                </div>
                {r.trend && <Sparkline trend={r.trend} />}
                {r.perSchool && r.perSchool.length > 1 && (
                  <ul className="text-xs text-gray-600 dark:text-gray-300 flex flex-wrap gap-x-3">{r.perSchool.map((s) => <li key={s.id}>{s.name}: {s.users ?? '—'}</li>)}</ul>
                )}
                {!!r.isolated.length && <p className="text-xs text-amber-700 dark:text-amber-300">{r.isolated.join(', ')} — isolated, not connected yet, so not counted.</p>}
                {r.invoice ? <InvoiceLines inv={r.invoice} plan={r.plan} users={r.users ?? 0} /> : <p className="text-sm text-gray-500">No figure for this month (not recorded, or a rebuilt month without seat counts).</p>}
                <footer className="flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setEdit(r)}><Pencil size={13} className="mr-1" />Edit plan</Button>
                  {r.invoice && <Button size="sm" variant="secondary" onClick={() => setPrint(r)}><Printer size={13} className="mr-1" />Invoice</Button>}
                </footer>
              </>
            )}
          </article>
        ))}
      </div>
      {edit && <PlanEditor row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refetch(); }} />}
      {print && <PrintInvoice row={print} onClose={() => setPrint(null)} />}
    </div>
  );
}

function InvoiceLines({ inv, plan, users }: { inv: Invoice; plan: Plan; users: number }) {
  const c = plan.currency;
  const lines: [string, number][] = [
    [plan.model === 'BAND' ? `${inv.band?.name ?? 'Band'} (flat fee)` : `${users.toLocaleString()} users × ${money(plan.unitPrice, c)}`, inv.base],
    ...(inv.overageUsers ? [[`${inv.overageUsers.toLocaleString()} extra users × ${money(plan.overageRate, c)}`, inv.overage] as [string, number]] : []),
    ...(inv.discount ? [[`Discount ${plan.discountPct}%`, -inv.discount] as [string, number]] : []),
    ...(inv.minimumTopUp ? [['Minimum fee top-up', inv.minimumTopUp] as [string, number]] : []),
    ['Subtotal', inv.subtotal],
    [`VAT ${plan.vatRate}%`, inv.vat],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {lines.map(([l, v]) => <tr key={l}><td className="py-0.5 text-gray-600 dark:text-gray-300">{l}</td><td className="py-0.5 text-right tabular-nums">{money(v, c)}</td></tr>)}
        <tr className="border-t border-gray-200 dark:border-white/10"><td className="pt-1.5 font-semibold">Total</td><td className="pt-1.5 text-right font-bold tabular-nums">{money(inv.total, c)}</td></tr>
      </tbody>
    </table>
  );
}

function PrintInvoice({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Invoice (calculated)">
      <div className="space-y-4 text-sm" id="printable-invoice">
        <div className="flex justify-between">
          <div><p className="font-bold text-lg">Tallycheck Ltd</p><p className="text-gray-500">Tcheck attendance platform</p></div>
          <div className="text-right"><p className="font-semibold">{row.name}</p><p className="text-gray-500">Period: {row.period}</p></div>
        </div>
        <p className="text-gray-500">Campuses: {row.schools.map((s) => s.name).join(', ')}. Billable users ({row.plan!.metric === 'SEAT' ? 'approved accounts at month end' : 'checked in during the month'}): {row.users?.toLocaleString()}.</p>
        <InvoiceLines inv={row.invoice!} plan={row.plan!} users={row.users ?? 0} />
        <p className="text-xs text-gray-400">Calculated by Tcheck on {new Date().toLocaleDateString()}. Not a tax invoice until issued.</p>
        <div className="flex justify-end gap-2 print:hidden"><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer size={14} className="mr-1.5" />Print / save as PDF</Button></div>
      </div>
    </Modal>
  );
}

/** The plan editor — bands, contracted band, extra-user rate, or a per-user price; VAT, discount, minimum. */
function PlanEditor({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const p = row.plan;
  const [f, setF] = useState({
    model: p?.model ?? 'BAND', metric: p?.metric ?? 'SEAT', currency: p?.currency ?? 'KES', cycle: p?.cycle ?? 'MONTHLY',
    bands: (p?.bands?.length ? p.bands : [{ name: 'Tier 1', upTo: 1000, fee: 0 }, { name: 'Tier 2', upTo: 3000, fee: 0 }]) as Band[],
    contractedBand: p?.contractedBand ?? 'Tier 1', overageRate: p?.overageRate ?? 0, unitPrice: p?.unitPrice ?? 200,
    vatRate: p?.vatRate ?? 16, discountPct: p?.discountPct ?? 0, minimumFee: p?.minimumFee ?? 0, startsOn: p?.startsOn?.slice(0, 10) ?? '', notes: p?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const save = async () => {
    setBusy(true); setError('');
    try {
      await api.put('/platform/billing/plans', {
        ...(row.owner === 'INSTITUTION' ? { institutionId: row.id } : { schoolId: row.id }),
        ...f, bands: f.model === 'BAND' ? f.bands : [], contractedBand: f.model === 'BAND' ? f.contractedBand : null,
        startsOn: f.startsOn || null, notes: f.notes || null,
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const remove = async () => { if (!p) return; await api.delete(`/platform/billing/plans/${p.id}`); onSaved(); };
  const field = 'rounded-lg border px-2 py-1.5 dark:bg-white/5 w-full';
  return (
    <Modal open onClose={onClose} title={`Billing plan — ${row.name}`}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label>Pricing<select className={field} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value as 'BAND' | 'PER_USER' })}><option value="BAND">Flat fee per band</option><option value="PER_USER">Price per user</option></select></label>
          <label>Billable users<select className={field} value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value as 'SEAT' | 'USAGE' })}><option value="SEAT">Approved accounts (seats)</option><option value="USAGE">Checked in during the period</option></select></label>
          <label>Currency<input className={field} value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></label>
          <label>Billed<select className={field} value={f.cycle} onChange={(e) => setF({ ...f, cycle: e.target.value as 'MONTHLY' | 'ANNUAL' })}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annually (peak month)</option></select></label>
        </div>
        {f.model === 'BAND' ? (
          <div className="space-y-2">
            <p className="font-medium">Bands</p>
            {f.bands.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <input className={field} aria-label="Band name" value={b.name} onChange={(e) => setF({ ...f, bands: f.bands.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input className={field} aria-label="Up to users" type="number" min={1} value={b.upTo} onChange={(e) => setF({ ...f, bands: f.bands.map((x, j) => (j === i ? { ...x, upTo: num(e.target.value) } : x)) })} />
                <input className={field} aria-label="Fee" type="number" min={0} value={b.fee} onChange={(e) => setF({ ...f, bands: f.bands.map((x, j) => (j === i ? { ...x, fee: num(e.target.value) } : x)) })} />
                <button aria-label="Remove band" onClick={() => setF({ ...f, bands: f.bands.filter((_, j) => j !== i) })} className="text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
              </div>
            ))}
            <p className="text-xs text-gray-500">Name · up to how many users · the fee for the {f.cycle === 'ANNUAL' ? 'year' : 'month'}</p>
            <button onClick={() => setF({ ...f, bands: [...f.bands, { name: `Tier ${f.bands.length + 1}`, upTo: 0, fee: 0 }] })} className="text-xs text-blue-600 cursor-pointer">+ Add a band</button>
            <div className="grid grid-cols-2 gap-2">
              <label>Contracted band<select className={field} value={f.contractedBand} onChange={(e) => setF({ ...f, contractedBand: e.target.value })}>{f.bands.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}</select></label>
              <label>Per extra user above the band<input className={field} type="number" min={0} value={f.overageRate} onChange={(e) => setF({ ...f, overageRate: num(e.target.value) })} /></label>
            </div>
          </div>
        ) : (
          <label>Price per user per {f.cycle === 'ANNUAL' ? 'year' : 'month'}<input className={field} type="number" min={0} value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: num(e.target.value) })} /></label>
        )}
        <div className="grid grid-cols-3 gap-2">
          <label>VAT %<input className={field} type="number" min={0} max={100} value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: num(e.target.value) })} /></label>
          <label>Discount %<input className={field} type="number" min={0} max={100} value={f.discountPct} onChange={(e) => setF({ ...f, discountPct: num(e.target.value) })} /></label>
          <label>Minimum fee<input className={field} type="number" min={0} value={f.minimumFee} onChange={(e) => setF({ ...f, minimumFee: num(e.target.value) })} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label>Contract starts<input className={field} type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} /></label>
          <label>Notes<input className={field} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        {error && <p className="text-rose-600">{error}</p>}
        <div className="flex justify-between">
          {p ? <Button variant="danger" size="sm" onClick={() => void remove()}>Remove plan</Button> : <span />}
          <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>Save plan</Button></div>
        </div>
        <p className="text-xs text-gray-500">Changes are recorded with your name and the time.</p>
      </div>
    </Modal>
  );
}

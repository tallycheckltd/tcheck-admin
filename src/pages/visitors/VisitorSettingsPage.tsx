import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { VisitorSettings, VisitorSettingsResponse } from './visitorsApi';

/**
 * Visitors (2026-11-13) — visitor settings (ICT Admin, School Admin). Its own page under Visitors so
 * ICT Admin, who has no school Settings page, can run the gate too; people are on Staff & guards.
 */

function Toggle({ id, label, help, checked, onChange }: { id: string; label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 py-3 cursor-pointer">
      <span>
        <span className="block text-sm font-medium text-slate-950 dark:text-white">{label}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{help}</span>
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-blue-600 cursor-pointer" />
    </label>
  );
}

export function VisitorSettingsPage() {
  const { data, loading } = useApi<VisitorSettingsResponse>('/visitors/settings');
  const [s, setS] = useState<VisitorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (data) setS(data.settings); }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setSaving(true); setSaved(false); setError(null);
    try {
      const r = await api.put<VisitorSettingsResponse>('/visitors/settings', s);
      setS(r.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the settings');
    } finally { setSaving(false); }
  };
  const set = <K extends keyof VisitorSettings>(k: K, v: VisitorSettings[K]) => { setSaved(false); setS((cur) => (cur ? { ...cur, [k]: v } : cur)); };
  const num = (k: 'defaultVisitHours' | 'earlyArrivalMinutes' | 'overstayHours' | 'retentionDays') => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Visitor settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Who can invite, how the gate works, and how long visitor records are kept.</p>
      </div>

      {loading || !s || !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : (
        <form onSubmit={save} className="glass-card p-5 space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-950 dark:text-white">Who can invite visitors</legend>
            <p className="text-xs text-slate-500 mt-0.5">ICT Admins and School Admins can always invite.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.inviterRoles.map((r) => (
                <label key={r.role} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox" className="h-4 w-4 accent-blue-600" checked={s.whoCanInvite.includes(r.role)}
                    onChange={(e) => set('whoCanInvite', e.target.checked ? [...s.whoCanInvite, r.role] : s.whoCanInvite.filter((x) => x !== r.role))}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="vs-hours" label="Default visit length (hours)" type="number" min={1} max={24} value={s.defaultVisitHours} onChange={num('defaultVisitHours')} />
            <Input id="vs-early" label="Code works this early (minutes)" type="number" min={0} max={240} value={s.earlyArrivalMinutes} onChange={num('earlyArrivalMinutes')} />
            <Input id="vs-overstay" label="Flag an overstay after (hours)" type="number" min={1} max={72} value={s.overstayHours} onChange={num('overstayHours')} />
            <Input id="vs-retention" label="Keep visitor records for (days)" type="number" min={7} max={3650} value={s.retentionDays} onChange={num('retentionDays')} />
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/5">
            <Toggle id="vs-id" label="ID number required at the gate" help="The guard can't check a walk-in in without an ID or passport number." checked={s.idRequiredAtGate} onChange={(v) => set('idRequiredAtGate', v)} />
            <Toggle id="vs-email" label="Email the host when their visitor arrives" help="Also shows as a notification in the dashboard and the app." checked={s.emailHostOnArrival} onChange={(v) => set('emailHostOnArrival', v)} />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle size={16} /> Saved</span>}
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
          </div>
        </form>
      )}

      <Link to="/visitors/staff" className="glass-card p-5 flex items-center justify-between gap-4 hover:ring-1 hover:ring-blue-500/40 transition">
        <span>
          <span className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white"><ShieldCheck size={18} className="text-blue-500" /> Front-desk staff and gate guards</span>
          <span className="block text-sm text-slate-600 dark:text-slate-400 mt-1">Add the people who invite visitors and run the gate, resend invites and reset passwords.</span>
        </span>
        <ChevronRight size={18} className="text-slate-400 shrink-0" />
      </Link>
    </div>
  );
}

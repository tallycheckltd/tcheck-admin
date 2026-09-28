import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Plus, Pencil, Trash2, Archive, RotateCcw } from 'lucide-react';
import type { AwardLevel, LastChanged, Major, OrgUnit } from '../../types';
import { LastChangedLine } from '../../components/academics/LastChangedLine';

export const AWARD_LABEL: Record<AwardLevel, string> = {
  CERTIFICATE: 'Certificate', DIPLOMA: 'Diploma', BACHELOR: "Bachelor's", POSTGRAD_DIPLOMA: 'Postgraduate diploma',
  MASTERS: "Master's", PHD: 'PhD', EXECUTIVE: 'Executive programme', OTHER: 'Other',
};

const selectCls = 'w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const emptyForm = { name: '', code: '', orgUnitId: '', awardLevel: '' as AwardLevel | '', durationMonths: '', offering: '' as '' | 'OPEN' | 'CUSTOM', tier: '', format: '' };
const OFFERING_LABEL = { OPEN: 'Open enrolment', CUSTOM: 'Custom (corporate)' } as const;

/**
 * P5 (A4) — the "Programmes" tab of Academics (the `Major` model). Owning department, award level
 * and duration; retire instead of delete once cohorts use it. `schoolId` is the school being
 * managed (a School Admin's own; the Super Admin's pick).
 */
export function MajorsPage({ schoolId }: { schoolId?: string }) {
  const q = schoolId ? `?schoolId=${schoolId}` : '';
  const { data: majors, refetch } = useApi<Major[]>(`/academic/majors${q}`);
  const { data: units } = useApi<OrgUnit[]>(schoolId ? `/org-units?schoolId=${schoolId}` : null);
  const ids = (majors ?? []).map((m) => m.id).join(',');
  const { data: last, refetch: refetchLast } = useApi<Record<string, LastChanged>>(ids && schoolId ? `/academic/last-changed?entityType=Major&ids=${ids}&schoolId=${schoolId}` : null);
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Major | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const owningUnits = (units ?? []).filter((u) => ['FACULTY', 'DEPARTMENT', 'SUB_DEPARTMENT'].includes(u.level));

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true); };
  const openEdit = (m: Major) => {
    setEditing(m);
    setForm({ name: m.name, code: m.code, orgUnitId: m.orgUnitId ?? '', awardLevel: m.awardLevel ?? '', durationMonths: m.durationMonths ? String(m.durationMonths) : '', offering: m.offering ?? '', tier: m.tier ?? '', format: m.format ?? '' });
    setError('');
    setModal(true);
  };
  const reload = () => { refetch(); refetchLast(); };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError('Name and code are required.'); return; }
    const payload = {
      name: form.name.trim(), code: form.code.trim(),
      orgUnitId: form.orgUnitId || null, awardLevel: form.awardLevel || null,
      durationMonths: form.durationMonths ? Number(form.durationMonths) : null,
      offering: form.offering || null, tier: form.tier.trim() || null, format: form.format.trim() || null,
    };
    try {
      if (editing) await update(`/academic/majors/${editing.id}`, payload);
      else await create('/academic/majors', { ...payload, schoolId });
      setModal(false);
      reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the programme'); }
  };

  const setActive = async (m: Major, isActive: boolean) => { await update(`/academic/majors/${m.id}`, { isActive }); reload(); };
  const handleDelete = async (m: Major) => {
    if (!confirm(`Delete "${m.name}"? Prefer Retire if cohorts or courses already use it.`)) return;
    await remove(`/academic/majors/${m.id}`);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-gray-400">Programmes are owned by a department so Deans and HODs see them. Retire one instead of deleting it once it has history.</p>
        <Button onClick={openCreate} disabled={!schoolId}><Plus size={16} className="mr-1" /> Add programme</Button>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-left text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4 font-medium">Programme</th>
                <th className="py-3 px-4 font-medium">Owning department</th>
                <th className="py-3 px-4 font-medium">Award</th>
                <th className="py-3 px-4 font-medium">Duration</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {majors?.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 dark:border-white/5 align-top">
                  <td className="py-3 px-4">
                    <p className="text-slate-950 dark:text-white font-medium flex items-center gap-2">{m.name} <span className="text-xs text-slate-500">{m.code}</span>{m.isActive === false && <Badge color="gray">Retired</Badge>}</p>
                    <LastChangedLine value={last?.[m.id]} />
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{m.orgUnit?.name ?? <span className="text-amber-600 dark:text-amber-400">No department</span>}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{m.awardLevel ? AWARD_LABEL[m.awardLevel] : '—'}{(m.offering || m.tier || m.format) && <p className="text-xs text-slate-500">{[m.offering ? OFFERING_LABEL[m.offering] : null, m.tier, m.format].filter(Boolean).join(' · ')}</p>}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{m.durationMonths ? `${m.durationMonths} months` : '—'}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)} aria-label={`Edit ${m.name}`}><Pencil size={14} /></Button>
                    {m.isActive === false
                      ? <Button variant="ghost" size="sm" onClick={() => void setActive(m, true)} aria-label={`Reactivate ${m.name}`}><RotateCcw size={14} /></Button>
                      : <Button variant="ghost" size="sm" onClick={() => void setActive(m, false)} aria-label={`Retire ${m.name}`}><Archive size={14} /></Button>}
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(m)} aria-label={`Delete ${m.name}`}><Trash2 size={14} className="text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {!majors?.length && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No programmes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit programme' : 'Add programme'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <div>
            <label htmlFor="prog-unit" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Owning department</label>
            <select id="prog-unit" value={form.orgUnitId} onChange={(e) => setForm({ ...form, orgUnitId: e.target.value })} className={selectCls}>
              <option value="">— None (Deans and HODs will not see it) —</option>
              {owningUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prog-award" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Award level</label>
              <select id="prog-award" value={form.awardLevel} onChange={(e) => setForm({ ...form, awardLevel: e.target.value as AwardLevel | '' })} className={selectCls}>
                <option value="">—</option>
                {(Object.keys(AWARD_LABEL) as AwardLevel[]).map((k) => <option key={k} value={k}>{AWARD_LABEL[k]}</option>)}
              </select>
            </div>
            <Input label="Duration (months)" type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} />
          </div>
          {/* P9 (A8.3) — executive education attributes; optional labels for filters and analytics. */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="prog-offering" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Offering</label>
              <select id="prog-offering" value={form.offering} onChange={(e) => setForm({ ...form, offering: e.target.value as '' | 'OPEN' | 'CUSTOM' })} className={selectCls}>
                <option value="">—</option>
                <option value="OPEN">{OFFERING_LABEL.OPEN}</option>
                <option value="CUSTOM">{OFFERING_LABEL.CUSTOM}</option>
              </select>
            </div>
            <Input label="Tier" placeholder="e.g. Senior" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} />
            <Input label="Format" placeholder="e.g. Modular" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={() => void handleSubmit()} className="w-full">{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Cohort, School, User } from '../../types';

export function CohortsPage() {
  const { data: cohorts, refetch } = useApi<Cohort[]>('/academic/cohorts');
  const { data: schools } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [form, setForm] = useState({ name: '', year: new Date().getFullYear(), schoolId: '', assignedCemId: '' });

  // execEdSuite-only CEM picker (SBS Comms & Concierge plan) — gated on the *selected* school's
  // own flag (not a global toggle), since this form's school can change per cohort. Re-fetched
  // whenever the selection changes, since assignedCemId must be a CLIENT_EXPERIENCE_MANAGER at
  // that same school. A non-SBS school never renders this field at all, matching every other
  // execEdSuite-gated surface in this plan.
  const selectedSchool = schools?.find((s) => s.id === form.schoolId);
  const execEdSuiteOn = !!selectedSchool?.features?.execEdSuite;
  const { data: cems } = useApi<User[]>(
    execEdSuiteOn ? `/users?schoolId=${form.schoolId}&role=CLIENT_EXPERIENCE_MANAGER&status=APPROVED` : '',
  );

  const openCreate = () => { setEditing(null); setForm({ name: '', year: new Date().getFullYear(), schoolId: '', assignedCemId: '' }); setModal(true); };
  const openEdit = (c: Cohort) => { setEditing(c); setForm({ name: c.name, year: c.year, schoolId: c.schoolId, assignedCemId: c.assignedCemId ?? '' }); setModal(true); };

  const handleSubmit = async () => {
    const payload = { name: form.name, year: form.year, schoolId: form.schoolId, assignedCemId: form.assignedCemId || null };
    if (editing) {
      await update(`/academic/cohorts/${editing.id}`, payload);
    } else {
      await create('/academic/cohorts', payload);
    }
    setModal(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cohort?')) return;
    await remove(`/academic/cohorts/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Cohorts</h1>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> Add Cohort</Button>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10">
                <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Name</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Year</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">School</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">CEM</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cohorts?.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-white/5">
                  <td className="py-3 px-4 text-slate-950 dark:text-white font-medium whitespace-nowrap">{c.name}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300 whitespace-nowrap">{c.year}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300 whitespace-nowrap">{c.school?.name ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300 whitespace-nowrap">{c.assignedCem ? `${c.assignedCem.firstName} ${c.assignedCem.lastName}` : '—'}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} className="text-red-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Cohort' : 'Add Cohort'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Year" type="number" value={String(form.year)} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })} />
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">School</label>
            <select
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value, assignedCemId: '' })}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a school</option>
              {schools?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {execEdSuiteOn && (
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Client Experience Manager (CEM)</label>
              {cems && cems.length > 0 ? (
                <select
                  value={form.assignedCemId}
                  onChange={(e) => setForm({ ...form, assignedCemId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No CEM assigned</option>
                  {cems.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  No Client Experience Managers at this school yet — create one under Roles &amp; Permissions to assign a CEM to this cohort.
                </p>
              )}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full">{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Cohort, School } from '../../types';

export function CohortsPage() {
  const { data: cohorts, refetch } = useApi<Cohort[]>('/academic/cohorts');
  const { data: schools } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [form, setForm] = useState({ name: '', year: new Date().getFullYear(), schoolId: '' });

  const openCreate = () => { setEditing(null); setForm({ name: '', year: new Date().getFullYear(), schoolId: '' }); setModal(true); };
  const openEdit = (c: Cohort) => { setEditing(c); setForm({ name: c.name, year: c.year, schoolId: c.schoolId }); setModal(true); };

  const handleSubmit = async () => {
    if (editing) {
      await update(`/academic/cohorts/${editing.id}`, form);
    } else {
      await create('/academic/cohorts', form);
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

      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Year</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">School</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cohorts?.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-3 px-4 text-slate-950 dark:text-white font-medium">{c.name}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{c.year}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{c.school?.name ?? '—'}</td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} className="text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Cohort' : 'Add Cohort'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Year" type="number" value={String(form.year)} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })} />
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">School</label>
            <select
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a school</option>
              {schools?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleSubmit} className="w-full">{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}

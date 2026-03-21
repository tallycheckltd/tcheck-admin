import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Major, School } from '../../types';

export function MajorsPage() {
  const { data: majors, refetch } = useApi<Major[]>('/academic/majors');
  const { data: schools } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Major | null>(null);
  const [form, setForm] = useState({ name: '', code: '', schoolId: '' });

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', schoolId: '' }); setModal(true); };
  const openEdit = (m: Major) => { setEditing(m); setForm({ name: m.name, code: m.code, schoolId: m.schoolId }); setModal(true); };

  const handleSubmit = async () => {
    if (editing) {
      await update(`/academic/majors/${editing.id}`, form);
    } else {
      await create('/academic/majors', form);
    }
    setModal(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this major?')) return;
    await remove(`/academic/majors/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Majors</h1>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> Add Major</Button>
      </div>

      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Code</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">School</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {majors?.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{m.name}</td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{m.code}</td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{m.school?.name ?? '—'}</td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}><Trash2 size={14} className="text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Major' : 'Add Major'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School</label>
            <select
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

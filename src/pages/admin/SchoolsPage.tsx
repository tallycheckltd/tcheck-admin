import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { School } from '../../types';

export function SchoolsPage() {
  const { data: schools, refetch } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState({ name: '', code: '', color: '#3B82F6' });

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', color: '#3B82F6' }); setModal(true); };
  const openEdit = (s: School) => { setEditing(s); setForm({ name: s.name, code: s.code, color: s.color }); setModal(true); };

  const handleSubmit = async () => {
    if (editing) {
      await update(`/schools/${editing.id}`, form);
    } else {
      await create('/schools', form);
    }
    setModal(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this school?')) return;
    await remove(`/schools/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schools</h1>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> Add School</Button>
      </div>

      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Code</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Color</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schools?.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{s.name}</td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{s.code}</td>
                <td className="py-3 px-4"><div className="w-6 h-6 rounded-full" style={{ backgroundColor: s.color }} /></td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 size={14} className="text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit School' : 'Add School'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label="Color" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <Button onClick={handleSubmit} className="w-full">{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { TablePager } from '../../components/ui/TablePager';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Level, School } from '../../types';

export function LevelsPage() {
  const { data: levels, refetch } = useApi<Level[]>('/academic/levels');
  const { data: schools } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Level | null>(null);
  const [form, setForm] = useState({ name: '', schoolId: '' });

  // Pagination (11-05): # numbers continue across pages.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const total = levels?.length ?? 0;
  const current = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
  const offset = current * pageSize;
  const pageRows = levels?.slice(offset, offset + pageSize);

  const openCreate = () => { setEditing(null); setForm({ name: '', schoolId: '' }); setModal(true); };
  const openEdit = (l: Level) => { setEditing(l); setForm({ name: l.name, schoolId: l.schoolId }); setModal(true); };

  const handleSubmit = async () => {
    if (editing) {
      await update(`/academic/levels/${editing.id}`, form);
    } else {
      await create('/academic/levels', form);
    }
    setModal(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this level?')) return;
    await remove(`/academic/levels/${id}`);
    refetch();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Levels</h1>
          {levels && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">{total.toLocaleString()} {total === 1 ? 'level' : 'levels'}</p>}
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> Add Level</Button>
      </div>

      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              <th className="w-12 text-left py-3 pl-4 pr-0 font-medium text-slate-600 dark:text-slate-400">#</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Institution</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows?.map((l, i) => (
              <tr key={l.id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-3 pl-4 pr-0 text-xs tabular-nums text-gray-400">{offset + i + 1}</td>
                <td className="py-3 px-4 text-slate-950 dark:text-white font-medium">{l.name}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{l.school?.name ?? '—'}</td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(l)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(l.id)}><Trash2 size={14} className="text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePager page={current} pageSize={pageSize} total={total} noun="levels" onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0); }} />
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Level' : 'Add Level'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Institution</label>
            <select
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an institution</option>
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

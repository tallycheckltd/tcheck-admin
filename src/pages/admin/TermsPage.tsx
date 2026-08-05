import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Plus, CalendarRange, CheckCircle2 } from 'lucide-react';
import type { Term, School } from '../../types';

const emptyForm = { name: '', startDate: '', endDate: '', schoolId: '' };

/**
 * Rolling a school onto a new active term is what auto-archives its course chat rooms (a room is
 * "current" only while its termId matches the school's active term — see message.service.ts) and
 * scopes new course enrollments/contacts going forward. Nothing here touches attendance history.
 */
export function TermsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const [schoolFilter, setSchoolFilter] = useState('');
  const { data: terms, refetch } = useApi<Term[]>(
    isSuperAdmin ? `/terms${schoolFilter ? `?schoolId=${schoolFilter}` : ''}` : '/terms',
  );
  const { mutate: create } = useMutation('post');
  const { mutate: activate } = useMutation('patch');

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async () => {
    await create('/terms', {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      schoolId: isSuperAdmin ? (form.schoolId || undefined) : undefined,
    });
    setModal(false);
    setForm(emptyForm);
    refetch();
  };

  const handleActivate = async (term: Term) => {
    if (!confirm(`Make "${term.name}" the active term? Course chat rooms will roll over to this term.`)) return;
    await activate(`/terms/${term.id}/activate`, { schoolId: isSuperAdmin ? term.schoolId : undefined });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Terms</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            The active term scopes new course enrollments, contacts, and course chat rooms — rolling over archives the previous term's rooms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
            >
              <option value="">All schools</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <Button onClick={() => setModal(true)}><Plus size={16} className="mr-1" /> New Term</Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Name</th>
              {isSuperAdmin && !schoolFilter && <th>School</th>}
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-800 dark:text-gray-300">
            {terms?.map((t) => (
              <tr key={t.id}>
                <td className="font-medium text-slate-950 dark:text-white flex items-center gap-2">
                  <CalendarRange size={14} className="text-blue-500" />
                  {t.name}
                </td>
                {isSuperAdmin && !schoolFilter && (
                  <td>{schools?.find((s) => s.id === t.schoolId)?.name || '—'}</td>
                )}
                <td>{new Date(t.startDate).toLocaleDateString()}</td>
                <td>{new Date(t.endDate).toLocaleDateString()}</td>
                <td>
                  <Badge color={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'Active' : 'Archived'}</Badge>
                </td>
                <td>
                  {!t.isActive && (
                    <button
                      onClick={() => handleActivate(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <CheckCircle2 size={13} /> Set Active
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!terms || terms.length === 0) && (
          <EmptyState icon={CalendarRange} title="No terms yet" description="Create one to start scoping enrollments and course chat rooms by term." size="md" />
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create Term">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fall 2026" />
          {isSuperAdmin && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
              <select
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                <option value="">Select a school</option>
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <Button
            onClick={handleCreate}
            className="w-full"
            disabled={!form.name.trim() || !form.startDate || !form.endDate || (isSuperAdmin && !form.schoolId)}
          >
            Create Term
          </Button>
        </div>
      </Modal>
    </div>
  );
}

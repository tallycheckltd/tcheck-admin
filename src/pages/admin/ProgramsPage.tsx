import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Users, Layers } from 'lucide-react';
import type { Course, Program, ProgramTemplate, School, User } from '../../types';

const TEMPLATE_LABELS: Record<ProgramTemplate, string> = {
  COFFEE_ONLY: 'Coffee Only',
  BARTENDING_ONLY: 'Bartending Only',
  COMBINED: 'Combined (Coffee + Bartending)',
};

const emptyForm = {
  name: '',
  schoolId: '',
  template: 'COFFEE_ONLY' as ProgramTemplate,
  theoryCourseId: '',
  coffeeCourseId: '',
  bartendingCourseId: '',
};

export function ProgramsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const [schoolFilter, setSchoolFilter] = useState('');
  const activeSchoolId = isSuperAdmin ? schoolFilter : user?.schoolId || '';

  const { data: programs, refetch } = useApi<Program[]>(
    `/programs${activeSchoolId ? `?schoolId=${activeSchoolId}` : ''}`,
  );
  const { data: courses } = useApi<Course[]>(activeSchoolId ? `/courses?schoolId=${activeSchoolId}` : null);
  const { mutate: create } = useMutation('post');
  const { mutate: enroll, loading: enrolling } = useMutation('post');

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [enrollModal, setEnrollModal] = useState<Program | null>(null);
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const { data: students } = useApi<User[]>(
    enrollModal ? `/users?role=STUDENT&schoolId=${enrollModal.schoolId}` : null,
  );

  const openCreate = () => {
    setForm({ ...emptyForm, schoolId: activeSchoolId || '' });
    setModal(true);
  };

  const handleSubmit = async () => {
    const payload = {
      name: form.name,
      schoolId: form.schoolId,
      template: form.template,
      ...(form.theoryCourseId && { theoryCourseId: form.theoryCourseId }),
      ...(form.coffeeCourseId && { coffeeCourseId: form.coffeeCourseId }),
      ...(form.bartendingCourseId && { bartendingCourseId: form.bartendingCourseId }),
    };
    await create('/programs', payload);
    setModal(false);
    refetch();
  };

  const openEnroll = (p: Program) => {
    setEnrollModal(p);
    setEnrollStudentId('');
    setEnrollError('');
  };

  const handleEnroll = async () => {
    if (!enrollModal || !enrollStudentId) return;
    setEnrollError('');
    try {
      await enroll(`/programs/${enrollModal.id}/enroll`, { userId: enrollStudentId });
      setEnrollModal(null);
      refetch();
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Failed to enroll student');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Programs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage degree tracks and student cohort assignments.
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> Add Program</Button>
      </div>

      {isSuperAdmin && (
        <GlassCard>
          <div className="space-y-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
            >
              <option value="">All schools</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Template</th>
              {isSuperAdmin && <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">School</th>}
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Enrolled</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs?.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-3 px-4 text-slate-950 dark:text-white font-medium">
                  <span className="flex items-center gap-2">
                    <Layers size={14} className="text-blue-500" />
                    {p.name}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{TEMPLATE_LABELS[p.template]}</td>
                {isSuperAdmin && (
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300">
                    {schools?.find((s) => s.id === p.schoolId)?.name ?? '—'}
                  </td>
                )}
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{p._count?.enrollments ?? 0}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => openEnroll(p)}
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
                  >
                    <Users size={13} /> Enroll student
                  </button>
                </td>
              </tr>
            ))}
            {programs?.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="py-8 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No programs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Program">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">School</label>
              <select
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a school</option>
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Template</label>
            <select
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value as ProgramTemplate })}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(TEMPLATE_LABELS) as ProgramTemplate[]).map((t) => (
                <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Theory Course</label>
            <select
              value={form.theoryCourseId}
              onChange={(e) => setForm({ ...form, theoryCourseId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a course</option>
              {courses?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>

          {(form.template === 'COFFEE_ONLY' || form.template === 'COMBINED') && (
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Coffee Practical Course</label>
              <select
                value={form.coffeeCourseId}
                onChange={(e) => setForm({ ...form, coffeeCourseId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a course</option>
                {courses?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
          )}

          {(form.template === 'BARTENDING_ONLY' || form.template === 'COMBINED') && (
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Bartending Practical Course</label>
              <select
                value={form.bartendingCourseId}
                onChange={(e) => setForm({ ...form, bartendingCourseId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a course</option>
                {courses?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={!form.name || !form.schoolId}
          >
            Create
          </Button>
        </div>
      </Modal>

      <Modal open={!!enrollModal} onClose={() => setEnrollModal(null)} title={`Enroll student — ${enrollModal?.name ?? ''}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Student</label>
            <select
              value={enrollStudentId}
              onChange={(e) => setEnrollStudentId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a student</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.studentId ? ` (${s.studentId})` : ''}</option>
              ))}
            </select>
          </div>
          {enrollError && <p className="text-xs text-red-500">{enrollError}</p>}
          <Button onClick={handleEnroll} className="w-full" disabled={!enrollStudentId || enrolling}>
            {enrolling ? 'Enrolling…' : 'Enroll'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

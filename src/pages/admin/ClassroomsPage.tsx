import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, Radio, X } from 'lucide-react';
import type { Beacon, Classroom, School } from '../../types';

/** Admin management of physical rooms ("Auditorium A", "Room 204") — a Beacon can be assigned to
 * one from BLEBeaconPage.tsx's edit form, replacing/augmenting the old free-text `location` field
 * with something listable and typo-proof. Mirrors LevelsPage.tsx's exact CRUD shape. */
export function ClassroomsPage() {
  const { data: classrooms, refetch } = useApi<Classroom[]>('/academic/classrooms');
  const { data: schools } = useApi<School[]>('/schools');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');
  const { mutate: updateBeacon } = useMutation('put');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState({ name: '', schoolId: '', description: '' });
  const [beaconToAssign, setBeaconToAssign] = useState('');

  // Only needed once a classroom is actually being edited (has an id + a known school) — lets the
  // modal show/change which beacons in that same school point at this room.
  const { data: schoolBeacons, refetch: refetchSchoolBeacons } = useApi<Beacon[]>(
    editing ? `/beacons?schoolId=${editing.schoolId}` : null,
  );
  const assignedBeacons = schoolBeacons?.filter((b) => b.classroomId === editing?.id) ?? [];
  const unassignableBeacons = schoolBeacons?.filter((b) => b.classroomId !== editing?.id) ?? [];

  const assignBeacon = async () => {
    if (!editing || !beaconToAssign) return;
    await updateBeacon(`/beacons/${beaconToAssign}`, { classroomId: editing.id });
    setBeaconToAssign('');
    refetchSchoolBeacons();
    refetch();
  };

  const unassignBeacon = async (beaconId: string) => {
    await updateBeacon(`/beacons/${beaconId}`, { classroomId: null });
    refetchSchoolBeacons();
    refetch();
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', schoolId: '', description: '' }); setBeaconToAssign(''); setModal(true); };
  const openEdit = (c: Classroom) => { setEditing(c); setForm({ name: c.name, schoolId: c.schoolId, description: c.description ?? '' }); setBeaconToAssign(''); setModal(true); };

  const handleSubmit = async () => {
    const payload = { name: form.name, schoolId: form.schoolId, description: form.description.trim() || undefined };
    if (editing) {
      await update(`/academic/classrooms/${editing.id}`, { name: payload.name, description: payload.description ?? null });
    } else {
      await create('/academic/classrooms', payload);
    }
    setModal(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this classroom? Any beacon assigned to it will be unassigned, not deleted.')) return;
    await remove(`/academic/classrooms/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Classrooms</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Physical rooms you can assign a beacon to — manage the list here, assign beacons from the Aura Sensors page.
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> Add Classroom</Button>
      </div>

      <GlassCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Name</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Description</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">School</th>
              <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Beacons</th>
              <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {classrooms?.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 dark:border-white/5">
                <td className="py-3 px-4 text-slate-950 dark:text-white font-medium">{c.name}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{c.description || '—'}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{c.school?.name ?? '—'}</td>
                <td className="py-3 px-4 text-slate-700 dark:text-gray-300">
                  <span className="inline-flex items-center gap-1">
                    <Radio size={12} className="text-blue-500" /> {c._count?.beacons ?? 0}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} className="text-red-500" /></Button>
                </td>
              </tr>
            ))}
            {classrooms?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">No classrooms yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Classroom' : 'Add Classroom'}>
        <div className="space-y-4">
          <Input label="Name" placeholder="e.g. Auditorium A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Description (optional)" placeholder="e.g. Ground floor, 80-seat capacity" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {!editing && (
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
          )}
          <Button onClick={handleSubmit} className="w-full" disabled={!form.name.trim() || (!editing && !form.schoolId)}>
            {editing ? 'Update' : 'Create'}
          </Button>

          {editing && (
            <div className="pt-4 border-t border-gray-200 dark:border-white/10 space-y-3">
              <label className="block text-sm font-medium text-slate-800 dark:text-gray-300">Beacons in this room</label>
              {assignedBeacons.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">No beacon assigned yet.</p>
              )}
              {assignedBeacons.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-slate-950 dark:text-white">
                    <Radio size={14} className="text-blue-500" /> {b.name}
                  </span>
                  <button onClick={() => unassignBeacon(b.id)} className="text-slate-500 hover:text-red-500" title="Unassign">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {unassignableBeacons.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={beaconToAssign}
                    onChange={(e) => setBeaconToAssign(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Assign an existing beacon…</option>
                    {unassignableBeacons.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.classroom ? ` (currently in ${b.classroom.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <Button onClick={assignBeacon} disabled={!beaconToAssign} size="sm">Assign</Button>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New hardware not listed here yet? Register it first from the Aura Sensors page, then come back to assign it.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

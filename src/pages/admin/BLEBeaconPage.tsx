import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Slider } from '../../components/ui/Slider';
import { Plus, Pencil, Trash2, Bluetooth } from 'lucide-react';
import type { Beacon, School } from '../../types';

const emptyForm = {
  uuid: '',
  name: '',
  major: 1,
  minor: 1,
  rssiThreshold: -90,
  location: '',
  description: '',
  isActive: true,
  schoolId: '',
};

export function BLEBeaconPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: beacons, refetch } = useApi<Beacon[]>('/beacons');
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: del } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (b: Beacon) => {
    setEditing(b.id);
    setForm({
      uuid: b.uuid,
      name: b.name,
      major: b.major,
      minor: b.minor,
      rssiThreshold: b.rssiThreshold,
      location: b.location || '',
      description: b.description || '',
      isActive: b.isActive,
      schoolId: b.schoolId || '',
    });
    setModal(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      location: form.location || undefined,
      description: form.description || undefined,
      // A SUB_ADMIN's schoolId is forced server-side regardless of what's sent here; only
      // SUPER_ADMIN's choice of school actually takes effect.
      schoolId: isSuperAdmin ? (form.schoolId || undefined) : undefined,
    };
    if (editing) {
      await update(`/beacons/${editing}`, payload);
    } else {
      await create('/beacons', payload);
    }
    setModal(false);
    setForm(emptyForm);
    setEditing(null);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this beacon? Courses using it will be unlinked.')) return;
    await del(`/beacons/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">BLE Beacon Manager</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {beacons?.length || 0} beacons configured
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} className="mr-1" /> New Beacon</Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Name</th>
              {isSuperAdmin && <th>School</th>}
              <th>UUID</th>
              <th>Major</th>
              <th>Minor</th>
              <th>RSSI</th>
              <th>Location</th>
              <th>Status</th>
              <th>Courses</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-800 dark:text-gray-300">
            {beacons?.map((b) => (
              <tr key={b.id}>
                <td className="font-medium text-slate-950 dark:text-white">
                  <span className="flex items-center gap-2">
                    <Bluetooth size={14} className="text-blue-500" />
                    {b.name}
                  </span>
                </td>
                {isSuperAdmin && (
                  <td>{b.school?.name || <span className="text-slate-600 dark:text-slate-400">Unassigned</span>}</td>
                )}
                <td className="font-mono text-xs">{b.uuid.substring(0, 8)}...</td>
                <td>{b.major}</td>
                <td>{b.minor}</td>
                <td>{b.rssiThreshold} dBm</td>
                <td>{b.location || '-'}</td>
                <td>
                  <Badge color={b.isActive ? 'green' : 'gray'}>
                    {b.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td>
                  {b.courses && b.courses.length > 0
                    ? b.courses.map((c) => c.code).join(', ')
                    : <span className="text-slate-600 dark:text-slate-400">None</span>
                  }
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer" title="Edit">
                      <Pencil size={15} className="text-slate-600" />
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete">
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!beacons || beacons.length === 0) && (
              <tr><td colSpan={isSuperAdmin ? 10 : 9} className="text-center py-8 text-slate-600 dark:text-slate-400">No beacons configured yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Beacon' : 'Create Beacon'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Room 101 Beacon" />
          {isSuperAdmin && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
              <select
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                <option value="">Unassigned</option>
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <Input label="UUID" value={form.uuid} onChange={(e) => setForm({ ...form, uuid: e.target.value })} placeholder="e.g. E2C56DB5-DFFB-48D2-B060-D0F5A71096E0" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Major" type="number" value={String(form.major)} onChange={(e) => setForm({ ...form, major: parseInt(e.target.value) || 0 })} />
            <Input label="Minor" type="number" value={String(form.minor)} onChange={(e) => setForm({ ...form, minor: parseInt(e.target.value) || 0 })} />
          </div>
          <Slider
            label="RSSI Threshold"
            min={-100}
            max={-30}
            step={1}
            unit=" dBm"
            value={form.rssiThreshold}
            onChange={(v) => setForm({ ...form, rssiThreshold: v })}
            marks={[{ value: -100, label: 'Far' }, { value: -30, label: 'Close' }]}
            helpText="The minimum signal strength a student's phone must detect to check in. More negative = works from farther away in the room; less negative = requires standing closer to the beacon. -90 is a good default for a typical classroom."
          />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Building A, Room 101" />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="beaconActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-gray-300 dark:border-white/20"
            />
            <label htmlFor="beaconActive" className="text-sm text-slate-800 dark:text-gray-300">Active</label>
          </div>
          <Button onClick={handleSubmit} className="w-full">{editing ? 'Update Beacon' : 'Create Beacon'}</Button>
        </div>
      </Modal>
    </div>
  );
}

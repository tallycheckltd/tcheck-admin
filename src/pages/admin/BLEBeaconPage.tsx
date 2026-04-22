import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Plus, Pencil, Trash2, Bluetooth } from 'lucide-react';
import type { Beacon } from '../../types';

const emptyForm = {
  uuid: '',
  name: '',
  major: 1,
  minor: 1,
  rssiThreshold: -75,
  location: '',
  description: '',
  isActive: true,
};

export function BLEBeaconPage() {
  const { data: beacons, refetch } = useApi<Beacon[]>('/beacons');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: del } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    // Smart Defaults
    const mostCommonUUID = beacons && beacons.length > 0 
      ? [...beacons].sort((a,b) => 
          beacons.filter(v => v.uuid === a.uuid).length - beacons.filter(v => v.uuid === b.uuid).length
        ).pop()?.uuid 
      : '';
    
    const lastMinor = beacons && beacons.length > 0
      ? Math.max(...beacons.map(b => b.minor))
      : 0;

    setEditing(null);
    setForm({ 
      ...emptyForm, 
      uuid: mostCommonUUID || '', 
      minor: lastMinor + 1 
    });
    setModal(true);
  };

  const applyPreset = (rssi: number) => {
    setForm({ ...form, rssiThreshold: rssi });
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
    });
    setModal(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      location: form.location || undefined,
      description: form.description || undefined,
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BLE Beacon Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
          <tbody className="text-gray-700 dark:text-gray-300">
            {beacons?.map((b) => (
              <tr key={b.id}>
                <td className="font-medium text-gray-900 dark:text-white">
                  <span className="flex items-center gap-2">
                    <Bluetooth size={14} className="text-blue-500" />
                    {b.name}
                  </span>
                </td>
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
                    : <span className="text-gray-400">None</span>
                  }
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer" title="Edit">
                      <Pencil size={15} className="text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete">
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!beacons || beacons.length === 0) && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">No beacons configured yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setEditing(null); }} title={editing ? 'Edit Beacon' : 'Create Beacon'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Room 101 Beacon" />
          <Input label="UUID" value={form.uuid} onChange={(e) => setForm({ ...form, uuid: e.target.value })} placeholder="e.g. E2C56DB5-DFFB-48D2-B060-D0F5A71096E0" />
          
          <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
              <Plus size={10} /> Quick Config Presets
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => applyPreset(-75)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all border ${
                  form.rssiThreshold === -75 ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10 hover:border-blue-500/50'
                }`}
              >
                Standard Room (-75dBm)
              </button>
              <button 
                onClick={() => applyPreset(-85)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all border ${
                  form.rssiThreshold === -85 ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10 hover:border-blue-500/50'
                }`}
              >
                Large Hall (-85dBm)
              </button>
            </div>
            <p className="text-[9px] text-gray-400 italic">
              Tip: Set physical beacon TxPower to low level (e.g. -12dBm) to prevent room bleed.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Major" type="number" value={String(form.major)} onChange={(e) => setForm({ ...form, major: parseInt(e.target.value) || 0 })} />
            <Input label="Minor" type="number" value={String(form.minor)} onChange={(e) => setForm({ ...form, minor: parseInt(e.target.value) || 0 })} />
            <Input label="RSSI Threshold" type="number" value={String(form.rssiThreshold)} onChange={(e) => setForm({ ...form, rssiThreshold: parseInt(e.target.value) || -75 })} />
          </div>
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
            <label htmlFor="beaconActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <Button onClick={handleSubmit} className="w-full">{editing ? 'Update Beacon' : 'Create Beacon'}</Button>
        </div>
      </Modal>
    </div>
  );
}

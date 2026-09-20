import { useState } from 'react';
import { Network, Plus, Trash2 } from 'lucide-react';
import { useMutation } from '../../hooks/useApi';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import type { OrgUnit, OrgUnitLevel } from '../../types';
import { LEVEL_LABEL } from '../../lib/hierarchyRoles';

const emptyUnitForm = { name: '', level: 'DIVISION' as OrgUnitLevel, parentId: '' };

/** The org-unit tree (Division / Faculty / Department / Sub-Department) with add + delete — the top half of the
 * merged "People & Organization" page. The parent page owns the `units` list because the staff table and the
 * create-user form below need it too. */
export function OrgUnitsSection({ schoolId, units, onChanged }: { schoolId: string; units: OrgUnit[]; onChanged: () => void }) {
  const { mutate: createUnit, loading: creatingUnit } = useMutation('post');
  const { mutate: deleteUnit } = useMutation('delete');
  const [unitModal, setUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [unitError, setUnitError] = useState('');

  const handleCreateUnit = async () => {
    setUnitError('');
    try {
      await createUnit('/org-units', { ...unitForm, schoolId, parentId: unitForm.parentId || null });
      setUnitModal(false);
      setUnitForm(emptyUnitForm);
      onChanged();
    } catch (e) {
      setUnitError(e instanceof Error ? e.message : 'Failed to create org unit');
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm('Delete this org unit? It must have no members or child units.')) return;
    try {
      await deleteUnit(`/org-units/${id}`);
      onChanged();
    } catch {
      alert('Could not delete — remove its members/child units first.');
    }
  };

  const unitsByLevel = (['DIVISION', 'FACULTY', 'DEPARTMENT', 'SUB_DEPARTMENT'] as OrgUnitLevel[]).map((level) => ({
    level,
    rows: units.filter((u) => u.level === level),
  }));

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"><Network size={16} className="text-blue-500" /> Organization</h3>
          <Button size="sm" onClick={() => setUnitModal(true)}><Plus size={14} className="mr-1" /> Add Org Unit</Button>
        </div>
        {units.length === 0 ? (
          <EmptyState icon={Network} title="No org units yet" description="Add a Division, Faculty, Department, or Sub-Department to start building the hierarchy." size="sm" />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {unitsByLevel.filter((g) => g.rows.length > 0).map((g) => (
              <div key={g.level} className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{LEVEL_LABEL[g.level]}</p>
                <div className="flex flex-wrap gap-2">
                  {g.rows.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 px-3 py-1.5 text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{u.name}</span>
                      {u.parent && <span className="text-gray-400">under {u.parent.name}</span>}
                      <span className="text-gray-400">· {u._count?.users ?? 0} people</span>
                      <button onClick={() => handleDeleteUnit(u.id)} aria-label={`Delete ${u.name}`} className="text-gray-300 hover:text-red-500 cursor-pointer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={unitModal} onClose={() => setUnitModal(false)} title="Add Org Unit">
        <div className="space-y-4">
          <Input label="Name" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} placeholder="e.g. School of Engineering" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
            <select
              value={unitForm.level}
              onChange={(e) => setUnitForm({ ...unitForm, level: e.target.value as OrgUnitLevel, parentId: '' })}
              className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white cursor-pointer"
            >
              {Object.entries(LEVEL_LABEL).map(([lvl, label]) => <option key={lvl} value={lvl}>{label}</option>)}
            </select>
          </div>
          {unitForm.level !== 'DIVISION' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Parent (optional)</label>
              <select
                value={unitForm.parentId}
                onChange={(e) => setUnitForm({ ...unitForm, parentId: e.target.value })}
                className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white cursor-pointer"
              >
                <option value="">— none —</option>
                {units.map((u) => <option key={u.id} value={u.id}>{LEVEL_LABEL[u.level]}: {u.name}</option>)}
              </select>
            </div>
          )}
          {unitError && <p className="text-xs text-red-500">{unitError}</p>}
          <Button onClick={handleCreateUnit} disabled={!unitForm.name || creatingUnit} className="w-full">
            {creatingUnit ? 'Creating…' : 'Create Org Unit'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

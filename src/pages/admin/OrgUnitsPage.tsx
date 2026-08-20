import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Network, Plus, Trash2, UserPlus, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import type { OrgUnit, OrgUnitLevel, Role, School, ScopeLevel, User } from '../../types';
import { HIERARCHY_ROLES, ROLE_LABEL } from '../../lib/rbac';

const LEVEL_LABEL: Record<OrgUnitLevel, string> = {
  DIVISION: 'Division',
  FACULTY: 'Faculty / School',
  DEPARTMENT: 'Department',
  SUB_DEPARTMENT: 'Sub-Department',
};

const SCOPE_FOR_ROLE: Record<Role, ScopeLevel> = {
  VC: 'UNIVERSITY',
  DVC: 'DIVISION',
  REGISTRAR_ACADEMIC: 'UNIVERSITY',
  REGISTRAR_ADMIN: 'UNIVERSITY',
  DEAN: 'DEPARTMENT',
  HOD: 'DEPARTMENT',
  DEPUTY_HOD: 'SUB_DEPARTMENT',
  ICT_ADMIN: 'INDIVIDUAL',
  SUPER_ADMIN: 'UNIVERSITY',
  SUB_ADMIN: 'SCHOOL',
  LECTURER: 'INDIVIDUAL',
  STUDENT: 'INDIVIDUAL',
  INVIGILATOR: 'INDIVIDUAL',
};

// Which OrgUnit level each hierarchy role is meant to be assigned into — null means the role is
// university-wide and never needs one (VC, Registrars).
const ORG_LEVEL_FOR_ROLE: Partial<Record<Role, OrgUnitLevel>> = {
  DVC: 'DIVISION',
  DEAN: 'FACULTY',
  HOD: 'DEPARTMENT',
  DEPUTY_HOD: 'SUB_DEPARTMENT',
};

const emptyUnitForm = { name: '', level: 'DIVISION' as OrgUnitLevel, parentId: '' };
const emptyUserForm = { email: '', password: '', firstName: '', lastName: '', role: 'DEAN' as Role, orgUnitId: '' };

export function OrgUnitsPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const schoolId = isSuperAdmin ? selectedSchoolId : currentUser?.schoolId || '';

  const { data: units, refetch: refetchUnits } = useApi<OrgUnit[]>(schoolId ? `/org-units?schoolId=${schoolId}` : null);
  const { data: allUsers, refetch: refetchUsers } = useApi<User[]>(schoolId ? `/users?schoolId=${schoolId}` : null);
  const hierarchyUsers = (allUsers ?? []).filter((u) => HIERARCHY_ROLES.includes(u.role));

  const { mutate: createUnit, loading: creatingUnit } = useMutation('post');
  const { mutate: deleteUnit } = useMutation('delete');
  const { mutate: createUser, loading: creatingUser } = useMutation('post');
  const { mutate: assignUser } = useMutation('patch');
  const { mutate: toggleActing } = useMutation('patch');

  const [unitModal, setUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [unitError, setUnitError] = useState('');

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userError, setUserError] = useState('');

  const handleCreateUnit = async () => {
    setUnitError('');
    try {
      await createUnit('/org-units', { ...unitForm, schoolId, parentId: unitForm.parentId || null });
      setUnitModal(false);
      setUnitForm(emptyUnitForm);
      refetchUnits();
    } catch (e) {
      setUnitError(e instanceof Error ? e.message : 'Failed to create org unit');
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm('Delete this org unit? It must have no members or child units.')) return;
    try {
      await deleteUnit(`/org-units/${id}`);
      refetchUnits();
    } catch {
      alert('Could not delete — remove its members/child units first.');
    }
  };

  const handleCreateUser = async () => {
    setUserError('');
    const scopeLevel = SCOPE_FOR_ROLE[userForm.role];
    const needsOrgUnit = !!ORG_LEVEL_FOR_ROLE[userForm.role];
    if (needsOrgUnit && !userForm.orgUnitId) {
      setUserError(`${ROLE_LABEL[userForm.role]} needs an org unit assigned.`);
      return;
    }
    try {
      await createUser('/users/hierarchy', {
        email: userForm.email,
        password: userForm.password,
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        schoolId,
        role: userForm.role,
        scopeLevel,
        orgUnitId: userForm.orgUnitId || null,
      });
      setUserModal(false);
      setUserForm(emptyUserForm);
      refetchUsers();
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const handleReassign = async (userId: string, orgUnitId: string) => {
    const targetUser = hierarchyUsers.find((u) => u.id === userId);
    if (!targetUser) return;
    await assignUser(`/org-units/users/${userId}/assign`, {
      orgUnitId: orgUnitId || null,
      scopeLevel: SCOPE_FOR_ROLE[targetUser.role],
    });
    refetchUsers();
  };

  const handleToggleActing = async (userId: string, isActingHod: boolean) => {
    await toggleActing(`/org-units/users/${userId}/acting-hod`, { isActingHod });
    refetchUsers();
  };

  const unitsByLevel = (['DIVISION', 'FACULTY', 'DEPARTMENT', 'SUB_DEPARTMENT'] as OrgUnitLevel[]).map((level) => ({
    level,
    rows: (units ?? []).filter((u) => u.level === level),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Network className="text-blue-500" /> Organization
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Divisions, faculties, and departments — and who leads each one (VC, DVC, Dean, HOD, Deputy HOD, Registrars, ICT Admin).
          </p>
        </div>
        {isSuperAdmin && (
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white cursor-pointer min-w-[220px]"
          >
            <option value="">Select a school…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {!schoolId ? (
        <EmptyState icon={Network} title="Select a school" description="Choose a school above to manage its org structure." />
      ) : (
        <>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Org Units</h3>
              <Button size="sm" onClick={() => setUnitModal(true)}><Plus size={14} className="mr-1" /> Add Org Unit</Button>
            </div>
            {(units?.length ?? 0) === 0 ? (
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
                          <button onClick={() => handleDeleteUnit(u.id)} className="text-gray-300 hover:text-red-500 cursor-pointer">
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

          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Hierarchy Accounts</h3>
              <Button size="sm" onClick={() => setUserModal(true)}><UserPlus size={14} className="mr-1" /> Add Person</Button>
            </div>
            {hierarchyUsers.length === 0 ? (
              <EmptyState icon={UserPlus} title="No hierarchy accounts yet" description="Add a VC, DVC, Dean, HOD, Registrar, or ICT Admin account." size="sm" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="text-left py-3 px-6">Name</th>
                      <th className="text-left py-3 px-6">Role</th>
                      <th className="text-left py-3 px-6">Org Unit</th>
                      <th className="text-right py-3 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {hierarchyUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 px-6">
                          <p className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</p>
                          <p className="text-[10px] text-gray-400">{u.email}</p>
                        </td>
                        <td className="py-3 px-6">
                          <Badge color="blue">{ROLE_LABEL[u.role]}</Badge>
                          {u.role === 'DEPUTY_HOD' && u.isActingHod && <span className="ml-1"><Badge color="green">Acting HOD</Badge></span>}
                        </td>
                        <td className="py-3 px-6">
                          {ORG_LEVEL_FOR_ROLE[u.role] ? (
                            <select
                              value={u.orgUnitId ?? ''}
                              onChange={(e) => handleReassign(u.id, e.target.value)}
                              className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-1 text-gray-900 dark:text-white cursor-pointer"
                            >
                              <option value="">— unassigned —</option>
                              {(units ?? []).filter((ou) => ou.level === ORG_LEVEL_FOR_ROLE[u.role]).map((ou) => (
                                <option key={ou.id} value={ou.id}>{ou.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-400">Whole school</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right">
                          {u.role === 'DEPUTY_HOD' && (
                            <button
                              onClick={() => handleToggleActing(u.id, !u.isActingHod)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              <ShieldCheck size={12} /> {u.isActingHod ? 'Revoke Acting HOD' : 'Grant Acting HOD'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

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
                {(units ?? []).map((u) => <option key={u.id} value={u.id}>{LEVEL_LABEL[u.level]}: {u.name}</option>)}
              </select>
            </div>
          )}
          {unitError && <p className="text-xs text-red-500">{unitError}</p>}
          <Button onClick={handleCreateUnit} disabled={!unitForm.name || creatingUnit} className="w-full">
            {creatingUnit ? 'Creating…' : 'Create Org Unit'}
          </Button>
        </div>
      </Modal>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Add Hierarchy Account">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role, orgUnitId: '' })}
              className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white cursor-pointer"
            >
              {HIERARCHY_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
            <Input label="Last name" value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
          </div>
          <Input label="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          <Input label="Temporary password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          {ORG_LEVEL_FOR_ROLE[userForm.role] && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {LEVEL_LABEL[ORG_LEVEL_FOR_ROLE[userForm.role]!]}
              </label>
              <select
                value={userForm.orgUnitId}
                onChange={(e) => setUserForm({ ...userForm, orgUnitId: e.target.value })}
                className="w-full rounded-xl py-2.5 px-4 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white cursor-pointer"
              >
                <option value="">— select —</option>
                {(units ?? []).filter((ou) => ou.level === ORG_LEVEL_FOR_ROLE[userForm.role]).map((ou) => (
                  <option key={ou.id} value={ou.id}>{ou.name}</option>
                ))}
              </select>
            </div>
          )}
          {userError && <p className="text-xs text-red-500">{userError}</p>}
          <Button
            onClick={handleCreateUser}
            disabled={!userForm.email || !userForm.password || !userForm.firstName || !userForm.lastName || creatingUser}
            className="w-full"
          >
            {creatingUser ? 'Creating…' : 'Create Account'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

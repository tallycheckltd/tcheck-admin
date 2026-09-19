import { useState } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, UserPlus, Users, Mail, Lock, User as UserIcon,
  Cake, MapPin, ClipboardCheck, MessageSquare, Megaphone, Settings2, BookOpen, Sparkles, Star,
  BarChart3, PieChart, Folder, Ticket, CheckSquare, Square,
} from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { CustomRole, Permission, Role, User, Course } from '../../types';

/** The full catalog — grouped for the checklist UI. Mirrors server/prisma/schema.prisma's
 * Permission enum exactly, all 21 values across 6 groups: every permission the server will accept
 * on a CustomRole is selectable here (see role.service.ts's ROLE_ASSIGNABLE_PERMISSIONS) —
 * including the Administration group below, which a SCHOOL_ADMIN can now delegate piecemeal
 * instead of it being fixed to their own account only. */
const PERMISSION_GROUPS: { title: string; items: { key: Permission; label: string; icon: React.ElementType }[] }[] = [
  {
    title: 'Sign-in access',
    items: [
      { key: 'MOBILE_ACCESS', label: 'Can log in on mobile', icon: UserPlus },
      { key: 'DASHBOARD_ACCESS', label: 'Can log in on the dashboard', icon: UserPlus },
    ],
  },
  {
    title: 'Administration',
    items: [
      { key: 'MANAGE_USERS', label: 'Create and manage users', icon: Users },
      { key: 'MANAGE_SCHOOL_SETTINGS', label: 'Edit school settings and branding', icon: Settings2 },
      { key: 'MANAGE_COURSES', label: 'Manage courses, classes and beacons', icon: BookOpen },
      { key: 'MANAGE_ANNOUNCEMENTS', label: 'Compose dashboard announcements', icon: Megaphone },
      { key: 'MANAGE_TICKETS', label: 'Manage support tickets', icon: Ticket },
    ],
  },
  {
    title: 'Students',
    items: [
      { key: 'VIEW_BIRTHDAYS', label: 'View student birthdays', icon: Cake },
      { key: 'VIEW_BLE_CHECKINS', label: 'View on-site (automatic) check-ins', icon: MapPin },
      { key: 'VIEW_MANUAL_CHECKINS', label: 'View manual check-ins', icon: ClipboardCheck },
      { key: 'MANUAL_CHECK_IN', label: 'Check students in manually', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Communication',
    items: [
      { key: 'MESSAGING', label: 'Use messaging', icon: MessageSquare },
      { key: 'BROADCAST_STUDENTS_APPROVED', label: 'Send "students approved" broadcast', icon: Megaphone },
      { key: 'BROADCAST_CLASS_SCHEDULE', label: 'Send "class starting" broadcast', icon: Megaphone },
    ],
  },
  {
    title: 'Onboarding journey',
    items: [
      { key: 'BROADCAST_PROGRAM_WELCOME', label: 'Send "program welcome" broadcast', icon: Sparkles },
      { key: 'BROADCAST_MATERIALS_READY', label: 'Send "materials ready" broadcast', icon: Sparkles },
      { key: 'BROADCAST_UPDATE', label: 'Send free-form update broadcasts', icon: Megaphone },
      { key: 'REQUEST_FEEDBACK', label: 'Request feedback from a student', icon: Star },
      { key: 'MANAGE_MATERIALS', label: 'List and add course materials', icon: Folder },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { key: 'VIEW_ANALYTICS', label: 'View attendance analytics (their assigned courses)', icon: BarChart3 },
      { key: 'VIEW_ANALYTICS_DEMOGRAPHICS', label: 'View gender/nationality breakdowns', icon: PieChart },
    ],
  },
];

const ALL_PERMISSION_KEYS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: 'CLIENT_EXPERIENCE_MANAGER', label: 'Client Experience Manager' },
  { value: 'LECTURER', label: 'Lecturer' },
];

function PermissionChecklist({ value, onChange }: { value: Permission[]; onChange: (next: Permission[]) => void }) {
  const toggle = (perm: Permission) => {
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm]);
  };
  const allSelected = ALL_PERMISSION_KEYS.every((k) => value.includes(k));
  const toggleAll = () => onChange(allSelected ? [] : [...ALL_PERMISSION_KEYS]);
  const toggleGroup = (keys: Permission[]) => {
    const groupFullySelected = keys.every((k) => value.includes(k));
    onChange(groupFullySelected ? value.filter((p) => !keys.includes(p)) : [...new Set([...value, ...keys])]);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={toggleAll}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-white/15 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer w-full"
      >
        {allSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className="text-gray-400" />}
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {allSelected ? 'Deselect all' : 'Select all'}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{value.length} / {ALL_PERMISSION_KEYS.length} selected</span>
      </button>
      {PERMISSION_GROUPS.map((group) => {
        const groupKeys = group.items.map((i) => i.key);
        const groupSelected = groupKeys.every((k) => value.includes(k));
        return (
          <div key={group.title}>
            <button
              type="button"
              onClick={() => toggleGroup(groupKeys)}
              className="flex items-center gap-1.5 mb-2 group cursor-pointer"
            >
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">{group.title}</p>
              <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {groupSelected ? '(clear)' : '(select all)'}
              </span>
            </button>
            <div className="space-y-1.5">
              {group.items.map(({ key, label, icon: Icon }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} className="w-4 h-4 rounded accent-blue-500" />
                  <Icon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const emptyRoleForm = { name: '', permissions: [] as Permission[] };
const emptyUserForm = { firstName: '', lastName: '', email: '', password: '', role: 'CLIENT_EXPERIENCE_MANAGER' as Role, customRoleId: '', courseIds: [] as string[] };

export function RolesPermissionsPage() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;

  const { data: roles, refetch: refetchRoles } = useApi<CustomRole[]>('/roles');
  const { data: staffUsers, refetch: refetchUsers } = useApi<User[]>(
    schoolId ? `/users?schoolId=${schoolId}` : '/users',
  );
  const { data: courses } = useApi<Course[]>('/courses');

  const { mutate: createRole, loading: creatingRole } = useMutation<CustomRole>('post');
  const { mutate: updateRole } = useMutation<CustomRole>('patch');
  const { mutate: deleteRole } = useMutation('delete');
  const { mutate: createUser, loading: creatingUser } = useMutation<User>('post');
  const { mutate: assignRole } = useMutation<User>('patch');

  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleError, setRoleError] = useState('');

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userError, setUserError] = useState('');

  const staffOnly = (staffUsers ?? []).filter((u) => u.role === 'LECTURER' || u.role === 'CLIENT_EXPERIENCE_MANAGER');

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(emptyRoleForm);
    setRoleError('');
    setRoleModal(true);
  };
  const openEditRole = (role: CustomRole) => {
    setEditingRole(role);
    setRoleForm({ name: role.name, permissions: role.permissions });
    setRoleError('');
    setRoleModal(true);
  };
  const submitRole = async () => {
    if (!roleForm.name.trim()) { setRoleError('Name is required.'); return; }
    try {
      if (editingRole) {
        await updateRole(`/roles/${editingRole.id}`, roleForm);
      } else {
        await createRole('/roles', { ...roleForm, schoolId });
      }
      setRoleModal(false);
      refetchRoles();
    } catch (e) {
      setRoleError(e instanceof Error ? e.message : 'Failed to save role');
    }
  };
  const handleDeleteRole = async (role: CustomRole) => {
    if (!confirm(`Delete the "${role.name}" role? Anyone holding it loses these permissions immediately.`)) return;
    await deleteRole(`/roles/${role.id}`);
    refetchRoles();
    refetchUsers();
  };

  const openCreateUser = () => {
    setUserForm(emptyUserForm);
    setUserError('');
    setUserModal(true);
  };
  const submitUser = async () => {
    if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim() || !userForm.password) {
      setUserError('All fields are required.');
      return;
    }
    try {
      const path = userForm.role === 'LECTURER' ? '/users/lecturer' : '/users/client-experience-manager';
      await createUser(path, {
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        email: userForm.email,
        password: userForm.password,
        schoolId,
        customRoleId: userForm.customRoleId || undefined,
        courseIds: userForm.courseIds,
      });
      setUserModal(false);
      refetchUsers();
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const handleAssignRole = async (targetUser: User, customRoleId: string) => {
    await assignRole(`/users/${targetUser.id}/role`, { customRoleId: customRoleId || null });
    refetchUsers();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck size={24} className="text-blue-500" /> Roles &amp; Permissions
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create a role, pick its permissions, then assign users to it — editing a role updates every user holding it immediately,
          on mobile and the dashboard alike.
        </p>
      </div>

      {/* Roles */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 size={18} /> Roles
          </h2>
          <Button onClick={openCreateRole} size="sm"><Plus size={16} className="mr-1.5" /> New Role</Button>
        </div>
        {!roles?.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            No roles yet — create one (e.g. &quot;Client Experience Manager&quot;) and pick its permissions.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <div key={role.id} className="p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{role.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} &middot; {role._count?.users ?? 0} user{role._count?.users === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditRole(role)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-500 cursor-pointer">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => void handleDeleteRole(role)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-red-500 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={18} /> Staff Users
          </h2>
          <Button onClick={openCreateUser} size="sm"><UserPlus size={16} className="mr-1.5" /> New User</Button>
        </div>
        {!staffOnly.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            No Client Experience Managers or Lecturers with a role assigned yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10">
                  <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Base Role</th>
                  <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assigned Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {staffOnly.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">{u.firstName} {u.lastName}<br /><span className="text-xs text-gray-400">{u.email}</span></td>
                    <td className="py-3 text-sm text-gray-500 dark:text-gray-400">{u.role === 'LECTURER' ? 'Lecturer' : 'Client Experience Manager'}</td>
                    <td className="py-3">
                      <select
                        value={u.customRoleId ?? ''}
                        onChange={(e) => void handleAssignRole(u, e.target.value)}
                        className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-gray-900 dark:text-white"
                      >
                        <option value="">— No role (no permissions) —</option>
                        {(roles ?? []).map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/edit role modal */}
      <Modal open={roleModal} onClose={() => setRoleModal(false)} title={editingRole ? 'Edit Role' : 'New Role'}>
        <div className="space-y-4">
          <Input
            label="Role Name"
            placeholder="e.g. Client Experience Manager"
            value={roleForm.name}
            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
          />
          <PermissionChecklist value={roleForm.permissions} onChange={(permissions) => setRoleForm({ ...roleForm, permissions })} />
          {roleError && <p className="text-sm text-red-600 dark:text-red-400">{roleError}</p>}
          <Button onClick={() => void submitRole()} disabled={creatingRole} className="w-full">
            {editingRole ? 'Save Role' : 'Create Role'}
          </Button>
        </div>
      </Modal>

      {/* Create user modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title="New User">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNABLE_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setUserForm({ ...userForm, role: r.value })}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
                    userForm.role === r.value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" icon={UserIcon} value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
            <Input label="Last Name" icon={UserIcon} value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
          </div>
          <Input label="Email" type="email" icon={Mail} value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          <Input label="Password" type="password" icon={Lock} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role (permissions)</label>
            <select
              value={userForm.customRoleId}
              onChange={(e) => setUserForm({ ...userForm, customRoleId: e.target.value })}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white"
            >
              <option value="">— No role (no permissions yet) —</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen size={14} /> Assigned Courses
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-gray-100 dark:border-white/5 p-2">
              {(courses ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.courseIds.includes(c.id)}
                    onChange={() =>
                      setUserForm({
                        ...userForm,
                        courseIds: userForm.courseIds.includes(c.id)
                          ? userForm.courseIds.filter((id) => id !== c.id)
                          : [...userForm.courseIds, c.id],
                      })
                    }
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{c.name} ({c.code})</span>
                </label>
              ))}
              {!courses?.length && <p className="text-xs text-gray-400 px-2 py-1">No courses yet.</p>}
            </div>
          </div>
          {userError && <p className="text-sm text-red-600 dark:text-red-400">{userError}</p>}
          <Button onClick={() => void submitUser()} disabled={creatingUser} className="w-full">Create User</Button>
        </div>
      </Modal>
    </div>
  );
}

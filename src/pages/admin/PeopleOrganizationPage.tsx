import { useState } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, UserPlus, Users, Mail, Lock, User as UserIcon,
  Cake, MapPin, ClipboardCheck, MessageSquare, Megaphone, Settings2, BookOpen, Sparkles, Star,
  BarChart3, PieChart, Folder, Ticket, CheckSquare, Square, Radio, FileText, Siren, Wrench,
  ScanEye, Smartphone, ShieldAlert, Search, UserX, Network,
} from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { CustomRole, Permission, Role, User, Course, OrgUnit, School } from '../../types';
import { ROLE_LABEL } from '../../lib/rbac';
import { OrgUnitsSection } from '../../components/org/OrgUnitsSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { LEVEL_LABEL, ORG_LEVEL_FOR_ROLE, SCOPE_FOR_ROLE, roleHasOrgUnit, roleRequiresOrgUnit } from '../../lib/hierarchyRoles';

/** The full catalog — grouped for the checklist UI. Mirrors server/prisma/schema.prisma's
 * Permission enum exactly, all 32 values across 7 groups. Every description says what the server
 * actually enforces today (see the backend's requireCapability routes).
 *
 * Two kinds of entry are flagged honestly instead of pretending to be a real boundary:
 *   - `navOnly`:   only decides whether a sidebar link shows for a lecturer on a role. The pages behind
 *                  them share endpoints with pages everyone can use, so they are not blocked on the server.
 *   - `reserved`:  no action uses it yet (kept so roles that already ticked it stay valid). */
type PermItem = { key: Permission; label: string; icon: React.ElementType; note?: 'navOnly' | 'reserved' };
const PERMISSION_GROUPS: { title: string; hint?: string; items: PermItem[] }[] = [
  {
    title: 'Sign-in access',
    items: [
      { key: 'MOBILE_ACCESS', label: 'Can sign in on the mobile app', icon: UserPlus },
      { key: 'DASHBOARD_ACCESS', label: 'Can sign in on the dashboard', icon: UserPlus },
    ],
  },
  {
    title: 'Administration',
    hint: 'Real limits: someone without the permission is refused, even if they can see the page.',
    items: [
      { key: 'MANAGE_USERS', label: 'Create lecturers, invigilators and students, approve or deactivate them, and see the user list', icon: Users },
      { key: 'MANAGE_SCHOOL_SETTINGS', label: "Change this school's attendance settings and feature switches (not its name or branding)", icon: Settings2 },
      { key: 'MANAGE_COURSES', label: 'Create, edit and delete courses and classes, enrol students and tag courses (leadership roles: only inside their own unit)', icon: BookOpen },
      { key: 'MANAGE_ANNOUNCEMENTS', label: 'Send school-wide announcements from the dashboard (school admins)', icon: Megaphone },
      { key: 'MANAGE_TICKETS', label: "Raise and reply to this school's support tickets", icon: Ticket },
    ],
  },
  {
    title: 'Students',
    items: [
      { key: 'VIEW_BIRTHDAYS', label: 'See student birthdays', icon: Cake },
      { key: 'VIEW_BLE_CHECKINS', label: 'See students who checked in automatically on site', icon: MapPin },
      { key: 'VIEW_MANUAL_CHECKINS', label: 'See students who were checked in manually', icon: ClipboardCheck },
      { key: 'MANUAL_CHECK_IN', label: 'Check a student in by hand (dashboard and mobile app)', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Communication',
    items: [
      { key: 'MESSAGING', label: 'Use messaging', icon: MessageSquare },
      { key: 'BROADCAST_STUDENTS_APPROVED', label: 'Send the "all students approved" message', icon: Megaphone },
      { key: 'BROADCAST_CLASS_SCHEDULE', label: 'Send the "class starting" message', icon: Megaphone },
    ],
  },
  {
    title: 'Onboarding journey',
    items: [
      { key: 'BROADCAST_PROGRAM_WELCOME', label: 'Send the "program welcome" message', icon: Sparkles },
      { key: 'BROADCAST_MATERIALS_READY', label: 'Send the "materials ready" message', icon: Sparkles },
      { key: 'BROADCAST_UPDATE', label: 'Send a free-form update to a course', icon: Megaphone },
      { key: 'REQUEST_FEEDBACK', label: 'Ask a student to fill in the feedback form', icon: Star },
      { key: 'MANAGE_MATERIALS', label: 'See and add course materials', icon: Folder },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { key: 'VIEW_ANALYTICS', label: 'See attendance analytics for their assigned courses', icon: BarChart3 },
      { key: 'VIEW_ANALYTICS_DEMOGRAPHICS', label: 'See gender and nationality breakdowns', icon: PieChart },
      { key: 'VIEW_FRAUD_DETECTION', label: "See fraud detection flags for the whole school (including flagged check-in photos)", icon: ShieldAlert },
    ],
  },
  {
    title: 'Operations',
    hint: 'Each "see" permission shows the queue; each "manage" permission lets the holder act on it. Lecturers without a role keep the access they have always had.',
    items: [
      { key: 'VIEW_LIVE_ATTENDANCE', label: 'Show Live Attendance in the menu', icon: Radio, note: 'navOnly' },
      { key: 'VIEW_REPORTS', label: 'Show Reports in the menu', icon: FileText, note: 'navOnly' },
      { key: 'VIEW_ESCALATIONS', label: 'See the escalation queue (students who flagged a problem during a class)', icon: Siren },
      { key: 'MANAGE_ESCALATIONS', label: 'Resolve escalations, request a fresh baseline photo, reset a biometric lock', icon: Siren },
      { key: 'VIEW_FACILITIES', label: 'See the facilities queue (room and equipment issues)', icon: Wrench },
      { key: 'MANAGE_FACILITY_TICKETS', label: 'Reply to, acknowledge, resolve or escalate facility tickets', icon: Wrench },
      { key: 'VIEW_INVIGILATION', label: 'See the exam-card and gate-attempt lists', icon: ScanEye },
      { key: 'MANAGE_INVIGILATION', label: 'Reserved for a future update — has no effect yet', icon: ScanEye, note: 'reserved' },
      { key: 'VIEW_DEVICE_VERIFICATION', label: 'See pending and approved student devices', icon: Smartphone },
      { key: 'MANAGE_DEVICE_VERIFICATION', label: 'Approve or reset a student device, reset a biometric lock', icon: Smartphone },
    ],
  },
];

const ALL_PERMISSION_KEYS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** Account types a school admin can create and switch staff between (mirrors the server's SWITCHABLE_ROLES). */
const ASSIGNABLE_ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: 'LECTURER', label: 'Lecturer', blurb: 'Teaches courses, takes attendance' },
  { value: 'CLIENT_EXPERIENCE_MANAGER', label: 'Client Experience Manager', blurb: 'Front-of-house — no assigned courses' },
  { value: 'INVIGILATOR', label: 'Invigilator', blurb: 'Scans exam cards' },
  { value: 'VC', label: 'Vice Chancellor', blurb: 'Leads the whole school' },
  { value: 'DVC', label: 'Deputy Vice Chancellor', blurb: 'Leads a division' },
  { value: 'DEAN', label: 'Dean', blurb: 'Leads a faculty' },
  { value: 'HOD', label: 'Head of Department', blurb: 'Leads a department' },
  { value: 'REGISTRAR_ACADEMIC', label: 'Registrar (Academic)', blurb: 'Student records' },
  { value: 'REGISTRAR_ADMIN', label: 'Registrar (Administration)', blurb: 'Staff and admin records' },
  { value: 'ICT_ADMIN', label: 'ICT Admin', blurb: 'Devices and infrastructure' },
];
/** A Deputy HOD can be created here but not switched to/from (the server's account-type switch excludes it). */
const CREATABLE_ROLES = [...ASSIGNABLE_ROLES, { value: 'DEPUTY_HOD' as Role, label: 'Deputy HOD', blurb: 'Supports a head of department' }];
const STAFF_TABLE_ROLE_VALUES = CREATABLE_ROLES.map((r) => r.value);
/** Account types that can hold a custom role / permissions (everything else is decided by the account type alone). */
const CAN_HOLD_ROLE: Role[] = ['LECTURER', 'CLIENT_EXPERIENCE_MANAGER', 'VC', 'DVC', 'DEAN', 'HOD'];
/** The Roles card (custom role bundles) is hidden for now — flip this back on to show it again. */
const SHOW_ROLES_CARD = false;

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
            {group.hint && <p className="text-xs text-gray-400 mb-2">{group.hint}</p>}
            <div className="space-y-1.5">
              {group.items.map(({ key, label, icon: Icon, note }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} className="w-4 h-4 rounded accent-blue-500" />
                  <Icon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                  {note && (
                    <span
                      title={note === 'navOnly' ? 'Only shows or hides the menu link. The page behind it is not blocked on the server.' : 'No action uses this permission yet.'}
                      className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                    >
                      {note === 'navOnly' ? 'Navigation only' : 'Not used yet'}
                    </span>
                  )}
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
// `role` (account type) and `customRoleId` (permission bundle) are two independent, always-visible
// fields now — no more inferring one from the other. Simpler and matches how every other part of
// this page already treats them: a role is just a bundle of permissions, usable by either account type.
const emptyUserForm = { firstName: '', lastName: '', email: '', password: '', role: '' as Role | '', customRoleId: '', orgUnitId: '', courseIds: [] as string[] };

const LEADERSHIP_ROLES: Role[] = ['VC', 'DVC', 'DEAN', 'HOD', 'DEPUTY_HOD'];

const ACCOUNT_TYPE_META: Partial<Record<Role, { label: string; blurb: string }>> = {
  CLIENT_EXPERIENCE_MANAGER: { label: 'Client Experience Manager', blurb: 'Front-of-house — no assigned courses' },
  LECTURER: { label: 'Lecturer', blurb: 'Teaches courses, takes attendance' },
  INVIGILATOR: { label: 'Invigilator', blurb: 'Scans exam cards' },
};

export function PeopleOrganizationPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  // SUPER_ADMIN works on one school at a time (the org tree is per school); everyone else is pinned to theirs.
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const schoolId = isSuperAdmin ? selectedSchoolId || undefined : user?.schoolId;

  const { data: roles, refetch: refetchRoles } = useApi<CustomRole[]>('/roles');
  const { data: staffUsers, refetch: refetchUsers } = useApi<User[]>(
    schoolId ? `/users?schoolId=${schoolId}` : '/users',
  );
  const { data: courses } = useApi<Course[]>('/courses');
  const { data: orgUnits, refetch: refetchUnits } = useApi<OrgUnit[]>(schoolId ? `/org-units?schoolId=${schoolId}` : null);

  const { mutate: createRole, loading: creatingRole } = useMutation<CustomRole>('post');
  const { mutate: updateRole } = useMutation<CustomRole>('patch');
  const { mutate: deleteRole } = useMutation('delete');
  const { mutate: createUser, loading: creatingUser } = useMutation<User>('post');
  const { mutate: assignRole } = useMutation<User>('patch');
  const { mutate: deleteUser } = useMutation('delete');
  const { mutate: assignUnit } = useMutation('patch');
  const { mutate: toggleActing } = useMutation('patch');

  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [roleError, setRoleError] = useState('');
  // Roles are open-ended and school-defined — a search box is what actually keeps this usable once
  // a school has dozens of them, rather than a wall of cards.
  const [roleSearch, setRoleSearch] = useState('');
  const filteredRoles = (roles ?? []).filter((r) => r.name.toLowerCase().includes(roleSearch.trim().toLowerCase()));

  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userError, setUserError] = useState('');
  // Switching a staff member's account type (Lecturer <-> CEM <-> Invigilator <-> leadership ...).
  const [switchError, setSwitchError] = useState('');
  const [switchTarget, setSwitchTarget] = useState<{ user: User; role: Role } | null>(null);
  const [switchUnitId, setSwitchUnitId] = useState('');

  // Lecturers, Client Experience Managers and the four leadership roles that can hold MANAGE_COURSES.
  const staffOnly = (staffUsers ?? []).filter((u) => STAFF_TABLE_ROLE_VALUES.includes(u.role));

  // Filter bar above the Staff table — account type as pills (small, fixed set), custom role as a
  // dropdown (open-ended, school-defined names).
  const [accountTypeFilter, setAccountTypeFilter] = useState<'ALL' | Role | 'LEADERSHIP' | 'RECORDS_ICT'>('ALL');
  const [customRoleFilter, setCustomRoleFilter] = useState<'ALL' | 'NONE' | string>('ALL');
  const filteredStaff = staffOnly.filter((u) => {
    if (accountTypeFilter === 'LEADERSHIP') { if (!LEADERSHIP_ROLES.includes(u.role)) return false; }
    else if (accountTypeFilter === 'RECORDS_ICT') { if (!['REGISTRAR_ACADEMIC', 'REGISTRAR_ADMIN', 'ICT_ADMIN'].includes(u.role)) return false; }
    else if (accountTypeFilter !== 'ALL' && u.role !== accountTypeFilter) return false;
    if (customRoleFilter === 'NONE' && u.customRoleId) return false;
    if (customRoleFilter !== 'ALL' && customRoleFilter !== 'NONE' && u.customRoleId !== customRoleFilter) return false;
    return true;
  });

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
    if (!userForm.role) {
      setUserError('Pick an account type.');
      return;
    }
    if (roleRequiresOrgUnit(userForm.role) && !userForm.orgUnitId) {
      setUserError('Pick the organisation unit this account belongs to.');
      return;
    }
    const base = { firstName: userForm.firstName, lastName: userForm.lastName, email: userForm.email, password: userForm.password, schoolId };
    try {
      if (userForm.role === 'LECTURER' || userForm.role === 'CLIENT_EXPERIENCE_MANAGER') {
        await createUser(userForm.role === 'LECTURER' ? '/users/lecturer' : '/users/client-experience-manager', {
          ...base,
          customRoleId: userForm.customRoleId || undefined,
          courseIds: userForm.courseIds,
        });
      } else if (userForm.role === 'INVIGILATOR') {
        await createUser('/users/invigilator', base);
      } else {
        await createUser('/users/hierarchy', {
          ...base,
          role: userForm.role,
          scopeLevel: SCOPE_FOR_ROLE[userForm.role],
          orgUnitId: roleHasOrgUnit(userForm.role) ? userForm.orgUnitId || undefined : undefined,
          customRoleId: CAN_HOLD_ROLE.includes(userForm.role) ? userForm.customRoleId || undefined : undefined,
        });
      }
      setUserModal(false);
      refetchUsers();
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  // Switch a staff member to another account type. DVC / Dean / HOD need an organisation unit, so those
  // open a small picker first; everything else asks for confirmation and applies straight away.
  const requestSwitch = (target: User, role: Role) => {
    if (role === target.role) return;
    setSwitchError('');
    if (roleRequiresOrgUnit(role)) {
      setSwitchUnitId('');
      setSwitchTarget({ user: target, role });
      return;
    }
    const label = ASSIGNABLE_ROLES.find((r) => r.value === role)?.label ?? role;
    if (!confirm(`Switch ${target.firstName} ${target.lastName} to ${label}?\n\nTheir custom role and permissions are cleared (unless you are switching between Lecturer and Client Experience Manager), and they will need to sign in again.`)) return;
    void applySwitch(target, role, null);
  };
  const applySwitch = async (target: User, role: Role, orgUnitId: string | null) => {
    try {
      await assignRole(`/users/${target.id}/account-type`, { role, ...(orgUnitId ? { orgUnitId } : {}) } as never);
      setSwitchTarget(null);
      refetchUsers();
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : 'Could not switch the account type');
      refetchUsers();
    }
  };

  const handleAssignRole = async (targetUser: User, customRoleId: string) => {
    await assignRole(`/users/${targetUser.id}/role`, { customRoleId: customRoleId || null });
    refetchUsers();
  };

  // Re-place a unit-bound account (DVC / Dean / HOD / Deputy HOD) into another org unit.
  const handleReassign = async (target: User, orgUnitId: string) => {
    await assignUnit(`/org-units/users/${target.id}/assign`, { orgUnitId: orgUnitId || null, scopeLevel: SCOPE_FOR_ROLE[target.role] });
    refetchUsers();
    refetchUnits();
  };
  const handleToggleActing = async (target: User) => {
    await toggleActing(`/org-units/users/${target.id}/acting-hod`, { isActingHod: !target.isActingHod });
    refetchUsers();
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (!confirm(`Delete ${targetUser.firstName} ${targetUser.lastName}? This permanently removes their account, attendance records and enrollments. This can't be undone.`)) return;
    await deleteUser(`/users/${targetUser.id}`);
    refetchUsers();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck size={24} className="text-blue-500" /> People &amp; Organization
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your org structure (divisions, faculties, departments) and everyone who works in it — Lecturers, CEMs, Invigilators, VC, DVC, Dean, HOD,
          Deputy HOD, Registrars and ICT Admin. Create an account, place it in a unit, or switch a person to a different account type.
        </p>
        {isSuperAdmin && (
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            className="mt-3 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white cursor-pointer min-w-[220px]"
          >
            <option value="">Select a school…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {isSuperAdmin && !schoolId ? (
        <EmptyState icon={Network} title="Select a school" description="Choose a school above to manage its people and org structure." />
      ) : (
      <>
      {schoolId && <OrgUnitsSection schoolId={schoolId} units={orgUnits ?? []} onChanged={() => { refetchUnits(); refetchUsers(); }} />}

      {/* Roles — hidden for now (SHOW_ROLES_CARD) */}
      {SHOW_ROLES_CARD && (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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
          <>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search roles…"
                className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            {!filteredRoles.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No roles match &quot;{roleSearch}&quot;.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5">
                {filteredRoles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{role.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} &middot; {role._count?.users ?? 0} user{role._count?.users === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditRole(role)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-500 cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => void handleDeleteRole(role)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-red-500 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      )}

      {/* Users */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={18} /> Staff Users
          </h2>
          <Button onClick={openCreateUser} size="sm"><UserPlus size={16} className="mr-1.5" /> New User</Button>
        </div>
        {!staffOnly.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            No staff accounts yet — use New User to add a Lecturer, Client Experience Manager, or any leadership account.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['ALL', 'LECTURER', 'CLIENT_EXPERIENCE_MANAGER', 'INVIGILATOR', 'LEADERSHIP', 'RECORDS_ICT'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAccountTypeFilter(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                    accountTypeFilter === opt
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
                  }`}
                >
                  {opt === 'ALL' ? 'All types' : opt === 'LEADERSHIP' ? 'VC / DVC / Dean / HOD' : opt === 'RECORDS_ICT' ? 'Registrar / ICT' : ACCOUNT_TYPE_META[opt]?.label}
                </button>
              ))}
              <select
                value={customRoleFilter}
                onChange={(e) => setCustomRoleFilter(e.target.value)}
                className="text-xs font-medium rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-gray-600 dark:text-gray-300"
              >
                <option value="ALL">Any custom role</option>
                <option value="NONE">No custom role</option>
                {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <span className="text-xs text-gray-400 ml-auto">{filteredStaff.length} of {staffOnly.length}</span>
            </div>

            {!filteredStaff.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No staff match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                {switchError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{switchError}</p>}
                <p className="text-xs text-gray-400 mb-2">
                  VC, DVC, Dean and HOD accounts can hold <strong>Manage courses</strong> only — it lets them manage the courses inside their own
                  organisation unit (set in the Org Unit column). Other permissions have no effect for them.
                </p>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/10">
                      <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account Type</th>
                      <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Org Unit</th>
                      <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Custom Role</th>
                      <th className="py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {filteredStaff.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 text-sm text-gray-900 dark:text-white">{u.firstName} {u.lastName}<br /><span className="text-xs text-gray-400">{u.email}</span></td>
                        <td className="py-3">
                          {u.role === 'DEPUTY_HOD' ? (
                            <span className="inline-flex items-center gap-1">
                              <Badge color="blue">{ROLE_LABEL[u.role]}</Badge>
                              {u.isActingHod && <Badge color="green">Acting HOD</Badge>}
                            </span>
                          ) : (
                          <select
                            value={u.role}
                            onChange={(e) => requestSwitch(u, e.target.value as Role)}
                            aria-label={`Account type for ${u.firstName} ${u.lastName}`}
                            className={`text-xs font-semibold rounded-full border px-2.5 py-1.5 cursor-pointer ${
                              u.role === 'LECTURER'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                : LEADERSHIP_ROLES.includes(u.role)
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                  : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20'
                            }`}
                          >
                            {ASSIGNABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          )}
                        </td>
                        <td className="py-3">
                          {roleHasOrgUnit(u.role) ? (
                            <select
                              value={u.orgUnitId ?? ''}
                              onChange={(e) => void handleReassign(u, e.target.value)}
                              aria-label={`Org unit for ${u.firstName} ${u.lastName}`}
                              className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5 text-gray-900 dark:text-white cursor-pointer"
                            >
                              <option value="">— unassigned —</option>
                              {(orgUnits ?? []).filter((ou) => ou.level === ORG_LEVEL_FOR_ROLE[u.role]).map((ou) => (
                                <option key={ou.id} value={ou.id}>{ou.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-400">{['LECTURER', 'CLIENT_EXPERIENCE_MANAGER', 'INVIGILATOR'].includes(u.role) ? '—' : 'Whole school'}</span>
                          )}
                        </td>
                        <td className="py-3">
                          {!CAN_HOLD_ROLE.includes(u.role) ? <span className="text-xs text-gray-400">—</span> : <select
                            value={u.customRoleId ?? ''}
                            onChange={(e) => void handleAssignRole(u, e.target.value)}
                            className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-gray-900 dark:text-white"
                          >
                            <option value="">— No role (no permissions) —</option>
                            {(roles ?? []).map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>}
                        </td>
                        <td className="py-3 text-right">
                          {u.role === 'DEPUTY_HOD' && (
                            <button
                              onClick={() => void handleToggleActing(u)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              <ShieldCheck size={12} /> {u.isActingHod ? 'Revoke Acting HOD' : 'Grant Acting HOD'}
                            </button>
                          )}
                          {['LECTURER', 'CLIENT_EXPERIENCE_MANAGER', 'INVIGILATOR'].includes(u.role) && <button
                            onClick={() => void handleDeleteUser(u)}
                            title="Delete staff member"
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 cursor-pointer inline-flex"
                          >
                            <UserX size={16} />
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      </>
      )}

      {/* Switch to DVC / Dean / HOD: which organisation unit? */}
      <Modal open={!!switchTarget} onClose={() => setSwitchTarget(null)} title="Choose organisation unit">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {switchTarget && <>Switching <strong>{switchTarget.user.firstName} {switchTarget.user.lastName}</strong> to <strong>{ROLE_LABEL[switchTarget.role]}</strong>. Their custom role and permissions are cleared, and they will need to sign in again.</>}
          </p>
          <select
            value={switchUnitId}
            onChange={(e) => setSwitchUnitId(e.target.value)}
            className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white"
          >
            <option value="">— Select a unit —</option>
            {(orgUnits ?? []).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.level.toLowerCase().replace('_', ' ')})</option>)}
          </select>
          {!orgUnits?.length && <p className="text-xs text-gray-400">No organisation units yet — add them in the Organization section first.</p>}
          {switchError && <p className="text-sm text-red-600 dark:text-red-400">{switchError}</p>}
          <Button onClick={() => switchTarget && void applySwitch(switchTarget.user, switchTarget.role, switchUnitId)} disabled={!switchUnitId} className="w-full">
            Switch account type
          </Button>
        </div>
      </Modal>

      {/* Create/edit role modal */}
      <Modal open={roleModal} onClose={() => setRoleModal(false)} title={editingRole ? 'Edit Role' : 'New Role'}>
        <div className="space-y-4">
          <Input
            label="Role Name"
            placeholder="e.g. Front Desk Lead"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Account Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CREATABLE_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setUserForm({ ...userForm, role: r.value })}
                  className={`px-3 py-2.5 rounded-xl text-left border cursor-pointer transition-colors ${
                    userForm.role === r.value
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'
                  }`}
                >
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className={`block text-xs mt-0.5 ${userForm.role === r.value ? 'text-blue-100' : 'text-gray-400'}`}>
                    {r.blurb}
                  </span>
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
          {userForm.role && roleHasOrgUnit(userForm.role) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {LEVEL_LABEL[ORG_LEVEL_FOR_ROLE[userForm.role]!]}{roleRequiresOrgUnit(userForm.role) ? '' : ' (optional)'}
              </label>
              <select
                value={userForm.orgUnitId}
                onChange={(e) => setUserForm({ ...userForm, orgUnitId: e.target.value })}
                className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white"
              >
                <option value="">— Select a unit —</option>
                {(orgUnits ?? []).filter((o) => o.level === ORG_LEVEL_FOR_ROLE[userForm.role as Role]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {!orgUnits?.some((o) => o.level === ORG_LEVEL_FOR_ROLE[userForm.role as Role]) && <p className="text-xs text-gray-400 mt-1.5">No {LEVEL_LABEL[ORG_LEVEL_FOR_ROLE[userForm.role as Role]!].toLowerCase()} units yet — add one in the Organization section above first.</p>}
            </div>
          )}
          {(!userForm.role || CAN_HOLD_ROLE.includes(userForm.role)) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Custom Role (optional)</label>
            {roles?.length ? (
              <select
                value={userForm.customRoleId}
                onChange={(e) => setUserForm({ ...userForm, customRoleId: e.target.value })}
                className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white"
              >
                <option value="">— No custom role (no extra permissions yet) —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                <span>No custom roles yet.</span>
                {SHOW_ROLES_CARD && (
                  <button type="button" onClick={() => { setUserModal(false); openCreateRole(); }} className="text-blue-500 font-medium hover:underline shrink-0 cursor-pointer">
                    Create one
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">Grants extra dashboard/mobile permissions on top of the account type above.</p>
          </div>
          )}
          {(!userForm.role || userForm.role === 'LECTURER' || userForm.role === 'CLIENT_EXPERIENCE_MANAGER') && (
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
          )}
          {userError && <p className="text-sm text-red-600 dark:text-red-400">{userError}</p>}
          <Button onClick={() => void submitUser()} disabled={creatingUser || !userForm.role} className="w-full">Create User</Button>
        </div>
      </Modal>
    </div>
  );
}

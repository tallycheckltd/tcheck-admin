import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Users, Mail, School, Search, Plus, ShieldCheck, Globe2 } from 'lucide-react';
import { UserDirectoryTabs } from '../../components/admin/UserDirectoryTabs';
import type { User, School as SchoolType } from '../../types';

type AdminKind = 'SCHOOL_ADMIN' | 'SUB_ADMIN';

const emptyForm = { firstName: '', lastName: '', email: '', password: '', schoolId: '', kind: 'SCHOOL_ADMIN' as AdminKind };

export function SchoolAdminsPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  // Two admin tiers live on one page: the modern per-school SCHOOL_ADMIN (full granular
  // permission system, scoped to exactly one school) and the legacy university-wide SUB_ADMIN
  // (IT Director/HOD tier, can be unaffiliated, no permission system). Both are fetched and
  // merged so creating either kind actually shows up in this same list.
  const { data: schoolAdmins, loading: loadingSchoolAdmins, refetch: refetchSchoolAdmins } = useApi<User[]>('/users?role=SCHOOL_ADMIN');
  const { data: subAdmins, loading: loadingSubAdmins, refetch: refetchSubAdmins } = useApi<User[]>('/users?role=SUB_ADMIN');
  const { data: schools } = useApi<SchoolType[]>(isSuperAdmin ? '/schools' : null);
  const { mutate: createSchoolAdmin, error: createSchoolAdminError } = useMutation<User>('post');
  const { mutate: createSubAdmin, error: createSubAdminError } = useMutation<User>('post');
  const [search, setSearch] = useState('');
  const [schoolFilterId, setSchoolFilterId] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loading = loadingSchoolAdmins || loadingSubAdmins;
  const createError = createSchoolAdminError || createSubAdminError;
  const admins = [...(schoolAdmins || []), ...(subAdmins || [])];

  // SUPER_ADMIN sees every school's admins on one list by design (platform-wide oversight) — each
  // row is already correctly labeled with its own "University" column, but an unfiltered list of
  // several schools' admins side by side reads as confusing ("why am I seeing another school's
  // admin here?") without an explicit way to narrow it to one school at a time.
  const filtered = admins.filter((a) => {
    if (schoolFilterId && a.schoolId !== schoolFilterId) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.school?.name || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    if (form.kind === 'SCHOOL_ADMIN') {
      await createSchoolAdmin('/users/school-admin', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        schoolId: form.schoolId,
      });
    } else {
      // A SUB_ADMIN's own school always overrides whatever is sent here — enforced server-side too.
      await createSubAdmin('/users/admin', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        schoolId: isSuperAdmin ? (form.schoolId || undefined) : undefined,
      });
    }
    setModal(false);
    setForm(emptyForm);
    refetchSchoolAdmins();
    refetchSubAdmins();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">School Admins</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Direct clients — University IT Directors and HODs only. Student records are never shown here.
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setModal(true); }}><Plus size={16} className="mr-1" /> New Admin</Button>
      </div>

      <UserDirectoryTabs />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        {isSuperAdmin && (
          <select
            value={schoolFilterId}
            onChange={(e) => setSchoolFilterId(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
          >
            <option value="">All Schools</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {filtered.length} admin{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>University</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {filtered.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {admin.firstName?.[0]}{admin.lastName?.[0]}
                      </div>
                      <span className="font-medium text-slate-950 dark:text-white">
                        {admin.firstName} {admin.lastName}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Mail size={12} className="text-slate-600 dark:text-slate-400" />
                      {admin.email}
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-xs">
                      <School size={12} className="text-slate-600 dark:text-slate-400" />
                      {admin.school?.name || <span className="text-slate-600 dark:text-slate-400">—</span>}
                    </span>
                  </td>
                  <td>
                    <Badge color={admin.status === 'APPROVED' ? 'green' : admin.status === 'PENDING' ? 'yellow' : 'red'}>
                      {admin.status}
                    </Badge>
                  </td>
                  <td className="text-xs text-slate-600 dark:text-slate-400">
                    {new Date(admin.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <Users size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">No school admins found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create Admin">
        <div className="space-y-4">
          {/* Role choice up front — this used to only ever create a legacy SUB_ADMIN with no way
              to pick anything else. SCHOOL_ADMIN is the modern, per-school tier with the full
              granular permission system (see Roles & Permissions); SUB_ADMIN is the older
              university-wide IT Director/HOD tier that can span or sit outside any single school. */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Admin Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: 'SCHOOL_ADMIN' })}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                  form.kind === 'SCHOOL_ADMIN'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                <ShieldCheck size={18} className={form.kind === 'SCHOOL_ADMIN' ? 'text-blue-500' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">School Admin</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">One school, full permissions</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: 'SUB_ADMIN' })}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                  form.kind === 'SUB_ADMIN'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
              >
                <Globe2 size={18} className={form.kind === 'SUB_ADMIN' ? 'text-blue-500' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Sub Admin</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">University-wide, no permission set</span>
              </button>
            </div>
          </div>
          <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {(isSuperAdmin || form.kind === 'SCHOOL_ADMIN') && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                School{form.kind === 'SCHOOL_ADMIN' && <span className="text-red-500"> *</span>}
              </label>
              <select
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                {form.kind === 'SUB_ADMIN' && <option value="">Unaffiliated / platform-wide</option>}
                {form.kind === 'SCHOOL_ADMIN' && !form.schoolId && <option value="">Select a school…</option>}
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {form.kind === 'SCHOOL_ADMIN' && (!schools || schools.length === 0) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">No schools exist yet — create one first under Schools.</p>
              )}
            </div>
          )}
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <Button
            onClick={handleCreate}
            disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim() || (form.kind === 'SCHOOL_ADMIN' && !form.schoolId)}
            className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create {form.kind === 'SCHOOL_ADMIN' ? 'School Admin' : 'Sub Admin'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

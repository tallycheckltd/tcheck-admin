import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Users, Mail, School, Search, Plus } from 'lucide-react';
import { UserDirectoryTabs } from '../../components/admin/UserDirectoryTabs';
import { InviteSentNotice, InviteStateBadge, type InviteInfo, type InviteState } from '../../components/admin/InviteSent';
import type { User, School as SchoolType } from '../../types';

const emptyForm = { firstName: '', lastName: '', email: '', schoolId: '' };

export function SchoolAdminsPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  // P3 (A2.4): one admin tier. The School Admin created with the institution is its primary admin;
  // any other is an additional School Admin (the retired School Admin's replacement).
  const { data: schoolAdmins, loading, refetch: refetchSchoolAdmins } = useApi<User[]>('/users?role=SCHOOL_ADMIN');
  const { data: schools } = useApi<SchoolType[]>(isSuperAdmin ? '/schools' : null);
  const { mutate: createAdmin, error: createError } = useMutation<User>('post');
  const [search, setSearch] = useState('');
  const [schoolFilterId, setSchoolFilterId] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sent, setSent] = useState<{ email: string; invite?: InviteInfo } | null>(null);

  const admins = schoolAdmins || [];

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
    // A Super Admin names the school (the first admin there becomes its primary); a School Admin
    // adds another School Admin to their own school — the server forces the school either way.
    const r = await createAdmin(isSuperAdmin ? '/users/school-admin' : '/users/admin', {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      ...(isSuperAdmin ? { schoolId: form.schoolId } : {}),
    });
    if (r) setSent({ email: form.email, invite: (r as User & { invite?: InviteInfo }).invite });
    setModal(false);
    setForm(emptyForm);
    refetchSchoolAdmins();
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

      {sent && <InviteSentNotice email={sent.email} invite={sent.invite} />}

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
            <option value="">All Institutions</option>
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
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Badge color={admin.status === 'APPROVED' ? 'green' : admin.status === 'PENDING' ? 'yellow' : 'red'}>
                        {admin.status}
                      </Badge>
                      {(admin as User & { isPrimaryAdmin?: boolean }).isPrimaryAdmin && <Badge color="blue">Primary</Badge>}
                      <InviteStateBadge userId={admin.id} invite={(admin as User & { invite?: InviteState }).invite} />
                    </span>
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
          <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <p className="text-xs text-gray-500 dark:text-gray-400">No password here — they'll receive a "Set your password" invite by email.</p>
          {isSuperAdmin && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Institution<span className="text-red-500"> *</span>
              </label>
              <select
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                {!form.schoolId && <option value="">Select an institution…</option>}
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {(!schools || schools.length === 0) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">No institutions exist yet — create one first under Schools.</p>
              )}
            </div>
          )}
          {createError && <p className="text-sm text-red-500">{createError}</p>}
          <Button
            onClick={handleCreate}
            disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || (isSuperAdmin && !form.schoolId)}
            className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create School Admin and send invite
          </Button>
        </div>
      </Modal>
    </div>
  );
}

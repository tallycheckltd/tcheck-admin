import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { Plus, CheckCircle, XCircle, Eye, UserPlus, Trash2, ShieldPlus } from 'lucide-react';
import { clsx } from 'clsx';
import type { User, School } from '../../types';

const statusColor = { PENDING: 'yellow' as const, APPROVED: 'green' as const, REJECTED: 'red' as const };

type CreateType = 'lecturer' | 'student' | 'admin';

export function UsersPage() {
  const { data: users, refetch } = useApi<User[]>('/users');
  const { data: schools } = useApi<School[]>('/schools');
  const { mutate: patch } = useMutation('patch');
  const { mutate: create } = useMutation('post');
  const { mutate: del } = useMutation('delete');
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [filter, setFilter] = useState<'all' | 'PENDING' | 'STUDENT' | 'LECTURER'>('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [createType, setCreateType] = useState<CreateType>('lecturer');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', schoolId: '', studentId: '' });

  const filtered = users?.filter((u) => {
    if (filter === 'PENDING') return u.status === 'PENDING';
    if (filter === 'STUDENT') return u.role === 'STUDENT';
    if (filter === 'LECTURER') return u.role === 'LECTURER';
    return true;
  }).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.studentId?.toLowerCase().includes(q))
    );
  });

  const approve = async (id: string) => { await patch(`/users/${id}/status`, { status: 'APPROVED' }); refetch(); };
  const reject = async (id: string) => { await patch(`/users/${id}/status`, { status: 'REJECTED' }); refetch(); };
  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    await del(`/users/${id}`);
    refetch();
  };

  const handleCreate = async () => {
    if (createType === 'admin') {
      await create('/users/admin', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      });
    } else if (createType === 'lecturer') {
      await create('/users/lecturer', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        schoolId: form.schoolId,
      });
    } else {
      await create('/users/student', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        studentId: form.studentId,
        schoolId: form.schoolId,
      });
    }
    setModal(false);
    setForm({ email: '', password: '', firstName: '', lastName: '', schoolId: '', studentId: '' });
    refetch();
  };

  const openCreateModal = (type: CreateType) => {
    setCreateType(type);
    setForm({ email: '', password: '', firstName: '', lastName: '', schoolId: '', studentId: '' });
    setModal(true);
  };

  const pendingCount = users?.filter((u) => u.status === 'PENDING').length || 0;

  const canDelete = (u: User) => isSuperAdmin && u.role !== 'SUPER_ADMIN' && u.role !== 'SUB_ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{users?.length || 0} total users</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button variant="secondary" onClick={() => openCreateModal('admin')}>
              <ShieldPlus size={16} className="mr-1" /> Add Admin
            </Button>
          )}
          <Button variant="secondary" onClick={() => openCreateModal('student')}>
            <UserPlus size={16} className="mr-1" /> Add Student
          </Button>
          <Button onClick={() => openCreateModal('lecturer')}>
            <Plus size={16} className="mr-1" /> Add Lecturer
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/10 backdrop-blur-md">
        <div className="flex-1 min-w-[300px]">
          <SearchInput
            placeholder="Search by name, email, or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!py-3 shadow-sm"
          />
        </div>
        <div className="flex p-1 bg-gray-100/50 dark:bg-white/5 rounded-xl gap-1">
          {(['all', 'PENDING', 'STUDENT', 'LECTURER'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                filter === f
                  ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {f === 'all' ? 'All Users' : f.charAt(0) + f.slice(1).toLowerCase()}
              {f === 'PENDING' && pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-white/10">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User Profile</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filtered?.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-slate-500 dark:text-gray-400 font-bold text-xs ring-2 ring-white dark:ring-slate-800">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{u.firstName} {u.lastName}</div>
                        <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter mt-0.5">{u.role.replace('_', ' ')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-300">{u.email}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{u.studentId || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">{u.school?.name || 'Unassigned'}</div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mt-0.5">{u.school?.code || 'NO_SCHOOL'}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge color={statusColor[u.status]}>{u.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => navigate(`/admin/users/${u.id}`)} className="p-2 rounded-xl hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-blue-500 transition-all shadow-sm border border-transparent hover:border-blue-100 dark:hover:border-white/10" title="View Details">
                        <Eye size={18} />
                      </button>
                      {u.status === 'PENDING' && (
                        <>
                          <button onClick={() => approve(u.id)} className="p-2 rounded-xl hover:bg-green-50 dark:hover:bg-green-500/10 text-green-500 transition-all border border-transparent hover:border-green-100 dark:hover:border-white/10" title="Approve">
                            <CheckCircle size={18} />
                          </button>
                          <button onClick={() => reject(u.id)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-all border border-transparent hover:border-red-100 dark:hover:border-white/10" title="Reject">
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      {canDelete(u) && (
                        <button onClick={() => deleteUser(u.id)} className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-400 transition-all border border-transparent hover:border-red-100 dark:hover:border-white/10" title="Delete">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered?.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="text-gray-300" size={32} />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No users found matching your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={createType === 'admin' ? 'Create Admin' : createType === 'lecturer' ? 'Create Lecturer' : 'Create Student'}>
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            {isSuperAdmin && (
              <Button variant={createType === 'admin' ? 'primary' : 'secondary'} size="sm" onClick={() => setCreateType('admin')}>Admin</Button>
            )}
            <Button variant={createType === 'lecturer' ? 'primary' : 'secondary'} size="sm" onClick={() => setCreateType('lecturer')}>Lecturer</Button>
            <Button variant={createType === 'student' ? 'primary' : 'secondary'} size="sm" onClick={() => setCreateType('student')}>Student</Button>
          </div>
          <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {createType === 'student' && (
            <Input label="Student ID" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
          )}
          {createType !== 'admin' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
              <select
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                <option value="">Select school</option>
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <Button onClick={handleCreate} className="w-full">
            Create {createType === 'admin' ? 'Admin' : createType === 'lecturer' ? 'Lecturer' : 'Student'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

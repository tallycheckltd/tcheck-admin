import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Plus, CheckCircle, XCircle, Eye, Search, UserPlus, Trash2, ShieldPlus } from 'lucide-react';
import type { User, School } from '../../types';

const statusColor = { PENDING: 'yellow' as const, APPROVED: 'green' as const, REJECTED: 'red' as const };
const roleColor = { SUPER_ADMIN: 'purple' as const, SUB_ADMIN: 'blue' as const, LECTURER: 'blue' as const, STUDENT: 'gray' as const };

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'PENDING', 'STUDENT', 'LECTURER'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              {f === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Student ID</th>
              <th>Role</th>
              <th>School</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {filtered?.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.studentId || '-'}</td>
                <td><Badge color={roleColor[u.role]}>{u.role.replace('_', ' ')}</Badge></td>
                <td>{u.school?.name || '-'}</td>
                <td><Badge color={statusColor[u.status]}>{u.status}</Badge></td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => navigate(`/admin/users/${u.id}`)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer" title="View Details">
                      <Eye size={15} className="text-gray-500" />
                    </button>
                    {u.status === 'PENDING' && (
                      <>
                        <button onClick={() => approve(u.id)} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors cursor-pointer" title="Approve">
                          <CheckCircle size={15} className="text-green-500" />
                        </button>
                        <button onClick={() => reject(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" title="Reject">
                          <XCircle size={15} className="text-red-500" />
                        </button>
                      </>
                    )}
                    {canDelete(u) && (
                      <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete">
                        <Trash2 size={15} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered?.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
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

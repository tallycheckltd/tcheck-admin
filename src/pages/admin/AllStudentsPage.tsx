import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Search, CheckCircle, XCircle, Trash2, GraduationCap } from 'lucide-react';
import type { User } from '../../types';

const statusColor = { PENDING: 'yellow' as const, APPROVED: 'green' as const, REJECTED: 'red' as const, DEACTIVATED: 'gray' as const, DELETED: 'gray' as const };

export function AllStudentsPage() {
  const navigate = useNavigate();
  const { data: users, refetch } = useApi<User[]>('/users?role=STUDENT');
  const { mutate: patch } = useMutation('patch');
  const { mutate: del } = useMutation('delete');

  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [search, setSearch] = useState('');

  const filtered = users?.filter((u) => {
    if (filter === 'all') return u.status !== 'DELETED';
    return u.status === filter;
  }).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.studentId?.toLowerCase().includes(q)
    );
  });

  const approve = async (id: string) => {
    await patch(`/users/${id}/status`, { status: 'APPROVED' });
    refetch();
  };

  const reject = async (id: string) => {
    await patch(`/users/${id}/status`, { status: 'REJECTED' });
    refetch();
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    await del(`/users/${id}`);
    refetch();
  };

  const pendingCount = users?.filter((u) => u.status === 'PENDING').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Students</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {users?.length || 0} registered students
          </p>
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
          {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              {f === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : f === 'PENDING' ? ' (0)' : ''}
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
              <th>School</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {filtered?.map((u) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/admin/users/${u.id}`)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <td className="font-medium text-gray-900 dark:text-white">
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.email}</td>
                <td className="font-mono">{u.studentId || '-'}</td>
                <td>{u.school?.name || '-'}</td>
                <td>
                  <Badge color={statusColor[u.status]}>{u.status}</Badge>
                </td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {u.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approve(u.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors cursor-pointer"
                          title="Approve"
                        >
                          <CheckCircle size={15} className="text-green-500" />
                        </button>
                        <button
                          onClick={() => reject(u.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Reject"
                        >
                          <XCircle size={15} className="text-red-500" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered?.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <GraduationCap size={40} className="text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-gray-400">No students found matching filters</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Can } from '../../components/shared/Can';
import { useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { UserDirectoryTabs } from '../../components/admin/UserDirectoryTabs';
import { Search, CheckCircle, XCircle, Trash2, Presentation } from 'lucide-react';
import { clsx } from 'clsx';
import { TablePager } from '../../components/ui/TablePager';
import type { User } from '../../types';

const statusColor = { PENDING: 'yellow' as const, APPROVED: 'green' as const, REJECTED: 'red' as const, DEACTIVATED: 'gray' as const, DELETED: 'gray' as const };

export function AllLecturersPage() {
  const navigate = useNavigate();
  const { data: users, refetch } = useApi<User[]>('/users?role=LECTURER');
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
      u.email.toLowerCase().includes(q)
    );
  });

  // Pagination (11-05): "#" numbers continue across pages; a new search or filter starts on page 1.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const total = filtered?.length ?? 0;
  const current = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
  const offset = current * pageSize;
  const pageRows = filtered?.slice(offset, offset + pageSize);
  const allCount = users?.filter((u) => u.status !== 'DELETED').length ?? 0;
  const isNarrowed = !!search || filter !== 'all';

  const approve = async (id: string) => {
    await patch(`/users/${id}/status`, { status: 'APPROVED' });
    refetch();
  };

  const reject = async (id: string) => {
    await patch(`/users/${id}/status`, { status: 'REJECTED' });
    refetch();
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lecturer?')) return;
    await del(`/users/${id}`);
    refetch();
  };

  const pendingCount = users?.filter((u) => u.status === 'PENDING').length || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lecturers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {users?.length || 0} registered lecturers
          </p>
        </div>
      </div>

      <UserDirectoryTabs />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10',
              )}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              {f === 'PENDING' ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
          {isNarrowed ? `${total.toLocaleString()} of ${allCount.toLocaleString()}` : total.toLocaleString()} lecturer{(isNarrowed ? allCount : total) !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Institution</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {pageRows?.map((u, i) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/admin/users/${u.id}`)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <td className="text-xs tabular-nums text-gray-400">{offset + i + 1}</td>
                <td className="font-medium text-gray-900 dark:text-white">
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.email}</td>
                <td>{u.school?.name || '-'}</td>
                <td>
                  <Badge color={statusColor[u.status]}>{u.status}</Badge>
                </td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {u.status === 'PENDING' && (
                      <Can perm="MANAGE_USERS">
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
                      </Can>
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
                    <Presentation size={40} className="text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-gray-400">No lecturers found matching filters</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TablePager page={current} pageSize={pageSize} total={total} noun="lecturers" onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(0); }} />
      </div>
    </div>
  );
}

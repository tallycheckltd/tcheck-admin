import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { Users, Mail, School, Search } from 'lucide-react';
import type { User } from '../../types';

export function SchoolAdminsPage() {
  const { data: admins, loading } = useApi<User[]>('/users?role=SUB_ADMIN');
  const [search, setSearch] = useState('');

  const filtered = (admins || []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.school?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Admins</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Direct clients — University IT Directors and HODs only. Student records are never shown here.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
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
                      <span className="font-medium text-gray-900 dark:text-white">
                        {admin.firstName} {admin.lastName}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Mail size={12} className="text-gray-400" />
                      {admin.email}
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-xs">
                      <School size={12} className="text-gray-400" />
                      {admin.school?.name || <span className="text-gray-400">—</span>}
                    </span>
                  </td>
                  <td>
                    <Badge color={admin.status === 'APPROVED' ? 'green' : admin.status === 'PENDING' ? 'yellow' : 'red'}>
                      {admin.status}
                    </Badge>
                  </td>
                  <td className="text-xs text-gray-400">
                    {new Date(admin.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <Users size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No school admins found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

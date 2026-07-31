import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Mail, School, BookOpen, Calendar, TrendingUp } from 'lucide-react';
import type { UserDetail } from '../../types';

const statusColor = { PENDING: 'yellow' as const, APPROVED: 'green' as const, REJECTED: 'red' as const };
const HISTORY_PAGE_SIZE = 20;

interface HistoryRecord {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInType: string;
  status: string;
  class: { title: string; course: { name: string; code: string } } | null;
}

interface HistoryResponse {
  records: HistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user } = useApi<UserDetail>(id ? `/users/${id}` : null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.get<HistoryResponse>(`/users/${id}/attendance-history?page=1&pageSize=${HISTORY_PAGE_SIZE}`).then((res) => {
      if (cancelled) return;
      setHistory(res.records);
      setHistoryPage(1);
      setHasMoreHistory(res.hasMore);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadMoreHistory = async () => {
    if (!id || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = historyPage + 1;
      const res = await api.get<HistoryResponse>(`/users/${id}/attendance-history?page=${next}&pageSize=${HISTORY_PAGE_SIZE}`);
      setHistory((prev) => [...prev, ...res.records]);
      setHistoryPage(next);
      setHasMoreHistory(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overallAttendance = user.courseStats?.length
    ? Math.round(user.courseStats.reduce((sum, c) => sum + c.percentage, 0) / user.courseStats.length)
    : 0;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
        <ArrowLeft size={16} /> Back to Users
      </button>

      {/* Profile Header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{user.firstName} {user.lastName}</h1>
              <Badge color={statusColor[user.status]}>{user.status}</Badge>
              <Badge color={user.role === 'LECTURER' ? 'blue' : 'gray'}>{user.role.replace('_', ' ')}</Badge>
            </div>
            <div className="flex items-center gap-6 mt-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {user.email}</span>
              {user.school && <span className="flex items-center gap-1.5"><School size={14} /> {user.school.name}</span>}
              {user.studentId && <span className="font-mono">{user.studentId}</span>}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Joined {new Date(user.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {user.role === 'STUDENT' ? (
          <>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Enrolled Courses</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{user.enrollments?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Calendar size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Check-ins</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{user._count?.attendances ?? user.attendances?.length ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Avg Attendance</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{overallAttendance}%</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Teaching Courses</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{user.taughtCourses?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Calendar size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Students</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">
                    {user.taughtCourses?.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0) || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Classes</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">
                    {user.taughtCourses?.reduce((sum, c) => sum + (c._count?.classes || 0), 0) || 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Course Stats */}
      {user.role === 'STUDENT' && user.courseStats && user.courseStats.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Course Attendance</h3>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Classes Attended</th>
                <th>Total Classes</th>
                <th>Attendance %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {user.courseStats.map((cs) => (
                <tr key={cs.courseId}>
                  <td className="font-medium text-slate-950 dark:text-white">{cs.courseName}</td>
                  <td>{cs.attended}</td>
                  <td>{cs.total}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full max-w-[120px]">
                        <div
                          className={`h-2 rounded-full ${cs.percentage >= 75 ? 'bg-green-500' : cs.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${cs.percentage}%` }}
                        />
                      </div>
                      <span className="font-medium">{cs.percentage}%</span>
                    </div>
                  </td>
                  <td>
                    <Badge color={cs.percentage >= 75 ? 'green' : 'red'}>
                      {cs.percentage >= 75 ? 'Eligible' : 'At Risk'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lecturer's Courses */}
      {user.role === 'LECTURER' && user.taughtCourses && user.taughtCourses.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Teaching Courses</h3>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Code</th>
                <th>School</th>
                <th>Enrolled Students</th>
                <th>Total Classes</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {user.taughtCourses.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-950 dark:text-white">{c.name}</td>
                  <td className="font-mono">{c.code}</td>
                  <td>{c.school?.name || '-'}</td>
                  <td>{c._count?.enrollments || 0}</td>
                  <td>{c._count?.classes || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Attendance */}
      {history.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Recent Attendance</h3>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Class</th>
                <th>Check-in Time</th>
                <th>Check-in Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {history.map((a) => (
                <tr key={a.id}>
                  <td>{a.class?.course?.name || '-'}</td>
                  <td className="font-medium text-slate-950 dark:text-white">{a.class?.title || '-'}</td>
                  <td>{new Date(a.checkInAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      a.checkInType === 'BLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                      a.checkInType === 'QR' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-slate-500'
                    }`}>
                      {a.checkInType}
                    </span>
                  </td>
                  <td><Badge color="green">{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMoreHistory && (
            <div className="p-4 border-t border-gray-100 dark:border-white/5 text-center">
              <button
                type="button"
                onClick={loadMoreHistory}
                disabled={loadingMore}
                className="text-sm font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

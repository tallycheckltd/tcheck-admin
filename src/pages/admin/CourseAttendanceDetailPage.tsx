import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, CheckCircle2, XCircle, Smartphone } from 'lucide-react';
import type { CourseAttendanceDetail } from '../../types';
import { formatClassCalendarDate, formatClassTimeLocal } from '../../utils/classDateDisplay';

export function CourseAttendanceDetailPage() {
  const { id, courseId } = useParams<{ id: string; courseId: string }>();
  const navigate = useNavigate();
  const { data } = useApi<CourseAttendanceDetail>(id && courseId ? `/users/${id}/courses/${courseId}/attendance` : null);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
        <ArrowLeft size={16} /> Back to Profile
      </button>

      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{data.course.name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-mono">{data.course.code}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {data.student.firstName} {data.student.lastName}
              {data.student.studentId && <span className="font-mono ml-2">({data.student.studentId})</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-950 dark:text-white">{data.percentage}%</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{data.attended} / {data.totalSessions} sessions attended</p>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/5">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Session-by-Session Breakdown</h3>
        </div>
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Date</th>
              <th>Room</th>
              <th>Check-in Time</th>
              <th>Device</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className="text-slate-800 dark:text-gray-300">
            {data.sessions.map((s) => (
              <tr key={s.classId}>
                <td className="font-medium text-slate-950 dark:text-white">{s.title}</td>
                <td>{formatClassCalendarDate(s.date)}</td>
                <td>{s.isOnline ? <Badge color="blue">Online</Badge> : (s.room || '—')}</td>
                <td>{s.checkInAt ? formatClassTimeLocal(s.checkInAt) : '—'}</td>
                <td>
                  {s.deviceModel ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <Smartphone size={12} className="text-slate-400" />
                      {s.deviceModel}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  {s.attended ? (
                    <Badge color="green"><CheckCircle2 size={11} className="inline mr-1" />{s.status}</Badge>
                  ) : (
                    <Badge color="red"><XCircle size={11} className="inline mr-1" />Absent</Badge>
                  )}
                </td>
              </tr>
            ))}
            {data.sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-500 dark:text-slate-400">
                  No sessions scheduled for this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

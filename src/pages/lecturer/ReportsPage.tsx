import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Download, FileText, Bluetooth, QrCode, UserCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import type { Course, ClassSession, ClassAttendanceDetail } from '../../types';
import { api } from '../../lib/api';

export function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const courseQuery = isAdmin ? '/courses' : `/courses?lecturerId=${user?.id}`;
  const { data: courses } = useApi<Course[]>(courseQuery);
  const { data: classes } = useApi<ClassSession[]>('/classes');
  const [selected, setSelected] = useState<string>('');
  const [detail, setDetail] = useState<ClassAttendanceDetail | null>(null);

  const myClasses = isAdmin
    ? (classes || [])
    : classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];

  const loadRecords = async (classId: string) => {
    setSelected(classId);
    const data = await api.get<ClassAttendanceDetail>(`/attendance/class/${classId}`);
    setDetail(data);
  };

  const exportCSV = () => {
    if (!detail) return;
    const headers = 'Student ID,Name,Check In,Check Out,Method,Status,Punctuality\n';
    const rows = detail.attendances.map((r) => {
      const status = !r.checkInAt ? 'ABSENT' : r.checkOutAt ? 'CHECKED OUT' : 'IN CLASS';
      return `${r.user?.studentId},${r.user?.firstName} ${r.user?.lastName},${new Date(r.checkInAt).toLocaleString()},${r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : ''},${r.checkInType},${status},${r.punctuality || ''}`;
    }).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${detail.classInfo.title}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generate attendance reports per class</p>
        </div>
        {detail && (
          <Button onClick={exportCSV} variant="secondary"><Download size={16} className="mr-1" /> Export CSV</Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {myClasses.map((cls) => (
          <Button key={cls.id} variant={selected === cls.id ? 'primary' : 'secondary'} size="sm" onClick={() => loadRecords(cls.id)}>
            {cls.title}
          </Button>
        ))}
      </div>

      {selected && detail ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Enrolled</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{detail.totalEnrolled}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-2xl font-bold text-green-600">{detail.totalCheckedIn}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-2xl font-bold text-red-500">{detail.absentStudents.length}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {detail.totalEnrolled > 0 ? Math.round((detail.totalCheckedIn / detail.totalEnrolled) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm gradient-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Punctuality</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {detail.attendances.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-gray-400">{i + 1}</td>
                    <td className="font-mono text-xs">{r.user?.studentId || '-'}</td>
                    <td className="font-medium text-gray-900 dark:text-white">{r.user?.firstName} {r.user?.lastName}</td>
                    <td>{new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.checkInType === 'BLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                        r.checkInType === 'QR' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
                      }`}>
                        {r.checkInType === 'BLE' && <Bluetooth size={10} />}
                        {r.checkInType === 'QR' && <QrCode size={10} />}
                        {r.checkInType === 'MANUAL' && <UserCheck size={10} />}
                        {r.checkInType}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        if (!r.checkInAt) return <Badge color="red">ABSENT</Badge>;
                        if (r.checkInAt && !r.checkOutAt) return <Badge color="green">IN CLASS</Badge>;
                        return <Badge color="gray">CHECKED OUT</Badge>;
                      })()}
                    </td>
                    <td>
                      {r.punctuality === 'ON_TIME' && <Badge color="green">ON TIME</Badge>}
                      {r.punctuality === 'LATE' && <Badge color="yellow">LATE</Badge>}
                      {r.punctuality === 'EXTREMELY_LATE' && <Badge color="red">EXTREMELY LATE</Badge>}
                      {!r.punctuality && '-'}
                    </td>
                  </tr>
                ))}
                {detail.attendances.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">No attendance records</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {detail.absentStudents.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-white/5">
                <h3 className="text-base font-semibold text-red-600 dark:text-red-400">Absent Students ({detail.absentStudents.length})</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {detail.absentStudents.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-400">
                      {s.firstName} {s.lastName} <span className="text-red-400 text-xs">({s.studentId || 'N/A'})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card text-center py-12">
          <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500">Select a class to view report</p>
        </div>
      )}
    </div>
  );
}

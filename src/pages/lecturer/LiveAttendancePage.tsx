import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Radio, Users, QrCode, UserCheck } from 'lucide-react';
import type { ClassSession, Course, ClassAttendanceDetail } from '../../types';
import { api } from '../../lib/api';

export function LiveAttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const courseQuery = isAdmin ? '/courses' : `/courses?lecturerId=${user?.id}`;
  const { data: courses } = useApi<Course[]>(courseQuery);
  const { data: classes } = useApi<ClassSession[]>('/classes?date=' + new Date().toISOString().split('T')[0]);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classDetail, setClassDetail] = useState<ClassAttendanceDetail | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const myClasses = isAdmin
    ? (classes || [])
    : classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    const s = createSocket(token);
    socketRef.current = s;
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!selectedClass || !socket) return undefined;

    const joinClass = () => {
      socket.emit('join:class', selectedClass);
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then(setClassDetail);
    };

    joinClass();

    const handler = () => {
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then(setClassDetail);
    };
    socket.on('attendance:update', handler);

    return () => {
      socket.emit('leave:class', selectedClass);
      socket.off('attendance:update', handler);
    };
  }, [selectedClass]);

  const rosterRows = classDetail
    ? [
      ...classDetail.attendances.map((a) => {
        const isLate = a.punctuality === 'LATE' || a.punctuality === 'EXTREMELY_LATE';
        return {
          id: a.id,
          name: `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim(),
          studentId: a.user?.studentId || 'N/A',
          status: isLate ? 'Late' : 'Present',
          checkInAt: a.checkInAt,
          checkOutAt: a.checkOutAt,
          checkInType: a.checkInType,
        };
      }),
      ...classDetail.absentStudents.map((s) => ({
        id: `absent-${s.id}`,
        name: `${s.firstName} ${s.lastName}`.trim(),
        studentId: s.studentId || 'N/A',
        status: 'Absent',
        checkInAt: '',
        checkOutAt: '',
        checkInType: undefined,
      })),
    ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radio size={24} className="text-green-500 animate-pulse" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Attendance</h1>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {myClasses.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClass(cls.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedClass === cls.id
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-blue-300'
            }`}
          >
            {cls.title}
            <span className="ml-2 text-xs opacity-70">({cls._count?.attendances || 0})</span>
          </button>
        ))}
        {myClasses.length === 0 && (
          <p className="text-sm text-gray-400">No classes scheduled for today</p>
        )}
      </div>

      {selectedClass && classDetail ? (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Enrolled</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{classDetail.totalEnrolled}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Checked In</p>
              <p className="text-2xl font-bold text-green-600">{classDetail.totalCheckedIn}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-2xl font-bold text-red-500">{classDetail.absentStudents.length}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-sm text-gray-500">Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {classDetail.totalEnrolled > 0 ? Math.round((classDetail.totalCheckedIn / classDetail.totalEnrolled) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Live feed */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {classDetail.totalCheckedIn} students checked in
                </span>
              </div>
              <Badge color="green">
                <span className="flex items-center gap-1"><Radio size={10} className="animate-pulse" /> Live</span>
              </Badge>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/80 dark:bg-slate-900/80 border-b border-white/10">
                  <tr>
                    <th className="text-left py-3 px-4 text-slate-200 font-medium">Student Details</th>
                    <th className="text-left py-3 px-4 text-slate-200 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-200 font-medium">Check-In Time</th>
                    <th className="text-left py-3 px-4 text-slate-200 font-medium">Check-Out Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-white/5 last:border-0">
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{row.name}</p>
                        <p className="text-xs text-gray-500">{row.studentId}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.status === 'Present'
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : row.status === 'Late'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        }`}>
                          {row.status}
                        </span>
                        {row.checkInType === 'MANUAL' && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            <UserCheck size={10} /> Manual Override
                          </span>
                        )}
                        {row.checkInType === 'QR' && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                            <QrCode size={10} /> QR
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {row.checkInAt ? new Date(row.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {row.checkOutAt ? new Date(row.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rosterRows.length === 0 && (
                <p className="text-center text-gray-400 py-8">Waiting for students to check in...</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card text-center py-12">
          <Radio size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Select a class to view live attendance</p>
        </div>
      )}
    </div>
  );
}

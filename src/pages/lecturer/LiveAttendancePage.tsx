import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Radio, Users, Bluetooth, QrCode, UserCheck, UserPlus, Clock } from 'lucide-react';
import type { ClassSession, Course, ClassAttendanceDetail, School } from '../../types';
import { api } from '../../lib/api';
import { useMutation } from '../../hooks/useApi';

function getAttendanceStatus(a: { checkInAt?: string; checkOutAt?: string | null }) {
  if (!a.checkInAt) return { label: 'ABSENT', color: 'red' as const };
  if (a.checkInAt && !a.checkOutAt) return { label: 'IN CLASS', color: 'green' as const };
  return { label: 'CHECKED OUT', color: 'gray' as const };
}

function getPunctualityBadge(punctuality?: string) {
  if (!punctuality) return null;
  const map: Record<string, { label: string; color: 'green' | 'yellow' | 'red' }> = {
    ON_TIME: { label: 'ON TIME', color: 'green' },
    LATE: { label: 'LATE', color: 'yellow' },
    EXTREMELY_LATE: { label: 'EXTREMELY LATE', color: 'red' },
  };
  return map[punctuality] || null;
}

export function LiveAttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const isLecturer = user?.role === 'LECTURER';
  const courseQuery = isAdmin ? '/courses' : `/courses?lecturerId=${user?.id}`;
  const { data: courses } = useApi<Course[]>(courseQuery);
  const { data: classes } = useApi<ClassSession[]>('/classes?date=' + new Date().toISOString().split('T')[0]);
  const { data: schoolData } = useApi<School[]>('/schools');

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classDetail, setClassDetail] = useState<ClassAttendanceDetail | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { mutate: manualCheckIn } = useMutation('post');

  // Determine if manual override is allowed for lecturer role
  const userSchool = schoolData?.find((s) => s.id === user?.schoolId);
  const canManualOverride = isAdmin || (isLecturer && userSchool?.allowManualLecturerOverride !== false);

  const myClasses = isAdmin
    ? (classes || [])
    : classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (!selectedClass || !socket) return;
    socket.emit('join:class', selectedClass);
    api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then(setClassDetail);

    const handler = () => {
      // Re-fetch to get computed punctuality data
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then(setClassDetail);
    };
    socket.on('attendance:update', handler);
    socket.on('attendance:checkout', handler);

    return () => {
      socket.emit('leave:class', selectedClass);
      socket.off('attendance:update', handler);
      socket.off('attendance:checkout', handler);
    };
  }, [selectedClass, socket]);

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
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {classDetail.attendances.map((a) => {
                const status = getAttendanceStatus(a);
                const punctuality = getPunctualityBadge(a.punctuality);
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {a.user?.firstName} {a.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{a.user?.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={status.color}>{status.label}</Badge>
                      {punctuality && <Badge color={punctuality.color}>{punctuality.label}</Badge>}
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        a.checkInType === 'BLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                        a.checkInType === 'QR' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
                      }`}>
                        {a.checkInType === 'BLE' && <Bluetooth size={10} />}
                        {a.checkInType === 'QR' && <QrCode size={10} />}
                        {a.checkInType === 'MANUAL' && <UserCheck size={10} />}
                        {a.checkInType}
                      </span>
                      <div className="text-right min-w-[50px]">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(a.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {classDetail.attendances.length === 0 && (
                <p className="text-center text-gray-400 py-8">Waiting for students to check in...</p>
              )}
            </div>
          </div>

          {/* Absent students with manual override */}
          {classDetail.absentStudents.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-red-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {classDetail.absentStudents.length} absent students
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {classDetail.absentStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold">
                        {s.firstName?.[0]}{s.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-500">{s.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color="red">ABSENT</Badge>
                      {canManualOverride && (
                        <button
                          onClick={async () => {
                            await manualCheckIn('/attendance/manual-check-in', { userId: s.id, classId: selectedClass });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20 transition-colors cursor-pointer"
                          title="Mark Present"
                        >
                          <UserPlus size={12} />
                          Mark Present
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

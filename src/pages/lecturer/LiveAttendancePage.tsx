import { useState, useEffect, useRef, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Radio, Users, QrCode, UserCheck, RefreshCw, Wifi, WifiOff, Send } from 'lucide-react';
import type { ClassSession, Course, ClassAttendanceDetail, ClassPing } from '../../types';
import { api } from '../../lib/api';
import { localCalendarYmd } from '../../utils/classDateDisplay';
import { getClassTimeStatus } from '../../utils/classTimeStatus';

export function LiveAttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';

  const courseQuery =
    user?.role === 'SUB_ADMIN' && user?.schoolId
      ? `/courses?schoolId=${user.schoolId}`
      : user?.role === 'SUPER_ADMIN'
        ? '/courses'
        : `/courses?lecturerId=${user?.id}`;

  const { data: courses } = useApi<Course[]>(courseQuery);

  /** Same offset convention as iOS `TimeZone.current.secondsFromGMT()` / `GET /classes/today`. */
  const tzOffsetSec = useMemo(() => -new Date().getTimezoneOffset() * 60, []);

  const [todayYmd, setTodayYmd] = useState(() => localCalendarYmd());
  useEffect(() => {
    const id = window.setInterval(() => {
      const n = localCalendarYmd();
      setTodayYmd((p) => (p !== n ? n : p));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const classesPath = `/classes?date=${encodeURIComponent(todayYmd)}&tzOffset=${tzOffsetSec}`;
  const { data: classes, refetch: refetchClasses, loading: classesLoading } = useApi<ClassSession[]>(classesPath, {
    refetchIntervalMs: 20_000,
    refetchWhenVisible: true,
  });

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classDetail, setClassDetail] = useState<ClassAttendanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastRosterAt, setLastRosterAt] = useState<Date | null>(null);

  // Phase 1: lecturer "Ping Class" spot check
  const { mutate: sendPing, loading: pingSending } = useMutation<ClassPing>('post');
  const [activePing, setActivePing] = useState<ClassPing | null>(null);
  const [pingResponseCount, setPingResponseCount] = useState(0);

  // Phase 1: manual check-in override, surfaced here (backend already gates on School.allowManualLecturerOverride)
  const { mutate: manualCheck, loading: manualChecking } = useMutation('post');
  const [manualModal, setManualModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const selectedClassRef = useRef(selectedClass);
  selectedClassRef.current = selectedClass;

  const myClasses = useMemo(() => {
    const raw = isAdmin ? classes || [] : classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];
    const now = new Date();
    return [...raw].sort((a, b) => {
      const rank = (c: ClassSession) => {
        const st = getClassTimeStatus(c.startTime, c.endTime, now);
        if (st === 'live') return 0;
        if (st === 'upcoming') return 1;
        return 2;
      };
      const dr = rank(a) - rank(b);
      if (dr !== 0) return dr;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [isAdmin, classes, courses]);

  // Socket once per mount — reconnect re-joins the selected class room.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    const s = createSocket(token);
    socketRef.current = s;

    const syncRoster = (classId: string) => {
      api.get<ClassAttendanceDetail>(`/attendance/class/${classId}`).then((d) => {
        setClassDetail(d);
        setLastRosterAt(new Date());
      });
    };

    const onConnect = () => {
      setSocketConnected(true);
      const id = selectedClassRef.current;
      if (id) {
        s.emit('join:class', id);
        syncRoster(id);
      }
    };
    const onDisconnect = () => setSocketConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    setSocketConnected(s.connected);
    if (s.connected) onConnect();

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      if (selectedClassRef.current) s.emit('leave:class', selectedClassRef.current);
      s.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, []);

  // Join room + live updates for the active session.
  useEffect(() => {
    const socket = socketRef.current;
    if (!selectedClass || !socket) {
      if (!selectedClass) setClassDetail(null);
      return undefined;
    }

    setActivePing(null);
    setPingResponseCount(0);

    const joinAndLoad = () => {
      socket.emit('join:class', selectedClass);
      setDetailLoading(true);
      api
        .get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`)
        .then((d) => {
          setClassDetail(d);
          setLastRosterAt(new Date());
        })
        .finally(() => setDetailLoading(false));
    };

    joinAndLoad();

    const onAttendanceUpdate = () => {
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then((d) => {
        setClassDetail(d);
        setLastRosterAt(new Date());
      });
      void refetchClasses({ silent: true });
    };
    socket.on('attendance:update', onAttendanceUpdate);

    const onClassPing = (data: { pingId: string; expiresAt: string }) => {
      setActivePing({ id: data.pingId, classId: selectedClass, initiatedById: '', createdAt: new Date().toISOString(), expiresAt: data.expiresAt });
      setPingResponseCount(0);
    };
    socket.on('class:ping', onClassPing);

    const onPingUpdate = (data: { pingId: string; responseCount: number }) => {
      setPingResponseCount((prev) => (data.responseCount >= prev ? data.responseCount : prev));
    };
    socket.on('ping:update', onPingUpdate);

    return () => {
      socket.emit('leave:class', selectedClass);
      socket.off('attendance:update', onAttendanceUpdate);
      socket.off('class:ping', onClassPing);
      socket.off('ping:update', onPingUpdate);
    };
  }, [selectedClass, refetchClasses]);

  // Polling backup when WebSocket is down or firewalled — roster still moves.
  useEffect(() => {
    if (!selectedClass) return undefined;
    const id = window.setInterval(() => {
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then((d) => {
        setClassDetail(d);
        setLastRosterAt(new Date());
      });
      void refetchClasses({ silent: true });
    }, 10_000);
    return () => window.clearInterval(id);
  }, [selectedClass, refetchClasses]);

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

  const rosterHint = socketConnected
    ? 'Socket connected — check-ins and check-outs appear here as they happen. We still refresh every 10s as a backup.'
    : 'Socket disconnected — roster updates every 10s automatically. Reconnect Wi‑Fi/VPN or refresh if this stays red.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Radio size={24} className="text-green-500 animate-pulse shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Attendance</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
              Sessions for <span className="font-semibold text-gray-900 dark:text-white">{todayYmd}</span> use your
              device&apos;s calendar (same as the mobile app). New classes and headcounts refresh about every 20s; open a
              session to stream the roster in real time.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={socketConnected ? 'green' : 'gray'}>
            <span className="inline-flex items-center gap-1.5">
              {socketConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {socketConnected ? 'Live socket' : 'Socket off'}
            </span>
          </Badge>
          <button
            type="button"
            onClick={() => void refetchClasses({ silent: false })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10"
          >
            <RefreshCw size={14} />
            Refresh sessions
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100/95">
        <p className="font-medium">Live roster</p>
        <p className="mt-1 text-emerald-800/90 dark:text-emerald-100/80">{rosterHint}</p>
        {lastRosterAt && selectedClass && (
          <p className="mt-2 text-xs opacity-80">
            Last roster sync: {lastRosterAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {classesLoading && myClasses.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading today&apos;s sessions…</p>
        )}
        {myClasses.map((cls) => {
          const st = getClassTimeStatus(cls.startTime, cls.endTime);
          const live = st === 'live';
          return (
            <button
              key={cls.id}
              type="button"
              onClick={() => setSelectedClass(cls.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer text-left ${
                selectedClass === cls.id
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-blue-300'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {live && <Radio size={12} className="shrink-0 animate-pulse text-green-300" aria-hidden />}
                {cls.title}
              </span>
              <span className="ml-2 text-xs opacity-70">({cls._count?.attendances || 0})</span>
              <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-80">
                {live ? 'Live' : st === 'upcoming' ? 'Upcoming' : 'Ended'}
              </span>
            </button>
          );
        })}
        {!classesLoading && myClasses.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sessions for this calendar day. Create a class for {todayYmd} or check that your account has the right
            school/courses — the list also refreshes automatically.
          </p>
        )}
      </div>

      {selectedClass && (
        <div className="space-y-4">
          {detailLoading && !classDetail ? (
            <div className="glass-card flex items-center justify-center gap-3 py-16 text-gray-600 dark:text-gray-400">
              <RefreshCw className="h-6 w-6 animate-spin shrink-0" aria-hidden />
              Loading roster…
            </div>
          ) : classDetail ? (
            <>
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
                    {classDetail.totalEnrolled > 0
                      ? Math.round((classDetail.totalCheckedIn / classDetail.totalEnrolled) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pingSending}
                  onClick={async () => {
                    const ping = await sendPing(`/attendance/class/${selectedClass}/ping`);
                    if (ping) {
                      setActivePing(ping);
                      setPingResponseCount(0);
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Send size={14} /> Ping Class
                  </span>
                </Button>
                {activePing && new Date(activePing.expiresAt) > new Date() && (
                  <Badge color="blue">
                    <span className="inline-flex items-center gap-1">
                      <Radio size={10} className="animate-pulse" />
                      {pingResponseCount}/{classDetail.totalCheckedIn} responded
                    </span>
                  </Badge>
                )}
                {classDetail.classInfo.allowManualLecturerOverride ? (
                  <Button variant="secondary" size="sm" onClick={() => setManualModal(true)}>
                    <span className="inline-flex items-center gap-1.5">
                      <UserCheck size={14} /> Manual Check-In
                    </span>
                  </Button>
                ) : (
                  <Badge color="gray">Manual override disabled for this school</Badge>
                )}
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-blue-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {classDetail.totalCheckedIn} students checked in
                    </span>
                    {detailLoading && (
                      <RefreshCw size={14} className="animate-spin text-gray-400" aria-label="Refreshing" />
                    )}
                  </div>
                  <Badge color="green">
                    <span className="flex items-center gap-1">
                      <Radio size={10} className="animate-pulse" /> Live
                    </span>
                  </Badge>
                </div>
                {/* Desktop/tablet: table. Below md, a stacked-card list replaces it so lecturers can
                    manage the roster from a phone without horizontal scrolling. */}
                <div className="hidden md:block max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10">
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
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                row.status === 'Present'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                  : row.status === 'Late'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                              }`}
                            >
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
                            {row.checkInAt
                              ? new Date(row.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {row.checkOutAt
                              ? new Date(row.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rosterRows.length === 0 && (
                    <p className="text-center text-gray-400 py-8">Waiting for students to check in…</p>
                  )}
                </div>

                <div className="md:hidden max-h-96 overflow-y-auto space-y-2">
                  {rosterRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{row.name}</p>
                        <p className="text-xs text-gray-500">{row.studentId}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {row.checkInAt
                            ? `In ${new Date(row.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Not checked in'}
                          {row.checkOutAt && ` · Out ${new Date(row.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            row.status === 'Present'
                              ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                              : row.status === 'Late'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                          }`}
                        >
                          {row.status}
                        </span>
                        {row.checkInType === 'MANUAL' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            <UserCheck size={10} /> Manual
                          </span>
                        )}
                        {row.checkInType === 'QR' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                            <QrCode size={10} /> QR
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {rosterRows.length === 0 && (
                    <p className="text-center text-gray-400 py-8">Waiting for students to check in…</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card text-center py-12 text-gray-500">Could not load roster for this session.</div>
          )}
        </div>
      )}

      {!selectedClass && (
        <div className="glass-card text-center py-12">
          <Radio size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Select a session above to view live attendance.</p>
        </div>
      )}

      <Modal
        open={manualModal}
        onClose={() => { setManualModal(false); setSelectedStudent(''); }}
        title="Manual Check-In"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select a student to manually mark present for this session — for dead batteries or hardware exceptions.
          </p>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
          >
            <option value="">Select student</option>
            {classDetail?.absentStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentId || 'N/A'})</option>
            ))}
          </select>
          <Button
            className="w-full"
            disabled={!selectedStudent || manualChecking}
            onClick={async () => {
              await manualCheck('/attendance/manual-check-in', { userId: selectedStudent, classId: selectedClass });
              setManualModal(false);
              setSelectedStudent('');
              if (selectedClass) {
                api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then((d) => {
                  setClassDetail(d);
                  setLastRosterAt(new Date());
                });
              }
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <UserCheck size={16} /> Check In Student
            </span>
          </Button>
        </div>
      </Modal>
    </div>
  );
}

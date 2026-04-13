import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Radio, Users, Bluetooth, QrCode, UserCheck, UserPlus, Clock, CheckCircle, LogOut } from 'lucide-react';
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

// ─── HOD Split-Panel View ─────────────────────────────────────────────────────

function HodLiveView({ classes }: { classes: ClassSession[]; courses: Course[] }) {
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.id || '');
  const [classDetail, setClassDetail] = useState<ClassAttendanceDetail | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [feedEvents, setFeedEvents] = useState<{ id: string; name: string; time: string; courseCode: string }[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const cls = classes.find((c) => c.id === selectedClass);

    const fetchDetail = () => {
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then((data) => {
        setClassDetail((prev) => {
          if (prev) {
            // Detect new check-ins and add to feed
            const prevIds = new Set(prev.attendances.map((a) => a.id));
            data.attendances.forEach((a) => {
              if (!prevIds.has(a.id) && a.user) {
                const event = {
                  id: a.id,
                  name: `${a.user.firstName} ${a.user.lastName}`,
                  time: new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
                  courseCode: cls?.course?.code || '',
                };
                setFeedEvents((prev) => [event, ...prev].slice(0, 100));
              }
            });
          }
          return data;
        });
      });
    };

    fetchDetail();

    if (socket) {
      socket.emit('join:class', selectedClass);
      socket.on('attendance:update', fetchDetail);
      socket.on('attendance:checkout', fetchDetail);
    }

    const interval = setInterval(fetchDetail, 15000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit('leave:class', selectedClass);
        socket.off('attendance:update', fetchDetail);
        socket.off('attendance:checkout', fetchDetail);
      }
    };
  }, [selectedClass, socket, classes]);

  // Auto-scroll feed to top (newest) unless HOD has scrolled manually
  useEffect(() => {
    if (!userScrolled && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [feedEvents, userScrolled]);

  const selectedCls = classes.find((c) => c.id === selectedClass);
  const present = classDetail?.attendances.filter((a) => a.checkInAt) || [];
  const absent = classDetail?.absentStudents || [];

  return (
    <div className="space-y-4">
      {/* Class selector dropdown */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-800 dark:text-gray-300 whitespace-nowrap">Active Class:</label>
        <select
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setFeedEvents([]); setClassDetail(null); setUserScrolled(false); }}
          className="flex-1 max-w-xs px-3 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.title} — {new Date(cls.startTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </select>
        <Badge color="green">
          <span className="flex items-center gap-1"><Radio size={10} className="animate-pulse" /> Live</span>
        </Badge>
      </div>

      {/* Stats bar */}
      {classDetail && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Enrolled',    value: classDetail.totalEnrolled,  color: 'text-gray-900 dark:text-white' },
            { label: 'Present',     value: present.length,              color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Absent',      value: absent.length,               color: 'text-red-500' },
            { label: 'Rate',        value: `${classDetail.totalEnrolled > 0 ? Math.round((classDetail.totalCheckedIn / classDetail.totalEnrolled) * 100) : 0}%`, color: 'text-blue-600 dark:text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="glass-card p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {selectedClass && classDetail ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT — Real-time event feed */}
          <div className="glass-card flex flex-col" style={{ minHeight: '420px' }}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Radio size={15} className="text-blue-500 animate-pulse" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Live Feed</span>
              </div>
              <span className="text-xs text-gray-400">{present.length} check-ins</span>
            </div>
            <div
              ref={feedRef}
              className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-96"
              onScroll={() => setUserScrolled(true)}
            >
              {feedEvents.length === 0 && classDetail.attendances.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <Radio size={32} className="text-slate-400 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">Waiting for check-ins…</p>
                </div>
              ) : (
                <>
                  {feedEvents.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-sm">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900 dark:text-white">{ev.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                            <Clock size={9} /> In: {ev.time}
                          </span>
                          <span className="text-[10px] text-gray-400">Out: --:--</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Seed feed with existing attendances on first load */}
                  {feedEvents.length === 0 && classDetail.attendances.filter((a) => a.checkInAt).map((a) => {
                    const punc = a.punctuality;
                    const puncStyle =
                      punc === 'ON_TIME'       ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                      punc === 'LATE'          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' :
                      punc === 'EXTREMELY_LATE'? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : '';
                    const puncLabel =
                      punc === 'ON_TIME' ? 'ON TIME' : punc === 'LATE' ? 'LATE' : punc === 'EXTREMELY_LATE' ? 'EXTREMELY LATE' : null;
                    return (
                      <div key={a.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-white/3 text-sm">
                        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {a.user?.firstName} {a.user?.lastName}
                            </span>
                            {puncLabel && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${puncStyle}`}>
                                {puncLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                              <Clock size={9} /> In: {new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {a.checkOutAt ? (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <LogOut size={9} /> Out: {new Date(a.checkOutAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-gray-600 italic">Out: Pending</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            {userScrolled && (
              <button
                onClick={() => { setUserScrolled(false); if (feedRef.current) feedRef.current.scrollTop = 0; }}
                className="mx-3 mb-3 py-1.5 rounded-lg text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer text-center"
              >
                ↑ Scroll to newest
              </button>
            )}
          </div>

          {/* RIGHT — Present / Absent roster */}
          <div className="glass-card flex flex-col" style={{ minHeight: '420px' }}>
            <div className="p-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Class Roster</span>
              <p className="text-xs text-gray-400 mt-0.5">{selectedCls?.course?.name || selectedCls?.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Present */}
              {present.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      ✅ Present ({present.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {present.map((a) => {
                      const punc = a.punctuality;
                      const puncStyle =
                        punc === 'ON_TIME'        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                        punc === 'LATE'           ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' :
                        punc === 'EXTREMELY_LATE' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : '';
                      const puncLabel =
                        punc === 'ON_TIME' ? 'ON TIME' : punc === 'LATE' ? 'LATE' : punc === 'EXTREMELY_LATE' ? 'EXTREMELY LATE' : null;
                      return (
                        <div key={a.id} className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                  {a.user?.firstName} {a.user?.lastName}
                                </p>
                                {puncLabel && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${puncStyle}`}>
                                    {puncLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                  <Clock size={8} /> {new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {a.checkOutAt ? (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    <LogOut size={8} /> {new Date(a.checkOutAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 dark:text-gray-600 italic">Out: Pending</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Absent / Pending */}
              {absent.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 dark:bg-white/3 border-b border-gray-100 dark:border-white/10">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      ⬜ Absent / Pending ({absent.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {absent.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 opacity-60">
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-500 text-[10px] font-bold flex-shrink-0">
                          {s.firstName?.[0]}{s.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-400 truncate">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-[10px] text-gray-400">{s.studentId}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card text-center py-12">
          <Radio size={40} className="mx-auto mb-3 text-slate-400 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Select a class above to start monitoring</p>
        </div>
      )}
    </div>
  );
}

// ─── Lecturer View (unchanged original) ──────────────────────────────────────

function LecturerLiveView({ classes, courses }: { classes: ClassSession[]; courses: Course[] }) {
  const { user } = useAuth();
  const { data: schoolData } = useApi<School[]>('/schools');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classDetail, setClassDetail] = useState<ClassAttendanceDetail | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { mutate: manualCheckIn } = useMutation('post');

  const userSchool = schoolData?.find((s) => s.id === user?.schoolId);
  const canManualOverride = userSchool?.allowManualLecturerOverride !== false;

  const myClasses = classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const fetchDetail = () => {
      api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then(setClassDetail);
    };
    fetchDetail();
    if (socket) {
      socket.emit('join:class', selectedClass);
      socket.on('attendance:update', fetchDetail);
      socket.on('attendance:checkout', fetchDetail);
    }
    const interval = setInterval(fetchDetail, 15000);
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit('leave:class', selectedClass);
        socket.off('attendance:update', fetchDetail);
        socket.off('attendance:checkout', fetchDetail);
      }
    };
  }, [selectedClass, socket]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {myClasses.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClass(cls.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedClass === cls.id
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white dark:bg-white/5 text-slate-800 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-blue-300'
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Enrolled',   value: classDetail.totalEnrolled,   color: 'text-gray-900 dark:text-white' },
              { label: 'Checked In', value: classDetail.totalCheckedIn,   color: 'text-emerald-600' },
              { label: 'Absent',     value: classDetail.absentStudents.length, color: 'text-red-500' },
              { label: 'Rate',       value: `${classDetail.totalEnrolled > 0 ? Math.round((classDetail.totalCheckedIn / classDetail.totalEnrolled) * 100) : 0}%`, color: 'text-blue-600' },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4 text-center">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <span className="text-sm font-medium text-slate-800 dark:text-gray-300">
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
                      <p className="text-xs font-medium text-slate-800 dark:text-gray-300 flex items-center gap-1 min-w-[50px]">
                        <Clock size={10} />
                        {new Date(a.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {classDetail.attendances.length === 0 && (
                <p className="text-center text-gray-400 py-8">Waiting for students to check in...</p>
              )}
            </div>
          </div>

          {classDetail.absentStudents.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-red-500" />
                <span className="text-sm font-medium text-slate-800 dark:text-gray-300">
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
                            api.get<ClassAttendanceDetail>(`/attendance/class/${selectedClass}`).then(setClassDetail);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20 transition-colors cursor-pointer"
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
          <Radio size={48} className="mx-auto mb-4 text-slate-400 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">Select a class to view live attendance</p>
        </div>
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function LiveAttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const courseQuery = isAdmin ? '/courses' : `/courses?lecturerId=${user?.id}`;
  const { data: courses } = useApi<Course[]>(courseQuery);
  const { data: classes } = useApi<ClassSession[]>('/classes?date=' + new Date().toISOString().split('T')[0]);

  const todayClasses = classes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radio size={24} className="text-green-500 animate-pulse" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Attendance</h1>
      </div>

      {isAdmin ? (
        todayClasses.length === 0 ? (
          <div className="glass-card text-center py-12">
            <Radio size={40} className="mx-auto mb-3 text-slate-400 dark:text-gray-600" />
            <p className="text-sm text-gray-400">No classes scheduled for today.</p>
          </div>
        ) : (
          <HodLiveView classes={todayClasses} courses={courses || []} />
        )
      ) : (
        <LecturerLiveView classes={todayClasses} courses={courses || []} />
      )}
    </div>
  );
}

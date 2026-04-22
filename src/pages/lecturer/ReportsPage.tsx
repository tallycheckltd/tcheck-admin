import { useState, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Download, FileText, Bluetooth, QrCode, UserCheck, Filter, ChevronDown, Search } from 'lucide-react';
import type { Course, ClassSession, ClassAttendanceDetail } from '../../types';
import { api } from '../../lib/api';
import { clsx } from 'clsx';

export function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  
  const courseQuery = isAdmin ? '/courses' : `/courses?lecturerId=${user?.id}`;
  const { data: courses } = useApi<Course[]>(courseQuery);
  const { data: classes, loading: classesLoading } = useApi<ClassSession[]>('/classes');
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [detail, setDetail] = useState<ClassAttendanceDetail | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');

  // Filter classes based on role and selected course
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    
    let filtered = classes;
    
    // For lecturers, only show classes belonging to their courses
    if (!isAdmin && courses) {
      filtered = filtered.filter(c => courses.some(co => co.id === c.courseId));
    }
    
    // If a course is selected (especially for admins), filter by that course
    if (selectedCourseId) {
      filtered = filtered.filter(c => c.courseId === selectedCourseId);
    }

    if (sessionSearch) {
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
        c.course?.code?.toLowerCase().includes(sessionSearch.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [classes, courses, isAdmin, selectedCourseId, sessionSearch]);

  const loadRecords = async (classId: string) => {
    setSelectedClassId(classId);
    try {
      const data = await api.get<ClassAttendanceDetail>(`/attendance/class/${classId}`);
      setDetail(data);
    } catch (error) {
      console.error('Failed to load class records:', error);
    }
  };

  const exportCSV = () => {
    if (!detail) return;
    const headers = 'Student ID,Name,Check In,Check Out,Method,RSSI,Status\n';
    const rows = detail.attendances.map((r) =>
      `${r.user?.studentId || ''},${r.user?.firstName} ${r.user?.lastName},${new Date(r.checkInAt).toLocaleString()},${r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : ''},${r.checkInType},${r.beaconRSSI || ''},${r.status}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${detail.classInfo.title.replace(/\s+/g, '-')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Generate and export attendance reports per class session</p>
        </div>
        {detail && (
          <Button onClick={exportCSV} variant="primary" className="shadow-blue-500/20">
            <Download size={16} className="mr-2" /> Export CSV Report
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Selection Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-4 space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Filter size={12} /> Filter by Course
                </label>
                <div className="relative group">
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setSelectedClassId('');
                      setDetail(null);
                    }}
                    className="w-full appearance-none bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer text-slate-900 dark:text-white"
                  >
                    <option value="">All Courses</option>
                    {courses?.map(course => (
                      <option key={course.id} value={course.id}>{course.code} - {course.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <FileText size={12} /> Select Session
              </label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              
              <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {classesLoading ? (
                  <div className="py-8 text-center"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                ) : filteredClasses.length > 0 ? (
                  filteredClasses.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => loadRecords(cls.id)}
                      className={clsx(
                        'w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all group border',
                        selectedClassId === cls.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10'
                          : 'bg-white dark:bg-transparent text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 border-slate-100 dark:border-white/5'
                      )}
                    >
                      <div className="font-bold truncate">{cls.title}</div>
                      <div className={clsx("text-[10px] mt-1", selectedClassId === cls.id ? 'text-blue-100' : 'text-slate-400')}>
                        {new Date(cls.date).toLocaleDateString()} • {cls.course?.code || 'N/A'}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    {selectedCourseId ? 'No sessions for this course' : 'No sessions found'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Detail View */}
        <div className="lg:col-span-3">
          {detail ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enrolled</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{detail.totalEnrolled}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Present</p>
                  <p className="text-3xl font-black text-green-600 mt-1">{detail.totalCheckedIn}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Absent</p>
                  <p className="text-3xl font-black text-red-500 mt-1">{detail.absentStudents.length}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rate</p>
                  <p className="text-3xl font-black text-blue-600 mt-1">
                    {detail.totalEnrolled > 0 ? Math.round((detail.totalCheckedIn / detail.totalEnrolled) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck size={18} className="text-blue-500" />
                    Attendance Records
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white dark:bg-white/5 px-2 py-1 rounded-md border border-slate-100 dark:border-white/10">
                    {detail.attendances.length} Records Found
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm gradient-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student ID</th>
                        <th>Full Name</th>
                        <th>In Time</th>
                        <th>Out Time</th>
                        <th>Method</th>
                        <th>Signal</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-transparent">
                      {detail.attendances.map((r, i) => (
                        <tr key={r.id}>
                          <td className="text-slate-400 font-mono text-[10px]">{i + 1}</td>
                          <td className="font-bold text-slate-900 dark:text-white font-mono text-xs">{r.user?.studentId || '-'}</td>
                          <td className="font-medium">{r.user?.firstName} {r.user?.lastName}</td>
                          <td>{new Date(r.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td>
                            <span className={clsx(
                              "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg",
                              r.checkInType === 'BLE' ? 'bg-blue-600/10 text-blue-600' :
                              r.checkInType === 'QR' ? 'bg-purple-600/10 text-purple-600' :
                              'bg-slate-500/10 text-slate-600'
                            )}>
                              {r.checkInType === 'BLE' && <Bluetooth size={10} />}
                              {r.checkInType === 'QR' && <QrCode size={10} />}
                              {r.checkInType === 'MANUAL' && <UserCheck size={10} />}
                              {r.checkInType}
                            </span>
                          </td>
                          <td className="font-mono text-[10px]">
                            {r.beaconRSSI ? (
                              <span className={clsx(r.beaconRSSI > -70 ? 'text-green-600' : 'text-orange-500')}>
                                {r.beaconRSSI} dBm
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <span className={clsx(
                              "text-[10px] font-black uppercase tracking-tighter",
                              r.status === 'PRESENT' ? 'text-green-600' : 'text-red-500'
                            )}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {detail.attendances.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-12 text-slate-400 italic">No attendance records for this session</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {detail.absentStudents.length > 0 && (
                <div className="glass-card overflow-hidden border-red-500/10">
                  <div className="p-4 border-b border-red-50 border-white/5 bg-red-50/10">
                    <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                      <AlertTriangle size={16} /> Absent Students ({detail.absentStudents.length})
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {detail.absentStudents.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                          <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-600 flex items-center justify-center text-[10px] font-bold">
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <span className="text-xs font-medium text-slate-700 dark:text-red-400">
                            {s.firstName} {s.lastName}
                          </span>
                          <span className="text-[10px] text-red-400 font-mono">({s.studentId || 'N/A'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card flex flex-col items-center justify-center py-24 text-center border-dashed border-2">
              <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                <FileText size={40} className="text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Session Selected</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 max-w-xs mx-auto">
                {isAdmin ? 'Filter by course then select a class session' : 'Select a class session'} from the sidebar to view detailed attendance analytics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertTriangle({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

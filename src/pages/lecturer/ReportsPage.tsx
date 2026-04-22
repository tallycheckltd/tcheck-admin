import { useState, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Download, FileText, Bluetooth, QrCode, UserCheck, Filter, ChevronDown, Search, AlertTriangle, TrendingDown } from 'lucide-react';
import type { Course, ClassSession, ClassAttendanceDetail, CourseAttendanceExportRow } from '../../types';
import { api } from '../../lib/api';
import { csvField } from '../../lib/csv';
import { clsx } from 'clsx';

// --- HOD View (Department-wide) ---
interface RosterRow {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  overallAttendancePct: number;
  riskLevel: string;
}

function HodReportsView() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<'semester-roster' | 'course-attendance' | 'at-risk' | ''>('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-01-13');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const { data: courses } = useApi<Course[]>(`/courses?schoolId=${user?.schoolId}`);

  const handleExport = async () => {
    if (!reportType) return;
    setExporting(true);
    setExportError('');

    try {
      let csvContent = '';
      let filename = '';

      if (reportType === 'semester-roster' || reportType === 'at-risk') {
        const rows = await api.get<RosterRow[]>(`/attendance/roster?from=${dateFrom}&to=${dateTo}`);
        if (!rows || rows.length === 0) {
          setExportError('No records found for the selected range.');
          return;
        }

        const filtered = reportType === 'at-risk'
          ? rows.filter(r => r.overallAttendancePct < 75).sort((a, b) => a.overallAttendancePct - b.overallAttendancePct)
          : rows;

        csvContent = 'Student ID,First Name,Last Name,Email,Overall Attendance %,Risk Level\n';
        filtered.forEach(r => {
          csvContent += [csvField(r.studentId), csvField(r.firstName), csvField(r.lastName), csvField(r.email), csvField(`${r.overallAttendancePct}%`), csvField(r.riskLevel)].join(',') + '\n';
        });
        filename = `${reportType}-${dateTo}.csv`;
      } else if (reportType === 'course-attendance' && selectedCourse) {
        const rows = await api.get<CourseAttendanceExportRow[]>(`/attendance/course-records?courseId=${selectedCourse}&from=${dateFrom}&to=${dateTo}`);
        csvContent = 'Class,Date,Room,Student ID,Name,Time,Method,Punctuality\n';
        rows.forEach(r => {
          csvContent += [csvField(r.classTitle), csvField(new Date(r.classDate).toLocaleDateString()), csvField(r.room || ''), csvField(r.studentId), csvField(`${r.firstName} ${r.lastName}`), csvField(new Date(r.checkInAt).toLocaleTimeString()), csvField(r.checkInType), csvField(r.punctuality)].join(',') + '\n';
        });
        filename = `course-${selectedCourse}-${dateTo}.csv`;
      }

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch (e) {
      setExportError('Export failed. Please check your parameters.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
      <div className="lg:col-span-1 space-y-4">
        <div className="glass-card p-6 space-y-5">
           <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Filter size={12} /> Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
            >
              <option value="">Select type...</option>
              <option value="semester-roster">Semester Master Roster</option>
              <option value="course-attendance">Course Attendance</option>
              <option value="at-risk">At-Risk Students (&lt;75%)</option>
            </select>
          </div>

          {reportType === 'course-attendance' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Course</label>
              <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm">
                <option value="">Select course...</option>
                {courses?.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date Range</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs mb-2" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
          </div>

          <Button onClick={handleExport} disabled={!reportType || exporting} className="w-full py-3">
            {exporting ? 'Generating...' : 'Export Department CSV'}
          </Button>
          {exportError && <p className="text-xs text-red-500 mt-2">{exportError}</p>}
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center opacity-80">
          <TrendingDown size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-bold">Report Preview Mode</h3>
          <p className="text-sm text-slate-500 max-w-xs mt-2">Adjust your filters on the left and click Export to download high-fidelity spreadsheets scoped to your department.</p>
        </div>
      </div>
    </div>
  );
}

// --- Lecturer View (Class-session focused) ---
function LecturerReportsView() {
  const { user } = useAuth();
  const { data: courses } = useApi<Course[]>(`/courses?lecturerId=${user?.id}`);
  const { data: classes, loading: classesLoading } = useApi<ClassSession[]>('/classes');
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [detail, setDetail] = useState<ClassAttendanceDetail | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');

  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    let filtered = classes.filter(c => courses?.some(co => co.id === c.courseId));
    if (sessionSearch) {
      filtered = filtered.filter(c => c.title.toLowerCase().includes(sessionSearch.toLowerCase()));
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [classes, courses, sessionSearch]);

  const loadRecords = async (classId: string) => {
    setSelectedClassId(classId);
    try {
      const data = await api.get<ClassAttendanceDetail>(`/attendance/class/${classId}`);
      setDetail(data);
    } catch (error) { console.error(error); }
  };

  const exportCSV = () => {
    if (!detail) return;
    const headers = 'Student ID,Name,Check In,Check Out,Method,Status\n';
    const rows = detail.attendances.map(r => 
      `${r.user?.studentId || ''},${r.user?.firstName} ${r.user?.lastName},${new Date(r.checkInAt).toLocaleString()},${r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : ''},${r.checkInType},${r.status}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${detail.classInfo.title}.csv`; a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="glass-card p-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search sessions..." value={sessionSearch} onChange={(e) => setSessionSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-3 py-2 text-xs" />
          </div>
          <div className="max-h-[500px] overflow-y-auto space-y-1 custom-scrollbar">
            {filteredClasses.map(cls => (
              <button
                key={cls.id}
                onClick={() => loadRecords(cls.id)}
                className={clsx(
                  'w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all border',
                  selectedClassId === cls.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                )}
              >
                <div className="font-bold truncate">{cls.title}</div>
                <div className="text-[10px] opacity-60 mt-1">{new Date(cls.date).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3">
        {detail ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/40 p-4 rounded-2xl border border-white/20">
              <h2 className="font-bold text-gray-900">{detail.classInfo.title} Analytics</h2>
              <Button onClick={exportCSV} variant="secondary" size="sm"><Download size={14} className="mr-1" /> Export CSV</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Enrolled</p>
                <p className="text-2xl font-black mt-1">{detail.totalEnrolled}</p>
              </div>
              <div className="stat-card">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Present</p>
                <p className="text-2xl font-black text-green-600 mt-1">{detail.totalCheckedIn}</p>
              </div>
              <div className="stat-card">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Absent</p>
                <p className="text-2xl font-black text-red-500 mt-1">{detail.absentStudents.length}</p>
              </div>
              <div className="stat-card">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Rate</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{detail.totalEnrolled > 0 ? Math.round((detail.totalCheckedIn / detail.totalEnrolled) * 100) : 0}%</p>
              </div>
            </div>
            <div className="glass-card overflow-hidden">
               <table className="w-full text-sm gradient-table">
                <thead><tr><th>Student ID</th><th>Name</th><th>Method</th><th>Status</th></tr></thead>
                <tbody>
                  {detail.attendances.map(r => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.user?.studentId}</td>
                      <td>{r.user?.firstName} {r.user?.lastName}</td>
                      <td><Badge color="blue">{r.checkInType}</Badge></td>
                      <td><Badge color="green">{r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
               </table>
            </div>
          </div>
        ) : (
          <div className="glass-card py-24 text-center border-dashed border-2 flex flex-col items-center">
            <FileText size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500">Select a session from the sidebar</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const isHod = user?.role === 'SUB_ADMIN' || user?.role === 'SUPER_ADMIN';
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isHod ? 'Departmental oversight and semester-long data exports.' : 'Session-based attendance tracking and CSV exports.'}
        </p>
      </div>
      {isHod ? <HodReportsView /> : <LecturerReportsView />}
    </div>
  );
}

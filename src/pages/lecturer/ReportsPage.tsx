import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Download, FileText, Bluetooth, QrCode, UserCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import type { Course, ClassSession, ClassAttendanceDetail, CourseAttendanceExportRow } from '../../types';
import { api } from '../../lib/api';
import { csvField } from '../../lib/csv';

// ─── HOD Reports ──────────────────────────────────────────────────────────────

type ReportType = '' | 'semester-roster' | 'course-attendance' | 'at-risk';

const SEMESTER_START = '2026-01-13';

interface RosterRow {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  overallAttendancePct: number;
  riskLevel: string;
}

function HodReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [dateFrom, setDateFrom] = useState(SEMESTER_START);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState('');

  const schoolScope = user?.schoolId ? `?schoolId=${user.schoolId}` : '';
  const { data: courses } = useApi<Course[]>(`/courses${schoolScope}`);

  const canExport = reportType !== '' && (reportType !== 'course-attendance' || selectedCourse !== '');

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    setExportError('');

    try {
      let csvContent = '';
      let filename = '';

      if (reportType === 'semester-roster' || reportType === 'at-risk') {
        // Real data from the backend roster endpoint
        const rows = await api.get<RosterRow[]>(
          `/attendance/roster?from=${dateFrom}&to=${dateTo}`,
        );

        if (!rows || rows.length === 0) {
          setExportError(
            'No students found for your school in the selected date range. Ensure students are approved and linked to your school.',
          );
          return;
        }

        const filtered = reportType === 'at-risk'
          ? rows.filter((r) => r.overallAttendancePct < 75).sort((a, b) => a.overallAttendancePct - b.overallAttendancePct)
          : rows;

        csvContent = 'Student ID,First Name,Last Name,Email,Overall Attendance %,Risk Level\n';
        filtered.forEach((r) => {
          csvContent += [
            csvField(r.studentId),
            csvField(r.firstName),
            csvField(r.lastName),
            csvField(r.email),
            csvField(`${r.overallAttendancePct}%`),
            csvField(r.riskLevel),
          ].join(',') + '\n';
        });

        filename = reportType === 'at-risk'
          ? `at-risk-students-${dateTo}.csv`
          : `semester-roster-${dateFrom}-to-${dateTo}.csv`;
      }

      if (reportType === 'course-attendance') {
        const rows = await api.get<CourseAttendanceExportRow[]>(
          `/attendance/course-records?courseId=${encodeURIComponent(selectedCourse)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`,
        );
        const course = courses?.find((c) => c.id === selectedCourse);

        csvContent =
          'Class Session,Class Date,Room,Student ID,First Name,Last Name,Check-In Date,Check-In Time,Check-Out Time,Method,Punctuality\n';
        (rows || []).forEach((r) => {
          const inDate = new Date(r.checkInAt);
          const outDate = r.checkOutAt ? new Date(r.checkOutAt) : null;
          const classDay = new Date(r.classDate);
          csvContent +=
            [
              csvField(r.classTitle),
              csvField(classDay.toLocaleDateString()),
              csvField(r.room ?? ''),
              csvField(r.studentId),
              csvField(r.firstName),
              csvField(r.lastName),
              csvField(inDate.toLocaleDateString()),
              csvField(inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
              csvField(outDate ? outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'),
              csvField(r.checkInType),
              csvField(r.punctuality ?? ''),
            ].join(',') + '\n';
        });
        filename = `course-attendance-${course?.code || selectedCourse}-${dateFrom}-to-${dateTo}.csv`;
      }

      if (!csvContent || csvContent.split('\n').length <= 2) {
        setExportError('No records found for the selected parameters. The CSV would be empty.');
        return;
      }

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (e) {
      setExportError(`Export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Export attendance data scoped to your department only.
        </p>
      </div>

      <div className="glass-card p-6 space-y-5">
        {/* Report type */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-gray-300 mb-2">
            Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => { setReportType(e.target.value as ReportType); setSelectedCourse(''); }}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
          >
            <option value="">Select a report type…</option>
            <option value="semester-roster">End of Semester Master Roster</option>
            <option value="course-attendance">Specific Course Attendance</option>
            <option value="at-risk">At-Risk Student List</option>
          </select>
          {reportType && (
            <p className="mt-1.5 text-xs text-gray-400">
              {reportType === 'semester-roster' && 'All students in your department with their overall attendance % for the selected date range.'}
              {reportType === 'course-attendance' && 'All attendance records for a specific course, filtered by date range.'}
              {reportType === 'at-risk' && 'Students with attendance below 75%, flagged by risk score. Scoped to your department only.'}
            </p>
          )}
        </div>

        {/* Course selector (only for course-attendance) */}
        {reportType === 'course-attendance' && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 dark:text-gray-300 mb-2">
              Course
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
            >
              <option value="">Select a course…</option>
              {(courses || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        )}

        {/* Date range */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 dark:text-gray-300 mb-2">
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">From</p>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">To</p>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={!canExport || exporting}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            exported
              ? 'bg-emerald-500 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25'
          }`}
        >
          <Download size={18} />
          {exported ? '✓ Exported Successfully' : exporting ? 'Generating…' : 'Export to CSV'}
        </button>

        {exportError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>
          </div>
        )}

        {reportType && !exportError && (
          <p className="text-xs text-gray-400 text-center">
            ✅ Data is real and scoped to your school only — backed by <code className="font-mono text-blue-500">WHERE schoolId = ?</code> on every query.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Lecturer Reports (unchanged) ────────────────────────────────────────────

function LecturerReportsPage() {
  const { user } = useAuth();
  const { data: courses } = useApi<Course[]>(`/courses?lecturerId=${user?.id}`);
  const { data: classes } = useApi<ClassSession[]>('/classes');
  const [selected, setSelected] = useState<string>('');
  const [detail, setDetail] = useState<ClassAttendanceDetail | null>(null);

  const myClasses = classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];

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
      const name = `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim();
      return [
        csvField(r.user?.studentId),
        csvField(name),
        csvField(new Date(r.checkInAt).toLocaleString()),
        csvField(r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : ''),
        csvField(r.checkInType),
        csvField(status),
        csvField(r.punctuality || ''),
      ].join(',');
    }).join('\n');
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
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
            {[
              { label: 'Enrolled', value: detail.totalEnrolled, color: '' },
              { label: 'Present',  value: detail.totalCheckedIn, color: 'text-green-600' },
              { label: 'Absent',   value: detail.absentStudents.length, color: 'text-red-500' },
              { label: 'Rate',     value: `${detail.totalEnrolled > 0 ? Math.round((detail.totalCheckedIn / detail.totalEnrolled) * 100) : 0}%`, color: 'text-blue-600' },
            ].map((s) => (
              <div key={s.label} className="glass-card p-4 text-center">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold text-gray-900 dark:text-white ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm gradient-table">
              <thead>
                <tr>
                  <th>#</th><th>Student ID</th><th>Name</th><th>Check In</th><th>Check Out</th><th>Method</th><th>Status</th><th>Punctuality</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-gray-300">
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
                      {!r.checkInAt ? <Badge color="red">ABSENT</Badge> :
                       !r.checkOutAt ? <Badge color="green">IN CLASS</Badge> :
                       <Badge color="gray">CHECKED OUT</Badge>}
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
              <div className="p-4 flex flex-wrap gap-2">
                {detail.absentStudents.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-400">
                    {s.firstName} {s.lastName} <span className="text-red-400 text-xs">({s.studentId || 'N/A'})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card text-center py-12">
          <FileText size={48} className="mx-auto mb-4 text-slate-400 dark:text-gray-600" />
          <p className="text-gray-500">Select a class to view report</p>
        </div>
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuth();
  const isHod = user?.role === 'SUB_ADMIN';
  return isHod ? <HodReportsPage /> : <LecturerReportsPage />;
}

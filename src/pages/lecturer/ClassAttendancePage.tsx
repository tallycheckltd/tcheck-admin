import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { QrCode, Bluetooth, UserCheck, Users, Clock, Search, Download, Info, FileDown } from 'lucide-react';
import { exportSessionLedgerPdf } from '../../lib/adminPdfExport';
import type { ClassAttendanceStat, ClassAttendanceDetail } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { csvField } from '../../lib/csv';
import { formatClassCalendarDate, formatClassTimeLocal } from '../../utils/classDateDisplay';

export function ClassAttendancePage() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';

  if (classId) {
    return <ClassDetailView classId={classId} />;
  }

  return <ClassStatsListView lecturerId={isAdmin ? undefined : user?.id} />;
}

function ClassStatsListView({ lecturerId }: { lecturerId?: string }) {
  const queryParams = lecturerId ? `?lecturerId=${lecturerId}` : '';
  const { data: stats } = useApi<ClassAttendanceStat[]>(`/attendance/class-stats${queryParams}`);
  const [search, setSearch] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);

  const filtered = stats?.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.course.name.toLowerCase().includes(q) || s.course.code.toLowerCase().includes(q);
  });

  const exportCSV = () => {
    if (!filtered) return;
    const headers = ['Class', 'Course', 'Date', 'Enrolled', 'Checked In', 'Rate', 'BLE', 'QR', 'Manual'];
    const rows = filtered.map((s) =>
      [
        csvField(s.title),
        csvField(s.course.name),
        csvField(formatClassCalendarDate(s.date)),
        csvField(s.totalEnrolled),
        csvField(s.totalCheckedIn),
        csvField(`${s.attendanceRate}%`),
        csvField(s.checkInBreakdown.BLE),
        csvField(s.checkInBreakdown.QR),
        csvField(s.checkInBreakdown.MANUAL),
      ].join(','),
    );
    const csv = ['\uFEFF' + headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'class-attendance.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[200px]">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Session attendance</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Drill into BLE, QR, and manual paths with clear rates per scheduled class.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-violet-500/70" aria-hidden />
              Violet · BLE beacon
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-purple-400/65" aria-hidden />
              Purple · QR scans
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-slate-400/80" aria-hidden />
              Slate · Manual override
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCSV}>
            <Download size={16} className="mr-1" /> Export CSV
          </Button>
          <Button
            variant="secondary"
            disabled={!filtered?.length || pdfExporting}
            onClick={async () => {
              if (!filtered?.length) return;
              setPdfExporting(true);
              try {
                await exportSessionLedgerPdf(filtered, 'tcheck-session-attendance');
              } catch {
                window.alert('Could not generate PDF. Try Chrome or Edge on desktop.');
              } finally {
                setPdfExporting(false);
              }
            }}
          >
            <FileDown size={16} className="mr-1" />
            {pdfExporting ? 'PDF…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
        <input
          type="text"
          placeholder="Search by class or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:shadow-none">
        <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-900 dark:text-slate-400">
          <Info size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
          <span>
            Rate divides checked-in learners by rostered enrollments on the course.
            Opens the live roster audit trail — same surfaces students see on mobile for that session window.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/90 dark:text-slate-400">
              <th className="px-5 py-3">Session</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Scheduled</th>
              <th className="whitespace-nowrap px-4 py-3 tabular-nums">Enrolled</th>
              <th className="whitespace-nowrap px-4 py-3 tabular-nums text-center">Present</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3 text-center">BLE</th>
              <th className="px-4 py-3 text-center">QR</th>
              <th className="px-4 py-3 text-center">Manual</th>
              <th className="whitespace-nowrap px-5 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="text-slate-800 dark:text-slate-300">
            {filtered?.map((s) => (
              <tr
                key={s.id}
                className="border-t border-slate-100 hover:bg-slate-50/80 dark:border-slate-900/70 dark:hover:bg-white/[0.03]"
              >
                <td className="max-w-[200px] px-5 py-3 align-top font-semibold text-slate-950 dark:text-white">
                  <span className="line-clamp-2">{s.title}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{s.course.code}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-500">{s.course.name}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-slate-600 dark:text-slate-400">
                  {formatClassCalendarDate(s.date)}
                </td>
                <td className="px-4 py-3 align-top tabular-nums text-slate-700 dark:text-slate-400">{s.totalEnrolled}</td>
                <td className="px-4 py-3 text-center align-top tabular-nums font-medium text-slate-950 dark:text-white">
                  {s.totalCheckedIn}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-1">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-colors"
                        style={{
                          width: `${Math.min(100, s.attendanceRate)}%`,
                          background:
                            s.attendanceRate >= 75 ? 'rgb(22 163 74 / 0.85)' : s.attendanceRate >= 50 ? 'rgb(180 83 9)' : 'rgb(185 28 28)',
                        }}
                      />
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        s.attendanceRate >= 75
                          ? 'text-emerald-700 dark:text-emerald-400/90'
                          : s.attendanceRate >= 50
                            ? 'text-amber-800 dark:text-amber-400/90'
                            : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {s.attendanceRate}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <span className="inline-flex items-center justify-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
                    <Bluetooth size={12} className="shrink-0" aria-hidden />
                    {s.checkInBreakdown.BLE}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <span className="inline-flex items-center justify-center gap-1 rounded-full bg-purple-500/12 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-300/95">
                    <QrCode size={12} className="shrink-0" aria-hidden />
                    {s.checkInBreakdown.QR}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-top">
                  <span className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-500/12 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <UserCheck size={12} className="shrink-0 text-slate-500" aria-hidden />
                    {s.checkInBreakdown.MANUAL}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 align-top text-right">
                  <a
                    href={`/attendance/${s.id}`}
                    className="text-sm font-semibold text-slate-800 underline-offset-4 hover:text-slate-950 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Open roster
                  </a>
                </td>
              </tr>
            ))}
            {(!filtered || filtered.length === 0) && (
              <tr>
                <td colSpan={10} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                  No sessions found for this roster.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function ClassDetailView({ classId }: { classId: string }) {
  const { data, refetch } = useApi<ClassAttendanceDetail>(`/attendance/class/${classId}`);
  const { mutate: manualCheck } = useMutation('post');
  const [manualModal, setManualModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  const handleManualCheckIn = async () => {
    if (!selectedStudent) return;
    await manualCheck('/attendance/manual-check-in', { userId: selectedStudent, classId });
    setManualModal(false);
    setSelectedStudent('');
    refetch();
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bleCount = data.attendances.filter((a) => a.checkInType === 'BLE').length;
  const qrCount = data.attendances.filter((a) => a.checkInType === 'QR').length;
  const manualCount = data.attendances.filter((a) => a.checkInType === 'MANUAL').length;

  return (
    <div className="space-y-6">
      <a href="/attendance" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">
        &larr; Back to Attendance
      </a>

      {/* Class Info Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{data.classInfo.title}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {data.classInfo.courseName} ({data.classInfo.courseCode})
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
              <span className="flex items-center gap-1"><Clock size={14} /> {formatClassCalendarDate(data.classInfo.date)}</span>
              <span>
                {formatClassTimeLocal(data.classInfo.startTime)} – {formatClassTimeLocal(data.classInfo.endTime)}
              </span>
              {data.classInfo.room && <span>Room: {data.classInfo.room}</span>}
            </div>
          </div>
          <Button onClick={() => setManualModal(true)}>
            <UserCheck size={16} className="mr-1" /> Manual Check-in
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">Enrolled</p>
          <p className="text-2xl font-bold text-slate-950 dark:text-white">{data.totalEnrolled}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">Checked In</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.totalCheckedIn}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1"><Bluetooth size={14} /> BLE</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{bleCount}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1"><QrCode size={14} /> QR Code</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{qrCount}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1"><UserCheck size={14} /> Manual</p>
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{manualCount}</p>
        </div>
      </div>

      {/* Checked-in Students */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/5">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white flex items-center gap-2">
            <Users size={20} /> Checked-in Students ({data.totalCheckedIn})
          </h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Student ID</th>
              <th>Check-in Time</th>
              <th>Check-out Time</th>
              <th>Method</th>
              <th>Signal (RSSI)</th>
            </tr>
          </thead>
          <tbody className="text-slate-800 dark:text-gray-300">
            {data.attendances.map((a, i) => (
              <tr key={a.id}>
                <td className="text-slate-600 dark:text-slate-400">{i + 1}</td>
                <td className="font-medium text-slate-950 dark:text-white">{a.user?.firstName} {a.user?.lastName}</td>
                <td className="font-mono text-xs">{a.user?.studentId || '-'}</td>
                <td>{new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                <td>{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.checkInType === 'BLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                    a.checkInType === 'QR' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-slate-500'
                  }`}>
                    {a.checkInType === 'BLE' && <Bluetooth size={12} />}
                    {a.checkInType === 'QR' && <QrCode size={12} />}
                    {a.checkInType === 'MANUAL' && <UserCheck size={12} />}
                    {a.checkInType}
                  </span>
                </td>
                <td className="font-mono text-xs">{a.beaconRSSI ?? '-'}</td>
              </tr>
            ))}
            {data.attendances.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-600 dark:text-slate-400">No check-ins yet</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Absent Students */}
      {data.absentStudents.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              Absent Students ({data.absentStudents.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {data.absentStudents.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-slate-600 dark:text-slate-400">{i + 1}</td>
                  <td className="font-medium text-slate-950 dark:text-white">{s.firstName} {s.lastName}</td>
                  <td className="font-mono text-xs">{s.studentId || '-'}</td>
                  <td>
                    <button
                      onClick={() => { setSelectedStudent(s.id); setManualModal(true); }}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium cursor-pointer"
                    >
                      Check in manually
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Manual Check-in Modal */}
      <Modal open={manualModal} onClose={() => { setManualModal(false); setSelectedStudent(''); }} title="Manual Check-in">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select a student to manually check in for this class.
          </p>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
          >
            <option value="">Select student</option>
            {data.absentStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentId || 'N/A'})</option>
            ))}
          </select>
          <Button onClick={handleManualCheckIn} className="w-full" disabled={!selectedStudent}>
            <UserCheck size={16} className="mr-1" /> Check In Student
          </Button>
        </div>
      </Modal>
    </div>
  );
}

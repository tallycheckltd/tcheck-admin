import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { QrCode, Bluetooth, UserCheck, Users, Clock, Search, Download } from 'lucide-react';
import type { ClassAttendanceStat, ClassAttendanceDetail } from '../../types';
import { useAuth } from '../../context/AuthContext';

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

  const filtered = stats?.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.course.name.toLowerCase().includes(q) || s.course.code.toLowerCase().includes(q);
  });

  const exportCSV = () => {
    if (!filtered) return;
    const headers = ['Class', 'Course', 'Date', 'Enrolled', 'Checked In', 'Rate', 'BLE', 'QR', 'Manual'];
    const rows = filtered.map((s) => [
      s.title, s.course.name,
      new Date(s.date).toLocaleDateString(),
      s.totalEnrolled, s.totalCheckedIn, `${s.attendanceRate}%`,
      s.checkInBreakdown.BLE, s.checkInBreakdown.QR, s.checkInBreakdown.MANUAL,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'class-attendance.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Class Attendance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View check-in details per class</p>
        </div>
        <Button variant="secondary" onClick={exportCSV}>
          <Download size={16} className="mr-1" /> Export CSV
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by class or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Course</th>
              <th>Date</th>
              <th>Enrolled</th>
              <th>Checked In</th>
              <th>Rate</th>
              <th>BLE</th>
              <th>QR</th>
              <th>Manual</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {filtered?.map((s) => (
              <tr key={s.id}>
                <td className="font-medium text-gray-900 dark:text-white">{s.title}</td>
                <td>{s.course.name} ({s.course.code})</td>
                <td>{new Date(s.date).toLocaleDateString()}</td>
                <td>{s.totalEnrolled}</td>
                <td className="font-medium">{s.totalCheckedIn}</td>
                <td>
                  <span className={`font-medium ${s.attendanceRate >= 70 ? 'text-green-600 dark:text-green-400' : s.attendanceRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                    {s.attendanceRate}%
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Bluetooth size={12} className="text-blue-500" /> {s.checkInBreakdown.BLE}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <QrCode size={12} className="text-purple-500" /> {s.checkInBreakdown.QR}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <UserCheck size={12} className="text-gray-500" /> {s.checkInBreakdown.MANUAL}
                  </span>
                </td>
                <td>
                  <a href={`/attendance/${s.id}`} className="text-blue-500 hover:text-blue-600 text-xs font-medium">
                    View Details
                  </a>
                </td>
              </tr>
            ))}
            {(!filtered || filtered.length === 0) && (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">No class attendance data found</td></tr>
            )}
          </tbody>
        </table>
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
      <a href="/attendance" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
        &larr; Back to Attendance
      </a>

      {/* Class Info Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.classInfo.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {data.classInfo.courseName} ({data.classInfo.courseCode})
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Clock size={14} /> {new Date(data.classInfo.date).toLocaleDateString()}</span>
              <span>{new Date(data.classInfo.startTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} - {new Date(data.classInfo.endTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">Enrolled</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalEnrolled}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Checked In</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.totalCheckedIn}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><Bluetooth size={14} /> BLE</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{bleCount}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><QrCode size={14} /> QR Code</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{qrCount}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><UserCheck size={14} /> Manual</p>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{manualCount}</p>
        </div>
      </div>

      {/* Checked-in Students */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-white/5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={20} /> Checked-in Students ({data.totalCheckedIn})
          </h3>
        </div>
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
          <tbody className="text-gray-700 dark:text-gray-300">
            {data.attendances.map((a, i) => (
              <tr key={a.id}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-medium text-gray-900 dark:text-white">{a.user?.firstName} {a.user?.lastName}</td>
                <td className="font-mono text-xs">{a.user?.studentId || '-'}</td>
                <td>{new Date(a.checkInAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                <td>{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.checkInType === 'BLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                    a.checkInType === 'QR' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
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
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No check-ins yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Absent Students */}
      {data.absentStudents.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              Absent Students ({data.absentStudents.length})
            </h3>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {data.absentStudents.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td className="font-medium text-gray-900 dark:text-white">{s.firstName} {s.lastName}</td>
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
      )}

      {/* Manual Check-in Modal */}
      <Modal open={manualModal} onClose={() => { setManualModal(false); setSelectedStudent(''); }} title="Manual Check-in">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select a student to manually check in for this class.
          </p>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
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

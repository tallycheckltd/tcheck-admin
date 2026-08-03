import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Mail, School, BookOpen, Calendar, TrendingUp, Fingerprint, Download, Table2, Smartphone, ShieldAlert, RefreshCw, CheckCircle2, XCircle, FileText } from 'lucide-react';
import type { UserDetail, DeviceChangeReason } from '../../types';
import { exportStudentReportPdf } from '../../lib/adminPdfExport';
import { downloadCsv } from '../../lib/csv';

const statusColor = { PENDING: 'yellow' as const, APPROVED: 'green' as const, REJECTED: 'red' as const, DEACTIVATED: 'gray' as const, DELETED: 'gray' as const };
const HISTORY_PAGE_SIZE = 20;

const REASON_LABEL: Record<DeviceChangeReason, string> = {
  LOST_PHONE: 'Lost phone',
  NEW_PHONE: 'Upgraded phone',
  DAMAGED: 'Phone damaged',
  STOLEN: 'Phone stolen',
  OTHER: 'Other',
};

interface HistoryRecord {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInType: string;
  status: string;
  class: { title: string; room: string | null; course: { name: string; code: string } } | null;
  verification: { deviceId: string | null; deviceModel: string | null; deviceOSVersion: string | null; verificationMethod: string | null } | null;
}

interface HistoryResponse {
  records: HistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, refetch } = useApi<UserDetail>(id ? `/users/${id}` : null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportExporting, setReportExporting] = useState<'pdf' | 'csv' | null>(null);
  const { mutate: resetBiometricLock, loading: resettingBiometricLock } = useMutation('post');
  const { mutate: verifyDevice, loading: verifyingDevice } = useMutation('post');
  const { mutate: resetDevice, loading: resettingDevice } = useMutation('delete');

  const handleResetBiometricLock = async () => {
    if (!id) return;
    if (!confirm("Reset this student's biometric lock? They'll need to re-verify with Face ID/Touch ID (or another supported method) on their next check-in.")) return;
    await resetBiometricLock(`/auth/biometric-lock/reset/${id}`);
    refetch();
  };

  const handleApproveDevice = async () => {
    if (!id || !user) return;
    const msg = user.boundDeviceModel
      ? `Approve the switch from ${user.boundDeviceModel} to ${user.pendingDeviceModel} for ${user.firstName}?`
      : `Approve ${user.pendingDeviceModel} as ${user.firstName}'s bound device?`;
    if (!confirm(msg)) return;
    try {
      await verifyDevice(`/devices/verify/${id}`);
      refetch();
    } catch {
      alert('Failed to approve device');
    }
  };

  const handleDenyDevice = async () => {
    if (!id) return;
    if (!confirm('Deny this device-change request? The student stays bound to their current device.')) return;
    try {
      await resetDevice(`/devices/${id}`);
      refetch();
    } catch {
      alert('Failed to deny request');
    }
  };

  const handleResetDeviceBinding = async () => {
    if (!id || !user) return;
    if (!confirm(`Warning: This clears ${user.firstName}'s device binding entirely. They'll need to register a new device on next login. Continue?`)) return;
    try {
      await resetDevice(`/devices/${id}`);
      refetch();
    } catch {
      alert('Failed to reset device');
    }
  };

  /** Reports engine: specific-student report — fetches the student's FULL history (not just the
   * page currently loaded on screen) so the export is complete, not just what's been scrolled to. */
  const fetchFullHistory = async (): Promise<HistoryRecord[]> => {
    if (!id) return [];
    const res = await api.get<HistoryResponse>(`/users/${id}/attendance-history?page=1&pageSize=1000`);
    return res.records;
  };

  const handleExportStudentReportPdf = async () => {
    if (!id || !user) return;
    setReportExporting('pdf');
    try {
      const fullHistory = await fetchFullHistory();
      await exportStudentReportPdf(user, fullHistory, `tcheck-student-${user.studentId ?? user.id}`);
    } finally {
      setReportExporting(null);
    }
  };

  const handleExportStudentReportCsv = async () => {
    if (!id || !user) return;
    setReportExporting('csv');
    try {
      const fullHistory = await fetchFullHistory();
      downloadCsv(
        `tcheck-student-${user.studentId ?? user.id}.csv`,
        ['Course', 'Class', 'Timestamp', 'Room', 'Type', 'Status'],
        fullHistory.map((h) => [
          h.class?.course?.name ?? '',
          h.class?.title ?? '',
          h.checkInAt,
          h.class?.room ?? '',
          h.checkInType,
          h.status,
        ]),
      );
    } finally {
      setReportExporting(null);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.get<HistoryResponse>(`/users/${id}/attendance-history?page=1&pageSize=${HISTORY_PAGE_SIZE}`).then((res) => {
      if (cancelled) return;
      setHistory(res.records);
      setHistoryPage(1);
      setHasMoreHistory(res.hasMore);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadMoreHistory = async () => {
    if (!id || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = historyPage + 1;
      const res = await api.get<HistoryResponse>(`/users/${id}/attendance-history?page=${next}&pageSize=${HISTORY_PAGE_SIZE}`);
      setHistory((prev) => [...prev, ...res.records]);
      setHistoryPage(next);
      setHasMoreHistory(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overallAttendance = user.courseStats?.length
    ? Math.round(user.courseStats.reduce((sum, c) => sum + c.percentage, 0) / user.courseStats.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
          <ArrowLeft size={16} /> Back to Users
        </button>
        {user.role === 'STUDENT' && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleExportStudentReportPdf()} disabled={reportExporting !== null}>
              <Download size={14} className="mr-1.5" /> {reportExporting === 'pdf' ? 'Building…' : 'Export PDF'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void handleExportStudentReportCsv()} disabled={reportExporting !== null}>
              <Table2 size={14} className="mr-1.5" /> {reportExporting === 'csv' ? 'Building…' : 'Export CSV'}
            </Button>
          </div>
        )}
      </div>

      {/* Profile Header */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{user.firstName} {user.lastName}</h1>
              <Badge color={statusColor[user.status]}>{user.status}</Badge>
              <Badge color={user.role === 'LECTURER' ? 'blue' : 'gray'}>{user.role.replace('_', ' ')}</Badge>
            </div>
            <div className="flex items-center gap-6 mt-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {user.email}</span>
              {user.school && <span className="flex items-center gap-1.5"><School size={14} /> {user.school.name}</span>}
              {user.studentId && <span className="font-mono">{user.studentId}</span>}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Joined {new Date(user.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Biometric Lock Status */}
      {user.role === 'STUDENT' && user.biometricLockInvalidatedAt && (
        <div className="glass-card p-5 border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Fingerprint size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Biometric lock invalidated</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Invalidated {new Date(user.biometricLockInvalidatedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}.
                  This student cannot check in with Face ID/Touch ID until reset — they'll fall back to the school's other allowed method until then.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetBiometricLock}
              disabled={resettingBiometricLock}
            >
              {resettingBiometricLock ? 'Resetting…' : 'Reset Biometric Lock'}
            </Button>
          </div>
        </div>
      )}

      {/* Device Binding — one-account-one-device (Phase 6): what device this student is locked
          to, plus any pending change request right here instead of only on the aggregate queue. */}
      {user.role === 'STUDENT' && (
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${user.boundDeviceId ? 'bg-green-100 dark:bg-green-500/10' : 'bg-gray-100 dark:bg-white/5'}`}>
                <Smartphone size={20} className={user.boundDeviceId ? 'text-green-500' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {user.boundDeviceId ? user.boundDeviceModel : 'No device bound yet'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {user.boundDeviceId
                    ? `Bound since ${user.deviceBoundAt ? new Date(user.deviceBoundAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}. This account can only log in from this device.`
                    : 'Auto-binds to whichever device this student first logs in from.'}
                </p>
                {user.boundDeviceId && (
                  <code className="text-[10px] text-slate-500 font-mono block mt-1">{user.boundDeviceId}</code>
                )}
              </div>
            </div>
            {user.boundDeviceId && !user.pendingDeviceId && (
              <Button variant="secondary" size="sm" onClick={handleResetDeviceBinding} disabled={resettingDevice}>
                <RefreshCw size={14} className="mr-1.5" /> {resettingDevice ? 'Resetting…' : 'Reset Device'}
              </Button>
            )}
          </div>

          {user.pendingDeviceId && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={20} className="text-yellow-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    Requesting change to {user.pendingDeviceModel}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {user.pendingDeviceReason && <Badge color="yellow">{REASON_LABEL[user.pendingDeviceReason]}</Badge>}
                    <span className="text-[10px] text-slate-500">
                      {user.pendingDeviceRegisteredAt ? new Date(user.pendingDeviceRegisteredAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  {user.pendingDeviceNote && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 flex items-start gap-1.5 bg-gray-50 dark:bg-white/5 rounded-lg p-2.5">
                      <FileText size={12} className="mt-0.5 flex-shrink-0" /> {user.pendingDeviceNote}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={handleApproveDevice} disabled={verifyingDevice || resettingDevice}>
                      <CheckCircle2 size={14} className="mr-1.5" /> Approve
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleDenyDevice} disabled={verifyingDevice || resettingDevice}>
                      <XCircle size={14} className="mr-1.5" /> Deny
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {user.role === 'STUDENT' ? (
          <>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Enrolled Courses</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{user.enrollments?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Calendar size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Check-ins</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{user._count?.attendances ?? user.attendances?.length ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Avg Attendance</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{overallAttendance}%</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Teaching Courses</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{user.taughtCourses?.length || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                  <Calendar size={20} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Students</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">
                    {user.taughtCourses?.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0) || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Classes</p>
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">
                    {user.taughtCourses?.reduce((sum, c) => sum + (c._count?.classes || 0), 0) || 0}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Course Stats */}
      {user.role === 'STUDENT' && user.courseStats && user.courseStats.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Course Attendance</h3>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Classes Attended</th>
                <th>Total Classes</th>
                <th>Attendance %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {user.courseStats.map((cs) => (
                <tr
                  key={cs.courseId}
                  onClick={() => navigate(`/admin/users/${id}/courses/${cs.courseId}`)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="font-medium text-slate-950 dark:text-white">{cs.courseName}</td>
                  <td>{cs.attended}</td>
                  <td>{cs.total}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full max-w-[120px]">
                        <div
                          className={`h-2 rounded-full ${cs.percentage >= 75 ? 'bg-green-500' : cs.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${cs.percentage}%` }}
                        />
                      </div>
                      <span className="font-medium">{cs.percentage}%</span>
                    </div>
                  </td>
                  <td>
                    <Badge color={cs.percentage >= 75 ? 'green' : 'red'}>
                      {cs.percentage >= 75 ? 'Eligible' : 'At Risk'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lecturer's Courses */}
      {user.role === 'LECTURER' && user.taughtCourses && user.taughtCourses.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Teaching Courses</h3>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Code</th>
                <th>School</th>
                <th>Enrolled Students</th>
                <th>Total Classes</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {user.taughtCourses.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-950 dark:text-white">{c.name}</td>
                  <td className="font-mono">{c.code}</td>
                  <td>{c.school?.name || '-'}</td>
                  <td>{c._count?.enrollments || 0}</td>
                  <td>{c._count?.classes || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance History — full lifetime log with the hardware/location data captured at
          check-in, so there's no ambiguity about whether or how a session was attended. */}
      {history.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Attendance History</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Complete lifetime check-in log — timestamp, room, and device used for every entry.</p>
          </div>
          <table className="w-full text-sm gradient-table">
            <thead>
              <tr>
                <th>Course / Class</th>
                <th>Timestamp</th>
                <th>Room</th>
                <th>Device</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-gray-300">
              {history.map((a) => (
                <tr key={a.id}>
                  <td>
                    <p className="font-medium text-slate-950 dark:text-white">{a.class?.course?.name || '-'}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{a.class?.title || '-'}</p>
                  </td>
                  <td>{new Date(a.checkInAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td>{a.class?.room || '—'}</td>
                  <td>
                    {a.verification?.deviceModel ? (
                      <div>
                        <p>{a.verification.deviceModel}</p>
                        {a.verification.deviceId && (
                          <p className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">{a.verification.deviceId}</p>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      a.checkInType === 'BLE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                      a.checkInType === 'QR' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-slate-500'
                    }`}>
                      {a.checkInType}
                    </span>
                  </td>
                  <td><Badge color="green">{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMoreHistory && (
            <div className="p-4 border-t border-gray-100 dark:border-white/5 text-center">
              <button
                type="button"
                onClick={loadMoreHistory}
                disabled={loadingMore}
                className="text-sm font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

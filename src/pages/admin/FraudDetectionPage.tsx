import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import {
  AlertTriangle, Users, Shield, ChevronDown, UserCheck, Smartphone,
  CheckCircle, RefreshCw, ImageOff, Fingerprint, ScanFace,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { Modal } from '../../components/ui/Modal';
import { format } from 'date-fns';

interface BiometricFlag {
  id: string;
  attendanceId: string;
  user: { id: string; firstName: string; lastName: string; studentId: string | null };
  class: { title: string; course: { code: string } };
  reason: string;
  aiLivenessScore: number | null;
  aiIdentitySimilarity: number | null;
  tamperDetected: boolean;
  verificationMethod: string | null;
  checkInAt: string;
}

interface FraudSuspiciousPair {
  id: string;
  deviceId: string;
  deviceModel: string | null;
  coAttendanceCount: number;
  users: { id: string; firstName: string; lastName: string; studentId: string | null }[];
  lastSeenAt: string;
}

interface FraudAnalytics {
  flaggedAttendances: { id: string; deviceId: string; user: { firstName: string; lastName: string }; class: { title: string; course: { code: string } }; checkInAt: string }[];
  suspiciousPairs: FraudSuspiciousPair[];
}

const FRAUD_REFRESH_MS = 30_000;

const initialsOf = (u: { firstName: string; lastName: string }) => `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase();
const avatarPalette = ['bg-blue-100 text-blue-600', 'bg-indigo-100 text-indigo-600', 'bg-purple-100 text-purple-600', 'bg-rose-100 text-rose-600'];

export function FraudDetectionPage() {
  const { data: flags, loading, error, refetch } = useApi<BiometricFlag[]>('/attendance/biometric-flags', {
    refetchIntervalMs: FRAUD_REFRESH_MS,
    refetchWhenVisible: true,
  });
  const { data: sharing, refetch: refetchSharing } = useApi<FraudAnalytics>('/attendance/fraud-analytics', {
    refetchIntervalMs: FRAUD_REFRESH_MS,
    refetchWhenVisible: true,
  });
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [reviewFlag, setReviewFlag] = useState<BiometricFlag | null>(null);
  const [reviewPhoto, setReviewPhoto] = useState<string | null | undefined>(undefined);

  const openReview = async (flag: BiometricFlag) => {
    setReviewFlag(flag);
    setReviewPhoto(undefined);
    try {
      const res = await api.get<{ selfieImageBase64: string | null }>(`/attendance/biometric-flags/${flag.attendanceId}/photo`);
      setReviewPhoto(res.selfieImageBase64);
    } catch {
      setReviewPhoto(null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center px-4">
        <AlertTriangle className="text-red-500" size={36} />
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button variant="secondary" onClick={() => refetch()} className="gap-2">
          <RefreshCw size={14} /> Retry
        </Button>
      </div>
    );
  }

  if (loading || !flags) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const suspiciousPairs = sharing?.suspiciousPairs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-red-500" />
            Biometric Fraud Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI liveness &amp; identity verification rejections · refreshes every 30s</p>
        </div>
        <div className="hidden sm:flex gap-2">
           <Badge color="red">{flags.length} Verification Holds</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Verification Holds"
          value={flags.length}
          color="red"
          icon={<ScanFace size={20} />}
        />
        <div>
          <StatCard
            title="Device Sharing"
            value={suspiciousPairs.length}
            color="orange"
            icon={<Users size={20} />}
          />
          <p className="text-[10px] text-gray-400 mt-2 px-1">Distinct devices used by more than one student, last 90 days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Visual Flagged Check-ins */}
        <div className="xl:col-span-2 glass-card overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
               <Fingerprint size={20} className="text-red-500" />
               Flagged Check-ins
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-white/5">
                  <th className="px-6 py-4">Photo</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Class/Course</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {flags.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openReview(f)}
                        title="Review this check-in"
                        className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer"
                      >
                        <ImageOff size={16} />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{f.user.firstName} {f.user.lastName}</div>
                      <div className="text-xs text-gray-400 font-mono">{f.user.studentId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-blue-600 dark:text-blue-400 font-medium">{f.class.course.code}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[150px]">{f.class.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color="red">{f.reason}</Badge>
                      {f.tamperDetected && <div className="mt-1"><Badge color="orange">Tamper detected</Badge></div>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {format(new Date(f.checkInAt), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
                {flags.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="text-green-500" size={24} />
                      </div>
                      <p className="text-sm text-gray-500 italic">No biometric verification holds currently.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Device Sharing Patterns */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
             <Users size={20} className="text-orange-500" />
             Device Sharing Patterns
          </h2>
          <p className="text-xs text-gray-500 mb-6">Devices used by more than one student to check in (buddy punching indicator) — last 90 days.</p>
          <div className="space-y-3">
            {suspiciousPairs.map((p) => {
              const isExpanded = expandedDeviceId === p.deviceId;
              const relatedFlags = sharing?.flaggedAttendances.filter((f) => f.deviceId === p.deviceId) ?? [];
              return (
                <div key={p.id} className="rounded-xl border border-orange-500/10 bg-orange-500/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedDeviceId(isExpanded ? null : p.deviceId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-orange-500/10 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex -space-x-3 flex-shrink-0">
                        {p.users.slice(0, 4).map((u, i) => (
                          <div
                            key={u.id}
                            title={`${u.firstName} ${u.lastName}`}
                            className={`w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold ${avatarPalette[i % avatarPalette.length]}`}
                          >
                            {initialsOf(u)}
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {p.users.map((u) => `${u.firstName} ${u.lastName}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {p.coAttendanceCount} check-ins {p.deviceModel ? `· ${p.deviceModel}` : ''} · last {format(new Date(p.lastSeenAt), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-orange-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-orange-500/10 bg-white/60 dark:bg-black/10 p-4 space-y-2">
                      <p className="text-[10px] text-gray-400 font-mono truncate">Device ID: {p.deviceId}</p>
                      {relatedFlags.map((f) => (
                        <div key={f.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{f.user.firstName} {f.user.lastName}</span>
                          <span className="text-gray-500">{f.class.course.code}</span>
                          <span className="text-gray-400">{format(new Date(f.checkInAt), 'MMM d, HH:mm')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {suspiciousPairs.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="text-blue-500" size={24} />
                </div>
                <p className="text-sm text-gray-400 italic">No recurring sharing patterns detected.</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => refetchSharing()}
            className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <Modal open={!!reviewFlag} onClose={() => setReviewFlag(null)} title="Verification hold review">
        {reviewFlag && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {initialsOf(reviewFlag.user)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{reviewFlag.user.firstName} {reviewFlag.user.lastName}</p>
                <p className="text-xs text-gray-400">{reviewFlag.class.course.code} · {reviewFlag.class.title}</p>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 aspect-square max-w-[280px] mx-auto flex items-center justify-center">
              {reviewPhoto === undefined ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              ) : reviewPhoto ? (
                <img src={`data:image/jpeg;base64,${reviewPhoto}`} alt="Flagged check-in selfie" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-400 p-6">
                  <ImageOff size={28} className="mx-auto mb-2" />
                  <p className="text-xs">No photo captured for this check-in.</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 text-center px-4">
              No baseline enrollment photo is stored (only a face-vector embedding) — this is the flagged attempt's own capture, for reviewing alongside the AI verdict below.
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Reason</p>
                <p className="font-semibold text-red-600 dark:text-red-400">{reviewFlag.reason}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tamper flag</p>
                <p className="font-semibold text-gray-900 dark:text-white">{reviewFlag.tamperDetected ? 'Yes' : 'No'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Liveness score</p>
                <p className="font-semibold text-gray-900 dark:text-white">{reviewFlag.aiLivenessScore ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Identity similarity</p>
                <p className="font-semibold text-gray-900 dark:text-white">{reviewFlag.aiIdentitySimilarity ?? '—'}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <a
                href={`/admin/users/${reviewFlag.user.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Smartphone size={14} /> View student profile
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

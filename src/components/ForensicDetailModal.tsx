import { Modal } from './ui/Modal';
import { useApi } from '../hooks/useApi';

interface VerificationDetail {
  attendanceId: string;
  student: { firstName: string; lastName: string; studentId?: string | null };
  classTitle: string;
  courseName: string;
  courseCode: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInType: string;
  beaconRSSI: number | null;
  status: string;
  verification: {
    verificationMethod: string;
    biometricLockValid: boolean | null;
    selfieImageBase64: string | null;
    faceDetected: boolean | null;
    avgRssi: number | null;
    dwellSeconds: number | null;
    deviceId: string | null;
    deviceOSVersion: string | null;
    clientCapturedAt: string | null;
    isQueuedSubmission: boolean;
  } | null;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm text-slate-800 dark:text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

/**
 * Phase 4 progressive disclosure — the student app never shows this; only lecturers/admins can
 * click a roster badge to pull the full forensic record for dispute resolution.
 */
export function ForensicDetailModal({ attendanceId, onClose }: { attendanceId: string | null; onClose: () => void }) {
  const { data, loading, error } = useApi<VerificationDetail>(
    attendanceId ? `/attendance/${attendanceId}/verification` : null,
  );

  return (
    <Modal open={!!attendanceId} onClose={onClose} title="Check-In Forensic Detail">
      {loading && <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>}
      {error && !loading && <p className="text-sm text-red-500 text-center py-4">Could not load verification detail.</p>}
      {data && !loading && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
              {data.student.firstName} {data.student.lastName}
              {data.student.studentId && <span className="ml-2 text-xs font-mono text-slate-500">{data.student.studentId}</span>}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data.courseCode} — {data.classTitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <DetailRow label="Check-In" value={new Date(data.checkInAt).toLocaleString()} />
            <DetailRow label="Channel" value={data.checkInType} />
            <DetailRow label="Verification Method" value={data.verification?.verificationMethod ?? '—'} />
            <DetailRow label="Queued Submission" value={data.verification?.isQueuedSubmission ? 'Yes — synced after reconnecting' : 'No'} />
            <DetailRow label="Biometric Valid" value={data.verification?.biometricLockValid == null ? '—' : (data.verification.biometricLockValid ? 'Yes' : 'No')} />
            <DetailRow label="Face Detected" value={data.verification?.faceDetected == null ? '—' : (data.verification.faceDetected ? 'Yes' : 'No')} />
            <DetailRow label="Avg. Signal (Dwell)" value={data.verification?.avgRssi != null ? `${data.verification.avgRssi} dBm` : '—'} />
            <DetailRow label="Dwell Duration" value={data.verification?.dwellSeconds != null ? `${data.verification.dwellSeconds}s` : '—'} />
            <DetailRow label="Device ID" value={data.verification?.deviceId ?? '—'} mono />
            <DetailRow label="OS Version" value={data.verification?.deviceOSVersion ?? '—'} />
          </div>
          {data.verification?.selfieImageBase64 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Selfie Verification</p>
              <img
                src={`data:image/jpeg;base64,${data.verification.selfieImageBase64}`}
                alt="Selfie verification"
                className="rounded-xl max-h-48 border border-slate-200 dark:border-white/10"
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

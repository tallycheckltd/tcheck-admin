import { useApi } from '../../../hooks/useApi';
import { Modal } from '../../ui/Modal';
import { Badge } from '../../ui/Badge';
import { qualitativeSignalLabel } from '../../../lib/rfPhysics';
import type { GateAttempt } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  classId: string;
  studentId: string;
  studentName: string;
  /** The student's successful check-in for this class, if any — shown as the headline entry
   * above the raw attempt log. */
  successfulCheckIn?: {
    checkInAt: string;
    checkInType: string;
    avgRssi?: number | null;
    beaconRSSI?: number;
  } | null;
}

const CHANNEL_LABEL: Record<GateAttempt['channel'], string> = {
  BLE: 'Check-In Scan',
  QR: 'QR Scan',
  ONLINE: 'Online Code',
  CHECKOUT: 'Check-Out Scan',
};

/** Same Strong/Medium/Weak -> green/yellow/red mapping used throughout the Heatmap Simulator, so
 * a badge here reads consistently with everywhere else this qualitative scale appears. */
function signalBadgeColor(rssi: number): 'green' | 'yellow' | 'red' {
  const label = qualitativeSignalLabel(rssi);
  return label === 'Strong' ? 'green' : label === 'Medium' ? 'yellow' : 'red';
}

/**
 * Answers "why did/didn't this student check in today" directly — the mobile app's dwell gate
 * used to fail entirely silently from the backend's point of view, so this is the first place
 * that history becomes visible: every logged weak-signal attempt (server: attendance.service.ts
 * reportClientGateFailure) plus the eventual successful check-in, if any.
 */
export function StudentSignalDrilldown({ open, onClose, classId, studentId, studentName, successfulCheckIn }: Props) {
  const { data: attempts, loading } = useApi<GateAttempt[]>(
    open ? `/attendance/class/${classId}/gate-attempts?userId=${studentId}` : null,
  );

  return (
    <Modal open={open} onClose={onClose} title={`${studentName} — Today's Signal Activity`}>
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {successfulCheckIn && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">Checked in successfully</span>
              {(successfulCheckIn.avgRssi ?? successfulCheckIn.beaconRSSI) != null && (
                <Badge color={signalBadgeColor(successfulCheckIn.avgRssi ?? successfulCheckIn.beaconRSSI!)}>
                  {qualitativeSignalLabel(successfulCheckIn.avgRssi ?? successfulCheckIn.beaconRSSI!)}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {new Date(successfulCheckIn.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} via {successfulCheckIn.checkInType}
            </p>
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

        {!loading && attempts?.length === 0 && !successfulCheckIn && (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">No signal activity recorded for this class today.</p>
        )}

        {attempts?.map((a) => (
          <div key={a.id} className="rounded-xl bg-gray-50 p-3 dark:bg-white/5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-950 dark:text-white">{CHANNEL_LABEL[a.channel]}</span>
              {a.avgRssi != null && <Badge color={signalBadgeColor(a.avgRssi)}>{qualitativeSignalLabel(a.avgRssi)}</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{a.reason}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
              {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {a.sampleCount != null && ` · ${a.sampleCount} signal readings`}
              {a.dwellSeconds != null && ` · held for ${a.dwellSeconds}s`}
            </p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

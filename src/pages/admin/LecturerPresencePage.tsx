import { useState } from 'react';
import { UserCheck, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type LecturerStatus = 'On Time' | 'Late' | 'No Show';

interface LecturerRow {
  id: string;
  name: string;
  scheduledClass: string;
  room: string;
  expectedStart: string;
  actualCheckIn: string | null;
  status: LecturerStatus;
}

interface AuditEntry {
  id: string;
  lecturerId: string;
  lecturerName: string;
  course: string;
  performedBy: string;
  timestamp: string;
  reason: string;
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

const TODAY_DATE = new Date().toDateString();
const baseHour = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const SEED_LECTURERS: LecturerRow[] = [
  {
    id: 'l1', name: 'Dr. James Mwangi',   scheduledClass: 'Database Systems',      room: 'B204',
    expectedStart: baseHour(9, 0),  actualCheckIn: baseHour(8, 55), status: 'On Time',
  },
  {
    id: 'l2', name: 'Prof. Aisha Omondi', scheduledClass: 'Software Engineering',   room: 'Lab A1',
    expectedStart: baseHour(11, 0), actualCheckIn: baseHour(11, 18), status: 'Late',
  },
  {
    id: 'l3', name: 'Mr. Kevin Njoroge',  scheduledClass: 'Data Structures',        room: 'C101',
    expectedStart: baseHour(10, 0), actualCheckIn: null, status: 'No Show',
  },
  {
    id: 'l4', name: 'Dr. Fatuma Hassan',  scheduledClass: 'Networks I',             room: 'B301',
    expectedStart: baseHour(8, 0),  actualCheckIn: baseHour(7, 58), status: 'On Time',
  },
  {
    id: 'l5', name: 'Ms. Grace Wambua',   scheduledClass: 'Linear Algebra',         room: 'A205',
    expectedStart: baseHour(14, 0), actualCheckIn: null, status: 'No Show',
  },
  {
    id: 'l6', name: 'Prof. David Otieno', scheduledClass: 'Intro to CS',            room: 'Main Hall',
    expectedStart: baseHour(13, 0), actualCheckIn: baseHour(12, 59), status: 'On Time',
  },
];

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status }: { status: LecturerStatus }) {
  const map: Record<LecturerStatus, string> = {
    'On Time':  'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    'Late':     'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    'No Show':  'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  };
  const emoji: Record<LecturerStatus, string> = { 'On Time': '🟢', 'Late': '🟡', 'No Show': '🔴' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${map[status]}`}>
      {emoji[status]} {status}
    </span>
  );
}

// ─── Force Check-In Modal ─────────────────────────────────────────────────────

function ForceCheckInModal({
  lecturer,
  onConfirm,
  onCancel,
}: {
  lecturer: LecturerRow;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const MAX = 50;
  const canSubmit = reason.trim().length >= 3 && reason.trim().length <= MAX;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Force Check-In</h3>
            <p className="text-sm text-gray-500 mt-0.5">{lecturer.name} · {lecturer.scheduledClass}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          This action will be permanently logged to the audit trail with your user ID and a server-side timestamp. It cannot be deleted.
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            Reason <span className="text-red-500">*</span>
            <span className="ml-auto float-right text-gray-400 font-normal">{reason.length}/{MAX}</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX))}
            placeholder="e.g. Lecturer physically present, beacon hardware failed"
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm(reason.trim())}
            disabled={!canSubmit}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Confirm Force Check-In
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LecturerPresencePage() {
  const { user } = useAuth();
  const [lecturers, setLecturers] = useState<LecturerRow[]>(SEED_LECTURERS);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [forceTarget, setForceTarget] = useState<LecturerRow | null>(null);

  const onTime = lecturers.filter((l) => l.status === 'On Time').length;
  const late    = lecturers.filter((l) => l.status === 'Late').length;
  const noShow  = lecturers.filter((l) => l.status === 'No Show').length;

  const handleForceCheckIn = (reason: string) => {
    if (!forceTarget) return;
    const now = new Date().toISOString();

    setLecturers((prev) =>
      prev.map((l) =>
        l.id === forceTarget.id
          ? { ...l, status: 'On Time', actualCheckIn: now }
          : l,
      ),
    );

    const entry: AuditEntry = {
      id: Date.now().toString(),
      lecturerId: forceTarget.id,
      lecturerName: forceTarget.name,
      course: forceTarget.scheduledClass,
      performedBy: `${user?.firstName} ${user?.lastName} (${user?.id || 'HOD'})`,
      timestamp: now,
      reason,
    };
    setAuditLog((prev) => [entry, ...prev]);
    setForceTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lecturer Presence</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Staff accountability — {TODAY_DATE}
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onTime}</p>
          <p className="text-xs text-gray-500 mt-0.5">🟢 On Time</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{late}</p>
          <p className="text-xs text-gray-500 mt-0.5">🟡 Late</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{noShow}</p>
          <p className="text-xs text-gray-500 mt-0.5">🔴 No Show</p>
        </div>
      </div>

      {/* Roster grid */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-2">
          <UserCheck size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Today's Lecturer Roster</h2>
        </div>
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Lecturer</th>
              <th>Scheduled Class</th>
              <th>Room</th>
              <th>Expected Start</th>
              <th>Actual Check-In</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="text-slate-800 dark:text-gray-300">
            {lecturers.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {l.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{l.name}</span>
                  </div>
                </td>
                <td>{l.scheduledClass}</td>
                <td className="text-xs font-mono">{l.room}</td>
                <td className="font-mono text-xs">{fmt(l.expectedStart)}</td>
                <td className={`font-mono text-xs ${l.actualCheckIn ? 'text-slate-800 dark:text-gray-300' : 'text-gray-400'}`}>
                  {fmt(l.actualCheckIn)}
                </td>
                <td><StatusPill status={l.status} /></td>
                <td>
                  <button
                    onClick={() => setForceTarget(l)}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                  >
                    <CheckCircle size={12} /> Force Check-In
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit log */}
      <div>
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer mb-3"
        >
          {showAudit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Force Check-In Audit Log ({auditLog.length})
        </button>

        {showAudit && (
          <div className="glass-card overflow-hidden">
            {auditLog.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No forced check-ins recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-white/10">
                  <tr>
                    {['Lecturer', 'Course', 'Performed By', 'Timestamp', 'Reason'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-white/3">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{entry.lecturerName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.course}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{entry.performedBy}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">
                        {new Date(entry.timestamp).toLocaleString('en', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px]">{entry.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Force Check-In Modal */}
      {forceTarget && (
        <ForceCheckInModal
          lecturer={forceTarget}
          onConfirm={handleForceCheckIn}
          onCancel={() => setForceTarget(null)}
        />
      )}

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-gray-400 p-3 rounded-xl bg-gray-50 dark:bg-white/3">
        <Clock size={12} className="flex-shrink-0 mt-0.5" />
        Force Check-In events are append-only and cannot be deleted. Each entry records the HOD's user ID, server-side timestamp, and a mandatory reason.
      </div>
    </div>
  );
}

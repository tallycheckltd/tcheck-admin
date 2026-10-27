import { CalendarClock } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatClassTimeLocal } from '../../utils/classDateDisplay';

/**
 * F4 (10-22) — the record of class changes: cancelled, put back on, moved, switched online or back
 * (F5: and attendance corrected),
 * by whom and why, over the last 60 days. No approvals (owner, 10-22): changes happen straight away
 * and this page is how School Admins and HODs see what was done. A lecturer sees their own classes.
 */

interface Change {
  id: string;
  at: string;
  action: 'class.cancelled' | 'class.restored' | 'class.moved' | 'class.online' | 'class.inPerson' | 'attendance.corrected';
  reason: string | null;
  before: { startTime?: string; endTime?: string; room?: string | null } | null;
  after: { startTime?: string; endTime?: string; room?: string | null } | null;
  by: { name: string; role: string } | null;
  class: { id: string; title: string; startTime: string; endTime: string; room: string | null; isOnline: boolean; course: { code: string; name: string } };
  /** F5 — whose attendance was corrected. */
  student?: { name: string; number: string | null } | null;
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const slot = (s: string, e: string) => `${day(s)}, ${formatClassTimeLocal(s)} – ${formatClassTimeLocal(e)}`;
const stamp = (iso: string) => `${day(iso)} ${new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
const ROLE = (r: string) => (r === 'LECTURER' ? 'lecturer' : r === 'SCHOOL_ADMIN' ? 'School Admin' : r.replace('_', ' ').toLowerCase());
const WHAT = {
  'class.cancelled': ['red', 'Cancelled'],
  'class.restored': ['green', 'Back on'],
  'class.moved': ['yellow', 'Moved'],
  'class.online': ['purple', 'Online'],
  'class.inPerson': ['blue', 'In person'],
  'attendance.corrected': ['gray', 'Attendance corrected'],
} as const;

export function ClassChangesPage() {
  const { user } = useAuth();
  const { data } = useApi<Change[]>('/class-changes');
  const rows = data ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Class changes</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {user?.role === 'LECTURER'
            ? 'Changes to your classes in the last 60 days. Make one from Classes → Change; your HOD is told.'
            : 'Classes cancelled, moved or switched online in the last 60 days — who did it and why. They happen straight away; students are told.'}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No changes yet" description="When a class is cancelled, moved or switched online, it shows here." />
      ) : (
        <div className="glass-card divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((c) => (
            <div key={c.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="font-medium text-slate-950 dark:text-white">{c.class.course.code} · {c.class.title}{c.student ? ` · ${c.student.name}${c.student.number ? ` (${c.student.number})` : ''}` : ''}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {c.action === 'class.moved' && c.before?.startTime && c.before.endTime && c.after?.startTime && c.after.endTime ? (
                    <>{slot(c.before.startTime, c.before.endTime)}{c.before.room ? ` · ${c.before.room}` : ''} → <span className="font-medium text-slate-800 dark:text-slate-200">{slot(c.after.startTime, c.after.endTime)}{c.after.room ? ` · ${c.after.room}` : ''}</span></>
                  ) : (
                    <>{slot(c.class.startTime, c.class.endTime)} · {c.class.isOnline ? 'Online' : c.class.room || 'No room'}</>
                  )}
                </p>
                {c.reason && <p className="text-sm text-slate-800 dark:text-slate-200">“{c.reason}”</p>}
                <p className="text-xs text-slate-500">{c.by ? `${c.by.name} (${ROLE(c.by.role)})` : 'System'} · {stamp(c.at)}</p>
              </div>
              <Badge color={WHAT[c.action]?.[0] ?? 'gray'}>{WHAT[c.action]?.[1] ?? c.action}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

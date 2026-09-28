import type { AuditEvent, LastChanged } from '../../types';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** P5 (A4) — "Last changed 12 Oct 2026, 10:04 by Jane Doe" under an Academics item. */
export function LastChangedLine({ value }: { value?: LastChanged | null }) {
  if (!value) return null;
  return <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-0.5">Last changed {when(value.at)}{value.actorName ? ` by ${value.actorName}` : ''}</p>;
}

const ACTION_LABEL: Record<string, string> = {
  'cohort.created': 'Cohort created', 'cohort.updated': 'Details changed', 'cohort.started': 'Cohort started', 'cohort.completed': 'Cohort completed',
  'cohort.cancelled': 'Cohort cancelled', 'cohort.deleted': 'Cohort deleted', 'cohort.cemAssigned': 'CEM assigned', 'cohort.cemUnassigned': 'CEM unassigned',
  'cohortMember.added': 'Student added', 'cohortMember.removed': 'Student removed', 'cohortMember.deferred': 'Student deferred', 'cohortMember.statusChanged': 'Student status changed',
};

/** P5 (D-11.9) — the audit timeline, newest first (ids only; names resolved server-side at read time). */
export function AuditTimeline({ events }: { events: AuditEvent[] | null | undefined }) {
  if (!events?.length) return <p className="text-sm text-slate-500">Nothing recorded yet.</p>;
  return (
    <ol className="space-y-2" data-testid="audit-timeline">
      {events.map((e) => (
        <li key={e.id} className="text-sm border-l-2 border-blue-200 dark:border-blue-500/30 pl-3">
          <p className="text-slate-900 dark:text-white">{ACTION_LABEL[e.action] ?? e.action}{e.reason ? ` — ${e.reason}` : ''}</p>
          <p className="text-[11px] text-slate-500">{when(e.at)} · {e.actorName ?? (e.actorRole === 'SYSTEM' ? 'System' : 'A former user')}</p>
        </li>
      ))}
    </ol>
  );
}

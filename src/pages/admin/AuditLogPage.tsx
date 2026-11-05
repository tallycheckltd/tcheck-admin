import { AuditLogView } from '../../components/audit/AuditLogView';
import { PageHeader } from '../../components/platform/PlatformUi';

/** 11-02 — the School Admin's Audit log: everything changed in this school, by whom, including when the platform looked. */
export function AuditLogPage() {
  return (
    <div className="space-y-5 max-w-7xl" data-testid="admin-audit">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        subtitle="Every change made in your institution: who made it, what changed and when. It also shows when TCheck's platform team opened this log or acted under support access."
      />
      <AuditLogView base="/audit/events" />
    </div>
  );
}

import { useSearchParams } from 'react-router-dom';
import { ActivityTracker } from '../../components/audit/ActivityTracker';
import { AuditLogView } from '../../components/audit/AuditLogView';
import { PageHeader, Segmented } from '../../components/platform/PlatformUi';

type Tab = 'activity' | 'changes';

/**
 * 11-02 — the School Admin's Audit log: everything changed in this school, by whom, including when the platform looked.
 * 11-11 — now opens on the activity tracker (everything that happens, live); the change log is the second tab.
 */
export function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'changes' ? 'changes' : 'activity';
  return (
    <div className="space-y-5 max-w-7xl" data-testid="admin-audit">
      <PageHeader
        eyebrow="Administration"
        title="Activity & audit"
        subtitle="Everything that happens in your institution, as it happens: check-ins, sign-ins, announcements, emails and every change, with who did it and when. It also shows when TCheck's platform team opened this log or acted under support access."
        actions={(
          <Segmented<Tab> label="View" value={tab} onChange={(t) => setParams(t === 'activity' ? {} : { tab: t }, { replace: true })}
            options={[{ key: 'activity', label: 'Activity tracker' }, { key: 'changes', label: 'Change log' }]} />
        )}
      />
      {tab === 'activity' ? <ActivityTracker /> : <AuditLogView base="/audit/events" />}
    </div>
  );
}

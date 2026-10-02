import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ShieldCheck, History } from 'lucide-react';
import { GrantActivityModal } from './PlatformGrants';

interface Grant {
  id: string; scope: 'ACCOUNT' | 'SETUP'; reason: string; hours: number; state: string; createdAt: string; expiresAt: string | null;
  target: { firstName: string; lastName: string; email: string } | null;
}

/** P10 (A7.7) — the School Admin's side of support access: the platform asks, you decide; access is
 * time-boxed, ends on its own, and every action taken under it is recorded in your audit trail. */
export function PlatformAccessCard() {
  const { data, refetch } = useApi<Grant[]>('/support-grants', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const [activityFor, setActivityFor] = useState<Grant | null>(null);
  if (!data?.length) return null;
  const act = async (id: string, what: 'approve' | 'reject' | 'revoke') => { await api.post(`/support-grants/${id}/${what}`, {}); refetch(); };
  return (
    <section className="glass-card p-4" data-testid="platform-access">
      <h2 className="font-semibold flex items-center gap-2 mb-2"><ShieldCheck size={16} /> Platform access requests</h2>
      <ul className="space-y-2 text-sm">
        {data.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-white/5 pt-2" data-testid="access-request">
            <div>
              <p>{g.scope === 'ACCOUNT' ? `Access to ${g.target ? `${g.target.firstName} ${g.target.lastName} (${g.target.email})` : 'one account'}` : 'Institution Setup'} · {g.hours} h</p>
              <p className="text-xs text-gray-500">{g.reason}{g.expiresAt && g.state === 'ACTIVE' ? ` · ends ${new Date(g.expiresAt).toLocaleString()}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={g.state === 'ACTIVE' ? 'green' : g.state === 'PENDING' ? 'blue' : 'gray'}>{g.state === 'LAPSED' ? 'lapsed' : g.state.toLowerCase()}</Badge>
              {g.state === 'PENDING' && <><Button size="sm" onClick={() => act(g.id, 'approve')} data-testid="approve-access">Approve</Button><Button size="sm" variant="secondary" onClick={() => act(g.id, 'reject')}>Decline</Button></>}
              {g.state === 'ACTIVE' && <Button size="sm" variant="secondary" onClick={() => act(g.id, 'revoke')}>End now</Button>}
              {/* UAT F6 — access transparency: everything the platform did under this grant. */}
              {g.state !== 'PENDING' && <Button size="sm" variant="secondary" onClick={() => setActivityFor(g)}><History size={12} className="mr-1" />Activity</Button>}
            </div>
          </li>
        ))}
      </ul>
      {activityFor && <GrantActivityModal path={`/support-grants/${activityFor.id}/activity`} title="What the platform did" onClose={() => setActivityFor(null)} />}
    </section>
  );
}

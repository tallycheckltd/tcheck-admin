import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { getSupportSession } from '../../lib/supportSession';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { GrantRequestForm, GrantsTable, type PlatformGrant } from '../../components/support/PlatformGrants';
import type { User } from '../../types';
import { useState } from 'react';

/**
 * UAT F6 / §8 (2026-09-29) — Support access, the industry pattern (Customer Lockbox / Access
 * Approval): no standing access; the institution approves each time-boxed request tied to a ticket;
 * "Use access" opens a support session (banner, countdown, End now) in which every call names the
 * grant and is recorded for the institution to see.
 */
export function PlatformGrantsPage() {
  const { data, refetch } = useApi<PlatformGrant[]>('/platform/support-grants');
  return (
    <div className="space-y-6" data-testid="platform-grants">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support access</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Time-boxed access to one institution, approved by its School Admin, recorded action by action and visible to them. Nothing opens until they approve; it ends on its own.</p>
      </div>
      <GrantRequestForm onDone={refetch} />
      <GrantsTable grants={data ?? []} onChanged={refetch} />
    </div>
  );
}

/** The account a support session (ACCOUNT grant) opens: see it, change its status, reset its biometric lock. */
export function PlatformSupportSessionPage() {
  const session = getSupportSession();
  const { data: account, refetch } = useApi<User>(session?.scope === 'ACCOUNT' && session.targetUserId ? `/users/${session.targetUserId}` : null);
  const [notice, setNotice] = useState('');
  if (!session) return <p className="glass-card p-6 text-sm text-gray-500">No support session is open. <Link to="/platform/grants" className="text-blue-600">Support access</Link></p>;
  if (session.scope === 'SETUP') return <p className="glass-card p-6 text-sm">This session covers Institution Setup. <Link to={`/platform/setup/${session.schoolId}`} className="text-blue-600">Open it</Link></p>;
  const run = async (label: string, fn: () => Promise<unknown>) => { setNotice(''); try { await fn(); setNotice(`${label} — done (recorded).`); refetch(); } catch (e) { setNotice(e instanceof Error ? e.message : `${label} failed`); } };
  return (
    <div className="space-y-6 max-w-2xl" data-testid="support-session">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support session — {session.schoolName}</h1>
      {!account ? <p className="text-sm text-gray-500">Loading the account…</p> : (
        <div className="glass-card p-5 space-y-3 text-sm">
          <p className="text-lg font-semibold">{account.firstName} {account.lastName} <span className="text-sm font-normal text-gray-500">{account.email}</span></p>
          <p className="flex gap-2 items-center">Role <Badge color="gray">{account.role}</Badge> Status <Badge color={account.status === 'APPROVED' ? 'green' : 'yellow'}>{account.status}</Badge></p>
          <div className="flex flex-wrap gap-2 pt-2">
            {account.status !== 'APPROVED' && <Button size="sm" onClick={() => void run('Approved the account', () => api.patch(`/users/${account.id}/status`, { status: 'APPROVED' }))}>Approve account</Button>}
            <Button size="sm" variant="secondary" onClick={() => void run('Reset the biometric lock', () => api.post(`/auth/biometric-lock/reset/${account.id}`, {}))}>Reset biometric lock</Button>
          </div>
          <p className="text-xs text-gray-500">Only this account is open. Passwords, face data and messages are never reachable under support access.</p>
          {notice && <p className="text-xs">{notice}</p>}
        </div>
      )}
    </div>
  );
}

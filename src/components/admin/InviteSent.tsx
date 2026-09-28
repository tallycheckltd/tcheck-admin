import { useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

/** P1 (A3.3) — what an admin sees after creating a staff/admin account: nobody picks another
 * person's password any more; the new person gets a single-use "Set your password" email. */
export interface InviteInfo { expiresAt?: string; emailed?: boolean; devLink?: string }

export function InviteSentNotice({ email, invite }: { email: string; invite?: InviteInfo | null }) {
  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300"><MailCheck size={16} /> Invite sent to {email}</p>
      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
        They'll get a "Set your password" link that works once and expires in 7 days. You can resend it from their row.
        {invite && invite.emailed === false && ' (Email delivery is not configured on this server.)'}
      </p>
      {invite?.devLink && (
        <p className="mt-2 break-all text-[11px] text-gray-500 dark:text-gray-400">Development link: <a className="underline" href={invite.devLink}>{invite.devLink}</a></p>
      )}
    </div>
  );
}

export function ResendInviteButton({ userId }: { userId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const resend = async () => {
    setState('sending');
    try {
      await api.post(`/users/${userId}/invite`, {});
      setState('sent');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not resend');
      setState('error');
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={resend} disabled={state === 'sending'} title="Revokes the previous link and emails a fresh one"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 disabled:opacity-50 cursor-pointer">
        <RefreshCw size={12} className={state === 'sending' ? 'animate-spin' : ''} /> {state === 'sent' ? 'Invite resent' : 'Resend invite'}
      </button>
      {state === 'error' && <span className="text-xs text-red-500">{message}</span>}
    </span>
  );
}

export type InviteState = { state: 'PENDING' | 'EXPIRED' | 'ACCEPTED'; expiresAt: string | null };

/** Row badge + resend action for a staff account's invite (nothing once accepted). */
export function InviteStateBadge({ userId, invite }: { userId: string; invite?: InviteState | null }) {
  if (!invite || invite.state === 'ACCEPTED') return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${invite.state === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'}`}>
        {invite.state === 'PENDING' ? 'Invite pending' : 'Invite expired'}
      </span>
      <ResendInviteButton userId={userId} />
    </span>
  );
}

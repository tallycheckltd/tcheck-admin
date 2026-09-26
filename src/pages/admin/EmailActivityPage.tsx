import { useState } from 'react';
import { Mail, AlertTriangle, CheckCircle, Clock, Ban, Filter } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { School } from '../../types';

/**
 * SBS Phase 9 — read-only email activity. What was sent, to whom (masked), and what happened —
 * never the content. Scoped server-side: school admins see their own school only.
 */
interface DeliveryRow {
  id: string; type: string; typeLabel: string; category: string; status: string; statusReason: string | null;
  recipient: string; recipientName: string | null; subject: string | null; attempts: number; error: string | null;
  school: { id: string; name: string } | null; createdAt: string; scheduledFor: string | null;
  sentAt: string | null; deliveredAt: string | null; failedAt: string | null;
}
interface Summary { days: number; total: number; byStatus: Record<string, number> }

const STATUS: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: 'Queued', cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
  PROCESSING: { label: 'Sending', cls: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
  SENT: { label: 'Accepted by provider', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  DELIVERED: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  BOUNCED: { label: 'Bounced', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  COMPLAINED: { label: 'Marked as spam', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
  SUPPRESSED: { label: 'Not sent', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  SKIPPED: { label: 'Not sent', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
};

const REASON: Record<string, string> = {
  UNSUBSCRIBED: 'unsubscribed from programme emails',
  BOUNCED: 'address bounced before',
  COMPLAINED: 'recipient marked earlier mail as spam',
  NO_VALID_ADDRESS: 'no valid email address',
  INACTIVE_ACCOUNT: 'account inactive',
  EMAIL_NOT_CONFIGURED: 'email is not set up on this server',
  ANNOUNCEMENT_WITHDRAWN: 'announcement withdrawn',
  HARD_BOUNCE: 'address does not exist',
  SOFT_BOUNCE: 'temporary bounce',
  DELAYED: 'provider reports a delay',
  MARKED_AS_SPAM: 'marked as spam',
};

const ERROR: Record<string, string> = {
  RATE_LIMITED: 'provider rate limit', TIMEOUT: 'provider timed out', NETWORK_ERROR: 'network error',
  PROVIDER_UNAVAILABLE: 'provider unavailable', PROVIDER_AUTH_FAILED: 'provider credentials rejected',
  REJECTED_BY_PROVIDER: 'rejected by provider', INVALID_SENDER: 'sender address not verified',
  QUOTA_EXCEEDED: 'sending quota reached', TEMPLATE_ERROR: 'could not be built', INTERRUPTED: 'interrupted by a restart',
  INVALID_PROVIDER_RESPONSE: 'unexpected provider response',
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const select = 'rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white';

export function EmailActivityPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const q = new URLSearchParams({ limit: '50', ...(status ? { status } : {}), ...(category ? { category } : {}), ...(schoolId ? { schoolId } : {}), ...(before ? { before } : {}) });
  const { data: rows, loading } = useApi<DeliveryRow[]>(`/email/deliveries?${q}`);
  const { data: summary } = useApi<Summary>(`/email/deliveries/summary?days=7${schoolId ? `&schoolId=${schoolId}` : ''}`);
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);

  const s = summary?.byStatus ?? {};
  const cards = [
    { label: 'Accepted / delivered', value: (s.SENT ?? 0) + (s.DELIVERED ?? 0), icon: <CheckCircle size={16} className="text-emerald-500" /> },
    { label: 'Waiting', value: (s.QUEUED ?? 0) + (s.PROCESSING ?? 0), icon: <Clock size={16} className="text-slate-500" /> },
    { label: 'Failed / bounced', value: (s.FAILED ?? 0) + (s.BOUNCED ?? 0) + (s.COMPLAINED ?? 0), icon: <AlertTriangle size={16} className="text-red-500" /> },
    { label: 'Not sent (opted out, no address…)', value: (s.SUPPRESSED ?? 0) + (s.SKIPPED ?? 0) + (s.CANCELLED ?? 0), icon: <Ban size={16} className="text-amber-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Email activity</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">What TCheck emailed and what happened. Addresses are masked and message content isn't shown. "Accepted by provider" means the provider took the email; "Delivered" is shown only when the provider confirms it.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card p-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">{c.icon} {c.label}</div>
            <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-slate-500">Last 7 days · {summary?.total ?? 0} emails</p>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        {isSuperAdmin && (
          <select value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setBefore(null); }} className={select}>
            <option value="">All schools</option>
            {schools?.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
        )}
        <select value={status} onChange={(e) => { setStatus(e.target.value); setBefore(null); }} className={select}>
          <option value="">Any status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{k === 'SUPPRESSED' ? 'Not sent — opted out / suppressed' : k === 'SKIPPED' ? 'Not sent — skipped' : v.label}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setBefore(null); }} className={select}>
          <option value="">Any kind</option>
          <option value="PROGRAMME">Programme (optional)</option>
          <option value="OPERATIONAL">Operational</option>
          <option value="TRANSACTIONAL">Account &amp; notices</option>
          <option value="SECURITY">Security</option>
        </select>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-gray-200 dark:border-white/10">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Recipient</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => {
              const st = STATUS[r.status] ?? STATUS.QUEUED;
              const detail = [r.statusReason ? REASON[r.statusReason] ?? r.statusReason : null, r.error ? ERROR[r.error] ?? r.error : null].filter(Boolean).join(' · ');
              return (
                <tr key={r.id} className="border-b border-gray-100 dark:border-white/5 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-950 dark:text-white">{r.typeLabel}</p>
                    {r.subject && <p className="text-xs text-slate-500 break-words max-w-xs">{r.subject}</p>}
                    {isSuperAdmin && r.school && <p className="text-xs text-slate-400">{r.school.name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800 dark:text-slate-200">{r.recipientName ?? '—'}</p>
                    <p className="text-xs text-slate-500 font-mono">{r.recipient}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
                    {r.attempts > 1 && <p className="text-xs text-slate-400">{r.attempts} attempts</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {r.deliveredAt ? `Delivered ${fmt(r.deliveredAt)}` : r.sentAt ? `Accepted ${fmt(r.sentAt)}` : r.failedAt ? `Failed ${fmt(r.failedAt)}` : r.scheduledFor && r.status === 'QUEUED' ? `Due ${fmt(r.scheduledFor)}` : `Queued ${fmt(r.createdAt)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows?.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Mail size={16} /> No emails match.</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {before && <button onClick={() => setBefore(null)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 cursor-pointer">Newest</button>}
        {rows && rows.length === 50 && (
          <button onClick={() => setBefore(rows[rows.length - 1].createdAt)} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 cursor-pointer">Older</button>
        )}
      </div>
    </div>
  );
}

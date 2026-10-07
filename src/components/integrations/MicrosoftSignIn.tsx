import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { startMicrosoft } from '../../lib/microsoft';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface Status { serverReady: boolean; connected: boolean; enabled: boolean; tenantId: string | null; linkedStaff: number }

const MicrosoftLogo = () => (
  <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
);

/**
 * Sign in with Microsoft for this school's staff. The School Admin connects once by signing in with
 * their own Microsoft 365 account (its tenant becomes the school's); staff whose TCheck email is in
 * that tenant can then use "Sign in with Microsoft" on the login page. Students are unaffected.
 */
export function MicrosoftSignIn() {
  const { data, refetch } = useApi<Status>('/integrations/microsoft');
  const { mutate: patch, loading } = useMutation('patch');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(() =>
    new URLSearchParams(window.location.search).get('microsoft') === 'connected' ? { ok: true, text: 'Microsoft 365 connected — staff can now use "Sign in with Microsoft".' } : null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [starting, setStarting] = useState(false);

  const connect = async () => {
    setMsg(null); setStarting(true);
    try { await startMicrosoft('connect'); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not open Microsoft' }); setStarting(false); }
  };
  const change = async (body: object, ok: string) => {
    setMsg(null);
    try { await patch('/integrations/microsoft', body); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' }); }
    setConfirmDisconnect(false);
    refetch();
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-4" data-testid="microsoft-sign-in">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-white dark:bg-white flex items-center justify-center shrink-0 shadow"><MicrosoftLogo /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-950 dark:text-white">Microsoft 365 sign-in</h3>
            {data?.connected ? <Badge color={data.enabled ? 'green' : 'gray'}>{data.enabled ? 'On' : 'Off'}</Badge> : <Badge color="gray">Not connected</Badge>}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Staff sign in to the dashboard with their university Microsoft account — no TCheck password or emailed code. Your university's own Microsoft security (including two-step verification) applies. Students keep using the mobile app.</p>
        </div>
      </div>

      {data && !data.serverReady && <p className="text-xs text-amber-600">Sign in with Microsoft isn't set up on this TCheck server yet — contact TCheck support.</p>}

      {data?.connected ? (
        <div className="space-y-3 border-t border-gray-100 dark:border-white/5 pt-3">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <dt className="text-slate-500">Microsoft directory (tenant)</dt><dd className="font-mono text-[11px] text-slate-900 dark:text-slate-100 break-all">{data.tenantId}</dd>
            <dt className="text-slate-500">Staff who have signed in with Microsoft</dt><dd className="text-slate-900 dark:text-slate-100">{data.linkedStaff}</dd>
          </dl>
          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="mt-0.5" checked={data.enabled} disabled={loading} onChange={(e) => void change({ enabled: e.target.checked }, e.target.checked ? 'Microsoft sign-in is on.' : 'Microsoft sign-in is off — staff use their email and password.')} />
            <span>Allow "Sign in with Microsoft" for this school's staff<span className="block text-[11px] text-slate-500">Only accounts in this Microsoft directory whose email matches a TCheck staff account here.</span></span>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={starting || !data.serverReady} onClick={() => void connect()}>Reconnect</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDisconnect(true)}>Disconnect</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">Sign in with <b>your own university Microsoft account</b> (the same email as your TCheck account). That tells TCheck which Microsoft directory is your school's.</p>
          <Button size="sm" disabled={starting || !data?.serverReady} onClick={() => void connect()}>
            <span className="mr-2 inline-flex"><MicrosoftLogo /></span>{starting ? 'Opening Microsoft…' : 'Connect Microsoft 365'}
          </Button>
        </div>
      )}

      {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}

      {confirmDisconnect && (
        <Modal open onClose={() => setConfirmDisconnect(false)} title="Disconnect Microsoft 365?">
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">"Sign in with Microsoft" stops for this school and every staff link is forgotten. Staff sign in with their email and password as before; nothing else changes.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => void change({ disconnect: true }, 'Microsoft 365 disconnected.')}>Disconnect</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

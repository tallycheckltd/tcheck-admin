import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { endSupportSession, getSupportSession, SUPPORT_SESSION_EVENT, type SupportSession } from '../../lib/supportSession';

const left = (iso: string, now: number) => {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h} h ${m} min` : `${m} min`;
};

/**
 * UAT F6 — shown on every page while the Super Admin works under a support grant: whose access it
 * is, what it covers, the time left, and End now (which also ends the grant for the institution).
 * The session closes itself when the grant's time runs out.
 */
export function SupportSessionBanner() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SupportSession | null>(() => getSupportSession());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sync = () => setSession(getSupportSession());
    window.addEventListener(SUPPORT_SESSION_EVENT, sync);
    const t = window.setInterval(() => { setNow(Date.now()); sync(); }, 30_000);
    return () => { window.removeEventListener(SUPPORT_SESSION_EVENT, sync); window.clearInterval(t); };
  }, []);
  if (!session) return null;
  const end = async () => {
    try { await api.post(`/platform/support-grants/${session.grantId}/revoke`, {}); } catch { /* already over — just close the session */ }
    endSupportSession();
    navigate('/platform/grants');
  };
  return (
    <div role="status" className="sticky top-0 z-40 mb-4 rounded-xl bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow">
      <span className="text-sm flex items-center gap-2">
        <ShieldAlert size={16} />
        Support access to <strong>{session.schoolName}</strong> — {session.scope === 'SETUP' ? 'Institution Setup' : 'one account'} · ends in {left(session.expiresAt, now)} · every action is recorded and visible to them
      </span>
      <span className="flex gap-2">
        <button onClick={() => { endSupportSession(); navigate('/platform/grants'); }} className="text-xs rounded-lg px-2.5 py-1 bg-white/20 hover:bg-white/30 cursor-pointer">Leave session</button>
        <button onClick={() => void end()} className="text-xs rounded-lg px-2.5 py-1 bg-white text-amber-700 font-semibold cursor-pointer">End now</button>
      </span>
    </div>
  );
}

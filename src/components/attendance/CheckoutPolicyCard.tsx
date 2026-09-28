import { useState } from 'react';
import { api } from '../../lib/api';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';

/**
 * P14 (D-12A.7) — the institution's check-out completeness setting. OFF = today. SHADOW computes and
 * stores every session's outcome and shows it to staff and students without counting it — run it for
 * a term, look at "If enforced this term, N of M…", tune the minimum stay. ENFORCED is not offered yet.
 */
export function CheckoutPolicyCard({ school, onSaved }: { school: { id: string; strictCheckoutEnabled?: string; checkoutMinStayPercent?: number | null; strictCheckoutSince?: string | null }; onSaved: () => void }) {
  const [mode, setMode] = useState(school.strictCheckoutEnabled ?? 'OFF');
  const [pct, setPct] = useState(String(school.checkoutMinStayPercent ?? 80));
  const [msg, setMsg] = useState('');
  const save = async () => {
    setMsg('');
    try {
      await api.put(`/schools/${school.id}/checkout-policy`, { strictCheckoutEnabled: mode, checkoutMinStayPercent: Number(pct) });
      setMsg('Saved'); onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save'); }
  };
  return (
    <GlassCard>
      <div className="space-y-3 text-sm" data-testid="checkout-policy">
        <h2 className="text-lg font-semibold">Check-out completeness</h2>
        <p className="text-slate-500">A check-in only counts as complete when the student also checks out and stayed at least the minimum share of the session (measured to when most students actually checked out). Walk through it in stages.</p>
        <div className="grid md:grid-cols-3 gap-2">
          {[['OFF', 'Off — as today'], ['SHADOW', 'Shadow — computed and shown, not counted'], ['ENFORCED', 'Enforced — not available yet']].map(([v, label]) => (
            <label key={v} className={`rounded-xl border px-3 py-2 flex gap-2 items-center ${v === 'ENFORCED' ? 'opacity-50' : 'cursor-pointer'}`}>
              <input type="radio" name="checkout-mode" value={v} checked={mode === v} disabled={v === 'ENFORCED'} onChange={() => setMode(v)} /> {label}
            </label>
          ))}
        </div>
        <label className="block">Minimum stay (% of the session)
          <input type="number" min={50} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className="ml-2 w-20 rounded-lg border px-2 py-1 dark:bg-white/5" aria-label="Minimum stay percent" />
        </label>
        {school.strictCheckoutSince && <p className="text-xs text-slate-500">Shadow since {school.strictCheckoutSince.slice(0, 10)} — sessions before that date are never re-scored.</p>}
        <div className="flex items-center gap-3"><Button size="sm" onClick={save} data-testid="save-checkout-policy">Save</Button>{msg && <span className="text-xs">{msg}</span>}</div>
      </div>
    </GlassCard>
  );
}

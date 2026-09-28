import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface HealthTicket { id: string; subject: string; body: string | null; status: string; priority: string; faultType: 'LOW_BATTERY' | 'SILENT' | 'MISMATCH'; createdAt: string; resolvedAt: string | null; resolutionNote: string | null; escalatedToPlatformAt: string | null }
interface Insights { predictions: { beaconId: string; beacon: string; room: string | null; battery: number | null; daysToLow: number | null; swapBy: string | null }[]; atRiskNextWeek: number; outageCorrelation: { classesDuringOutage: number; attendanceDuringOutage: number | null; attendanceOtherwise: number | null } }

const FAULT: Record<HealthTicket['faultType'], string> = { LOW_BATTERY: 'Low battery', SILENT: 'Silent on a class day', MISMATCH: 'Paired to the wrong room' };

/** P12 (A7.6) — the tenant's own beacon-health queue (first stop before the platform) + the
 * intelligence feed: predicted battery swaps, classes at risk next week, outage vs attendance. */
export function BeaconHealthTickets() {
  const { data, refetch } = useApi<HealthTicket[]>('/beacons/health-tickets', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const { data: ins } = useApi<Insights>('/beacons/insights');
  const [err, setErr] = useState('');
  const resolve = async (t: HealthTicket, note: string) => {
    setErr('');
    try { await api.post(`/beacons/health-tickets/${t.id}/resolve`, { note }); refetch(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not resolve'); }
  };
  const open = (data ?? []).filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const soon = (ins?.predictions ?? []).filter((p) => p.daysToLow !== null && p.daysToLow <= 30);
  return (
    <div className="space-y-4" data-testid="beacon-health-tickets">
      <section className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-2">Beacon issues ({open.length} open)</h2>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!open.length ? <p className="text-sm text-gray-500">No open beacon issues.</p> : (
          <ul className="space-y-3">
            {open.map((t) => (
              <li key={t.id} className="border-t border-gray-100 dark:border-white/5 pt-3" data-testid="health-ticket">
                <div className="flex justify-between gap-2 flex-wrap">
                  <p className="font-medium text-sm">{t.subject}</p>
                  <div className="flex gap-1">
                    <Badge color={t.faultType === 'SILENT' ? 'red' : t.faultType === 'LOW_BATTERY' ? 'yellow' : 'purple'}>{FAULT[t.faultType]}</Badge>
                    {t.escalatedToPlatformAt && <Badge color="red">Escalated to Tcheck</Badge>}
                  </div>
                </div>
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-1 font-sans">{t.body}</pre>
                <div className="mt-2 flex gap-2">
                  {t.faultType === 'LOW_BATTERY' && <Button size="sm" onClick={() => resolve(t, 'BATTERY_REPLACED')} data-testid="battery-replaced">Battery replaced</Button>}
                  {t.faultType === 'MISMATCH' && <Button size="sm" onClick={() => resolve(t, 'PAIRING_FIXED')}>Pairing fixed</Button>}
                  {t.faultType === 'SILENT' && <span className="text-xs text-gray-500">Resolves itself when the beacon reports again.</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {ins && (
        <section className="glass-card p-5 text-sm" data-testid="beacon-insights">
          <h2 className="text-lg font-semibold mb-2">Outlook</h2>
          <p>{ins.atRiskNextWeek} class{ins.atRiskNextWeek === 1 ? '' : 'es'} next week in rooms with a faulty beacon.</p>
          {ins.outageCorrelation.classesDuringOutage > 0 && (
            <p>During beacon outages attendance was {ins.outageCorrelation.attendanceDuringOutage ?? '—'}% vs {ins.outageCorrelation.attendanceOtherwise ?? '—'}% otherwise — a dip there is likely hardware, not students.</p>
          )}
          <p className="mt-2 font-medium">Predicted battery swaps (next 30 days)</p>
          {!soon.length ? <p className="text-gray-500">None predicted yet (a trend needs a few readings).</p> : (
            <ul>{soon.map((p) => <li key={p.beaconId}>{p.beacon}{p.room ? ` — ${p.room}` : ''}: {p.battery ?? '?'} % now, swap by {p.swapBy}</li>)}</ul>
          )}
        </section>
      )}
    </div>
  );
}

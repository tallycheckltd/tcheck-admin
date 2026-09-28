import { useApi } from '../../hooks/useApi';
import { Badge } from '../ui/Badge';

/** P14 (D-12A.6) — a class's check-out completeness: counts, the crowd-derived effective end, the
 * class-level flags and the students worth a look. Shown only when the institution is SHADOW/ENFORCED. */
interface Review {
  mode: 'OFF' | 'SHADOW' | 'ENFORCED'; minStayPercent: number; scheduledEnd: string; effectiveEnd: string; usedCrowd: boolean; classFlags: string[];
  counts: { checkedIn: number; checkedOut: number; complete: number; incomplete: number; unscored: number };
  review: { student: { id: string; firstName: string; lastName: string; studentId: string | null }; checkInAt: string; checkOutAt: string | null; outcome: string; flags: string[]; stayedMinutes: number | null; requiredMinutes: number }[];
}
export const CLASS_FLAG_LABEL: Record<string, string> = { ENDED_EARLY: 'Ended much earlier than scheduled', CHECKOUT_UNRELIABLE: 'Check-out data unreliable (under 50 %)', MANY_OUTLIERS: 'Unusual number of outlier check-outs' };
const ROW_FLAG: Record<string, string> = { LEFT_EARLY: 'Left early', LATE_CHECKOUT: 'Checked out much later', NO_CHECKOUT: 'No check-out' };
const t = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

export function CheckoutReview({ classId }: { classId: string }) {
  const { data } = useApi<Review>(`/attendance/class/${classId}/checkout-review`);
  if (!data || data.mode === 'OFF') return null;
  const c = data.counts;
  return (
    <section className="glass-card p-5 space-y-3" data-testid="checkout-review">
      <div className="flex justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Check-out completeness {data.mode === 'SHADOW' && <Badge color="blue">Shadow — not counted yet</Badge>}</h3>
        <p className="text-sm text-slate-500">Effective end {t(data.effectiveEnd)}{data.usedCrowd ? ' (from when most students checked out)' : ' (scheduled — fewer than 5 check-outs)'} · minimum stay {data.minStayPercent} %</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3"><p className="text-xl font-bold">{c.checkedIn}</p><p className="text-slate-500">Checked in</p></div>
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3"><p className="text-xl font-bold">{c.checkedOut}</p><p className="text-slate-500">Checked out</p></div>
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3"><p className="text-xl font-bold text-green-600">{c.complete}</p><p className="text-slate-500">Complete</p></div>
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3"><p className="text-xl font-bold text-amber-600" data-testid="incomplete-count">{c.incomplete}</p><p className="text-slate-500">Incomplete attendance record</p></div>
      </div>
      {data.classFlags.length > 0 && <div className="flex gap-2 flex-wrap">{data.classFlags.map((f) => <Badge key={f} color="yellow">{CLASS_FLAG_LABEL[f] ?? f}</Badge>)}</div>}
      {data.review.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Student</th><th>In</th><th>Out</th><th>Stayed / required</th><th>Outcome</th></tr></thead>
          <tbody>
            {data.review.map((r) => (
              <tr key={r.student.id} className="border-t border-gray-100 dark:border-white/5" data-testid="review-row">
                <td className="py-2">{r.student.firstName} {r.student.lastName}</td>
                <td>{t(r.checkInAt)}</td><td>{t(r.checkOutAt)}</td>
                <td>{r.stayedMinutes ?? '—'} / {r.requiredMinutes} min</td>
                <td>{r.outcome === 'INCOMPLETE' ? 'Incomplete attendance record' : r.outcome === 'COMPLETE' ? 'Complete' : 'Not scored'}{r.flags.length ? ` · ${r.flags.map((f) => ROW_FLAG[f] ?? f).join(', ')}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** The HOD / admin line while SHADOW runs (D-12A.7). */
export function ShadowLine() {
  const { data } = useApi<{ sentence: string; total: number }>('/attendance/checkout-shadow');
  if (!data || !data.total) return null;
  return <p className="rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-200 px-4 py-3 text-sm" data-testid="shadow-line">{data.sentence}</p>;
}

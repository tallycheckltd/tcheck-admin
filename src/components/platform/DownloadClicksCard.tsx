import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useTheme } from '../../context/ThemeContext';
import { seriesColors } from './vizPalette';

type Counts = { app_store: number; google_play: number; direct: number; total: number };
interface Summary { today: Counts; last7d: Counts; last30d: Counts; devices30d: Record<string, number>; daily: ({ day: string } & Counts)[] }

const BUTTONS: { key: keyof Omit<Counts, 'total'>; label: string }[] = [
  { key: 'google_play', label: 'Google Play' },
  { key: 'app_store', label: 'App Store' },
  { key: 'direct', label: 'Download directly' },
];
const DEVICE_LABEL: Record<string, string> = { android: 'Android', ios: 'iPhone', desktop: 'Computer', other: 'Other' };
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * 2026-11-02 — taps on the website's download page (tallycheck.co.ke/tcheck), per button. Counts
 * only. Taps, not installs: Play Console and App Store Connect remain the source for installs.
 */
export function DownloadClicksCard() {
  const { dark } = useTheme();
  const colors = seriesColors(dark);
  const { data } = useApi<Summary>('/platform/download-clicks', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const devices = Object.entries(data?.devices30d ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <section className="glass-card p-5" data-testid="download-clicks">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1"><Download size={16} /> Download page</h2>
      <p className="text-xs text-gray-500 mb-3">Taps on the buttons at tallycheck.co.ke/tcheck. Taps, not installs.</p>
      {!data ? <p className="text-sm text-gray-500">Loading…</p> : !data.last30d.total ? <p className="text-sm text-gray-500">No taps in the last 30 days.</p> : (
        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1">Button</th><th className="py-1 text-right">Today</th><th className="py-1 text-right">7 days</th><th className="py-1 text-right">30 days</th></tr></thead>
              <tbody>
                {BUTTONS.map((b, i) => (
                  <tr key={b.key} className="border-t border-gray-100 dark:border-white/5">
                    <td className="py-1.5 flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colors[i] }} />{b.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{data.today[b.key].toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{data.last7d[b.key].toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{data.last30d[b.key].toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 dark:border-white/10 font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right tabular-nums">{data.today.total.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums">{data.last7d.total.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums">{data.last30d.total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            {devices.length > 0 && (
              <p className="text-xs text-gray-500 mt-3">30 days by device: {devices.map(([d, n]) => `${DEVICE_LABEL[d] ?? d} ${n.toLocaleString()}`).join(' · ')}</p>
            )}
          </div>
          <div className="h-40" aria-label="Taps per day, last 30 days">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="day" tickFormatter={shortDay} interval={6} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(d) => shortDay(String(d))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                {BUTTONS.map((b, i) => <Bar key={b.key} dataKey={b.key} name={b.label} stackId="taps" fill={colors[i]} radius={i === BUTTONS.length - 1 ? [3, 3, 0, 0] : 0} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

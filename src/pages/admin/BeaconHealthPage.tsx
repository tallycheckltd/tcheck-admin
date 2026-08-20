import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Radar, Battery, BatteryLow, BatteryWarning, WifiOff, Wifi } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { format } from 'date-fns';
import type { Beacon } from '../../types';

const OFFLINE_AFTER_MS = 48 * 60 * 60 * 1000;

function batteryTier(level: number | null | undefined): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (level === null || level === undefined) return 'unknown';
  if (level > 40) return 'healthy';
  if (level >= 15) return 'warning';
  return 'critical';
}

function isOffline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - new Date(lastSeenAt).getTime() > OFFLINE_AFTER_MS;
}

const TIER_COLOR: Record<ReturnType<typeof batteryTier>, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  unknown: 'text-gray-400',
};

export function BeaconHealthPage() {
  const { data: beacons, loading } = useApi<Beacon[]>('/beacons', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return (beacons ?? [])
      .filter((b) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || (b.location ?? '').toLowerCase().includes(q) || b.uuid.toLowerCase().includes(q);
      })
      .map((b) => ({ ...b, tier: batteryTier(b.batteryLevel), offline: isOffline(b.lastSeenAt) }))
      .sort((a, b) => {
        // Offline and critical-battery beacons surface first — the ones that actually need attention.
        if (a.offline !== b.offline) return a.offline ? -1 : 1;
        return (a.batteryLevel ?? 100) - (b.batteryLevel ?? 100);
      });
  }, [beacons, search]);

  const criticalCount = rows.filter((r) => r.tier === 'critical').length;
  const offlineCount = rows.filter((r) => r.offline).length;
  const healthyCount = rows.filter((r) => r.tier === 'healthy' && !r.offline).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Radar className="text-blue-500" /> Beacon Health
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Live hardware telemetry — battery level and last-sync status for every registered TB beacon.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Healthy" value={healthyCount} icon={<Battery size={24} />} color="green" />
        <StatCard title="Low / Critical Battery" value={criticalCount} icon={<BatteryWarning size={24} />} color="red" />
        <StatCard title="Offline (48h+)" value={offlineCount} icon={<WifiOff size={24} />} color="orange" />
      </div>

      <div className="max-w-md">
        <SearchInput placeholder="Search by name, room, or UUID..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="glass-card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Radar} title="No beacons match" description="Try a different search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left py-3 px-6">Room Assignment</th>
                  <th className="text-left py-3 px-6">Beacon MAC / ID</th>
                  <th className="text-left py-3 px-6">Battery Level</th>
                  <th className="text-left py-3 px-6">Last Sync</th>
                  <th className="text-left py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900 dark:text-white">{b.location || b.name}</p>
                      <p className="text-xs text-gray-400">{b.name}</p>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-gray-500 truncate max-w-[160px]">{b.uuid}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {b.tier === 'critical' ? <BatteryWarning size={16} className={TIER_COLOR[b.tier]} />
                          : b.tier === 'warning' ? <BatteryLow size={16} className={TIER_COLOR[b.tier]} />
                          : <Battery size={16} className={TIER_COLOR[b.tier]} />}
                        <span className={`font-bold tabular-nums ${TIER_COLOR[b.tier]}`}>
                          {b.batteryLevel === null || b.batteryLevel === undefined ? '—' : `${b.batteryLevel}%`}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-500">
                      {b.lastSeenAt ? format(new Date(b.lastSeenAt), 'MMM d, h:mm a') : 'Never'}
                    </td>
                    <td className="py-4 px-6">
                      {b.offline ? (
                        <Badge color="red"><span className="flex items-center gap-1"><WifiOff size={11} /> Offline</span></Badge>
                      ) : (
                        <Badge color="green"><span className="flex items-center gap-1"><Wifi size={11} /> Online</span></Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

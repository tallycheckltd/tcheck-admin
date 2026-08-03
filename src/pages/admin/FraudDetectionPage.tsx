import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import {
  AlertTriangle, Users, Battery, Shield, ChevronDown, UserCheck, Smartphone,
  CheckCircle, RefreshCw
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { format } from 'date-fns';

interface FraudFlaggedAttendance {
  id: string;
  deviceId: string;
  user: { firstName: string; lastName: string; studentId?: string | null };
  class: { title: string; course: { code: string } };
  flagReason: string;
  beaconRSSI: number;
  dwellTime: number;
  checkInAt: string;
}

interface FraudSuspiciousPair {
  id: string;
  deviceId: string;
  deviceModel: string | null;
  coAttendanceCount: number;
  users: { id: string; firstName: string; lastName: string; studentId: string | null }[];
  lastSeenAt: string;
}

interface FraudLowBatteryBeacon {
  beaconUUID: string;
  location: string;
  voltage: number;
}

interface FraudAnalytics {
  flaggedAttendances: FraudFlaggedAttendance[];
  suspiciousPairs: FraudSuspiciousPair[];
  lowBatteryBeacons: FraudLowBatteryBeacon[];
  deviceStats: {
    total: number;
    bound: number;
    unbound: number;
  };
}

const FRAUD_REFRESH_MS = 30_000;

const initialsOf = (u: { firstName: string; lastName: string }) => `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase();
const avatarPalette = ['bg-blue-100 text-blue-600', 'bg-indigo-100 text-indigo-600', 'bg-purple-100 text-purple-600', 'bg-rose-100 text-rose-600'];

export function FraudDetectionPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi<FraudAnalytics>('/attendance/fraud-analytics', {
    refetchIntervalMs: FRAUD_REFRESH_MS,
    refetchWhenVisible: true,
  });
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center px-4">
        <AlertTriangle className="text-red-500" size={36} />
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button variant="secondary" onClick={() => refetch()} className="gap-2">
          <RefreshCw size={14} /> Retry
        </Button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const boundPercentage = data.deviceStats.total > 0
    ? Math.round((data.deviceStats.bound / data.deviceStats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-red-500" />
            Fraud Detection & Monitoring
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Multi-layered analysis for buddy punching and device security · refreshes every 30s</p>
        </div>
        <div className="hidden sm:flex gap-2">
           <Badge color="red">{data.flaggedAttendances.length} Active Flags</Badge>
           <Badge color="blue">{data.deviceStats.bound} Bound Devices</Badge>
        </div>
      </div>

      {/* 1. Device Binding Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Smartphone size={20} />
              </div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Device Binding Health</h3>
            </div>
            <span className="text-xs font-bold text-blue-500">{boundPercentage}%</span>
          </div>
          <div className="space-y-3">
            <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${boundPercentage}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{data.deviceStats.bound} Bound</span>
              <span className="text-gray-500">{data.deviceStats.unbound} Unbound</span>
            </div>
          </div>
        </div>

        <div>
          <StatCard
            title="Security Alerts"
            value={data.flaggedAttendances.length}
            color="red"
            size="compact"
            icon={<AlertTriangle size={20} />}
          />
          <p className="text-[10px] text-gray-400 mt-2 px-1">Check-ins from a device shared with another account, last 90 days</p>
        </div>

        <div>
          <StatCard
            title="Device Sharing"
            value={data.suspiciousPairs.length}
            color="orange"
            size="compact"
            icon={<Users size={20} />}
          />
          <p className="text-[10px] text-gray-400 mt-2 px-1">Distinct devices used by more than one student</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* 2. Flagged Attendances */}
        <div className="xl:col-span-2 glass-card overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
               <AlertTriangle size={20} className="text-red-500" />
               Flagged Check-ins
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 dark:bg-transparent border-b border-gray-100 dark:border-white/5">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Class/Course</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Telemetry</th>
                  <th className="px-6 py-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {data.flaggedAttendances.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{f.user.firstName} {f.user.lastName}</div>
                      <div className="text-xs text-gray-400 font-mono">{f.user.studentId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-blue-600 dark:text-blue-400 font-medium">{f.class.course.code}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[150px]">{f.class.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge color="red">{f.flagReason}</Badge>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-mono text-gray-500">
                      RSSI: {f.beaconRSSI}dBm <br/>
                      Dwell: {f.dwellTime}s
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {format(new Date(f.checkInAt), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
                {data.flaggedAttendances.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="text-green-500" size={24} />
                      </div>
                      <p className="text-sm text-gray-500 italic">No flags currently detected.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Beacon Battery Health */}
        <div className="glass-card flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-white/5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
               <Battery size={20} className="text-green-500" />
               Beacon Health
            </h2>
          </div>
          <div className="p-6 flex-1 space-y-4">
            {data.lowBatteryBeacons.map((b) => (
              <div key={b.beaconUUID} className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-red-500/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-red-500 text-sm truncate pr-2">{b.location}</div>
                  <Badge color="red">
                    {b.voltage.toFixed(2)}V
                  </Badge>
                </div>
                <div className="text-[10px] text-gray-400 truncate mb-2">ID: {b.beaconUUID.slice(0, 18)}...</div>
                <div className="text-[10px] uppercase text-red-500 font-bold tracking-wider">
                   Action: Low Voltage Detected
                </div>
              </div>
            ))}
            {data.lowBatteryBeacons.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                  <Battery className="text-green-500" size={32} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">All systems healthy</p>
                <p className="text-xs text-gray-500 mt-1 px-4">No beacons reporting low battery levels today.</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Suspicious Pairs / Device Sharing */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
             <Users size={20} className="text-orange-500" />
             Device Sharing Patterns
          </h2>
          <p className="text-xs text-gray-500 mb-6">Devices used by more than one student to check in (buddy punching indicator) — last 90 days.</p>
          <div className="space-y-3">
            {data.suspiciousPairs.map((p) => {
              const isExpanded = expandedDeviceId === p.deviceId;
              const relatedFlags = data.flaggedAttendances.filter((f) => f.deviceId === p.deviceId);
              return (
                <div key={p.id} className="rounded-xl border border-orange-500/10 bg-orange-500/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedDeviceId(isExpanded ? null : p.deviceId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-orange-500/10 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex -space-x-3 flex-shrink-0">
                        {p.users.slice(0, 4).map((u, i) => (
                          <div
                            key={u.id}
                            title={`${u.firstName} ${u.lastName}`}
                            className={`w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold ${avatarPalette[i % avatarPalette.length]}`}
                          >
                            {initialsOf(u)}
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {p.users.map((u) => `${u.firstName} ${u.lastName}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {p.coAttendanceCount} check-ins {p.deviceModel ? `· ${p.deviceModel}` : ''} · last {format(new Date(p.lastSeenAt), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`text-orange-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-orange-500/10 bg-white/60 dark:bg-black/10 p-4 space-y-2">
                      <p className="text-[10px] text-gray-400 font-mono truncate">Device ID: {p.deviceId}</p>
                      {relatedFlags.map((f) => (
                        <div key={f.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{f.user.firstName} {f.user.lastName}</span>
                          <span className="text-gray-500">{f.class.course.code}</span>
                          <span className="text-gray-400">{format(new Date(f.checkInAt), 'MMM d, HH:mm')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {data.suspiciousPairs.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="text-blue-500" size={24} />
                </div>
                <p className="text-sm text-gray-400 italic">No recurring sharing patterns detected.</p>
              </div>
            )}
          </div>
        </div>

        {/* 5. Security Strategy & Recommendations */}
        <div className="xl:col-span-2 glass-card overflow-hidden">
          <div className="md:flex h-full">
            <div className="md:w-1/3 bg-blue-600 p-8 flex flex-col justify-center items-center text-center">
              <div className="p-4 bg-white/10 rounded-3xl mb-4 border border-white/20">
                <Smartphone className="text-white" size={40} />
              </div>
              <h3 className="text-white font-extrabold text-xl mb-2">Device Binding</h3>
              <p className="text-blue-100 text-xs">Enforced at login, platform-wide</p>
            </div>
            <div className="md:w-2/3 p-8 flex flex-col justify-center">
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2 flex items-center gap-2">
                Security Recommendation
                <Badge color="blue">Active Strategy</Badge>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Every student account now auto-binds to one device on their first login — no manual setup required.
                Currently <span className="text-blue-600 font-bold">{data.deviceStats.bound} students</span> are bound;
                the remaining <span className="font-bold">{data.deviceStats.unbound}</span> simply haven't logged in
                since this shipped — they'll bind automatically the next time they do, nothing to force.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/admin/device-verification')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
                >
                  Review Device Verification Queue
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

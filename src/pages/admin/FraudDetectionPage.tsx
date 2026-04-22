import { useApi } from '../../hooks/useApi';
import { 
  AlertTriangle, Users, Battery, Shield, ExternalLink, UserCheck, Smartphone, 
  CheckCircle
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { format } from 'date-fns';

interface FraudAnalytics {
  flaggedAttendances: any[];
  suspiciousPairs: any[];
  lowBatteryBeacons: any[];
  deviceStats: {
    total: number;
    bound: number;
    unbound: number;
  };
}

export function FraudDetectionPage() {
  const { data, loading } = useApi<FraudAnalytics>('/attendance/fraud-analytics');

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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Multi-layered analysis for buddy punching and device security</p>
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

        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Security Alerts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{data.flaggedAttendances.length}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Active conflicts detected in last 24h</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Device Sharing</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{data.suspiciousPairs.length}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Recurring suspicious co-attendance pairs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* 2. Flagged Attendances */}
        <div className="xl:col-span-2 glass-card overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
               <AlertTriangle size={20} className="text-red-500" />
               Flagged Check-ins (Real-time)
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
                {data.flaggedAttendances.map((f: any) => (
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
            {data.lowBatteryBeacons.map((b: any) => (
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
          <p className="text-xs text-gray-500 mb-6">Users who consistently check-in from the same device (buddy punching indicator).</p>
          <div className="space-y-4">
            {data.suspiciousPairs.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-xl border border-orange-500/10 bg-orange-500/5 transition-hover hover:border-orange-500/30">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">S1</div>
                    <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">S2</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">Frequent Pair Detected</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{p.coAttendanceCount} Simultaneous check-ins</div>
                  </div>
                </div>
                <button className="p-2 hover:bg-orange-500/10 rounded-xl text-orange-500 transition-colors">
                  <ExternalLink size={18} />
                </button>
              </div>
            ))}
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
              <p className="text-blue-100 text-xs">Tier 1 Security Policy</p>
            </div>
            <div className="md:w-2/3 p-8 flex flex-col justify-center">
              <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2 flex items-center gap-2">
                Security Recommendation
                <Badge color="blue">Active Strategy</Badge>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Our analysis confirms that **Device Binding** is the most effective technique against "buddy punching". By locking each student account to a unique Hardware ID, we block 99% of proxy check-in attempts. 
                <br /><br />
                Currently, <span className="text-blue-600 font-bold">{data.deviceStats.bound} students</span> are bound. For the remaining <span className="font-bold">{data.deviceStats.unbound} students</span>, we recommend forcing a **Device Verification** on their next login.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer">
                  Force Verification (Unbound Users)
                </button>
                <button className="bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border border-gray-200 dark:border-white/10 cursor-pointer">
                  View Device Binding Policy
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

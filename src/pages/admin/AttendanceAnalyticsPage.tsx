import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart3, Clock, Users, BookOpen, Activity } from 'lucide-react';

const MIN_ATTENDANCE_THRESHOLD = 75;

// ─── Dummy data ────────────────────────────────────────────────────────────────

const TREND_DATA = [
  { week: 'Feb 24', avg: 78, threshold: 75 },
  { week: 'Mar 3',  avg: 74, threshold: 75 },
  { week: 'Mar 10', avg: 71, threshold: 75 },
  { week: 'Mar 17', avg: 68, threshold: 75 },
];

const AT_RISK_STUDENTS = [
  { id: '1', name: 'Brian Ochieng',   score: 38, pct: 58, trend: 'down' as const, recentMissed: 5 },
  { id: '2', name: 'Amina Hassan',    score: 44, pct: 62, trend: 'down' as const, recentMissed: 4 },
  { id: '3', name: 'David Mwangi',    score: 51, pct: 65, trend: 'stable' as const, recentMissed: 2 },
  { id: '4', name: 'Lena Kariuki',    score: 56, pct: 68, trend: 'up' as const, recentMissed: 1 },
  { id: '5', name: 'James Otieno',    score: 42, pct: 61, trend: 'down' as const, recentMissed: 4 },
  { id: '6', name: 'Zara Ahmed',      score: 62, pct: 72, trend: 'stable' as const, recentMissed: 2 },
];

const COHORT_BENCHMARK = [
  { course: 'Intro to CS',           pct: 61, levelAvg: 74, delta: -13 },
  { course: 'Linear Algebra',        pct: 63, levelAvg: 74, delta: -11 },
  { course: 'Database Systems',      pct: 66, levelAvg: 74, delta: -8  },
  { course: 'Networks I',            pct: 70, levelAvg: 74, delta: -4  },
  { course: 'Software Engineering',  pct: 76, levelAvg: 74, delta: +2  },
  { course: 'OS Fundamentals',       pct: 79, levelAvg: 74, delta: +5  },
  { course: 'Data Structures',       pct: 83, levelAvg: 74, delta: +9  },
];

const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HEATMAP_SLOTS = ['7AM', '8AM', '9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM'];
const HEATMAP_DATA: Record<string, Record<string, number>> = {
  Mon:  { '7AM':45,'8AM':52,'9AM':68,'10AM':76,'11AM':78,'12PM':70,'1PM':72,'2PM':74,'3PM':73,'4PM':69,'5PM':58,'6PM':50,'7PM':44,'8PM':40 },
  Tue:  { '7AM':48,'8AM':55,'9AM':71,'10AM':79,'11AM':82,'12PM':73,'1PM':75,'2PM':77,'3PM':76,'4PM':71,'5PM':62,'6PM':53,'7PM':47,'8PM':42 },
  Wed:  { '7AM':43,'8AM':49,'9AM':65,'10AM':74,'11AM':76,'12PM':68,'1PM':70,'2PM':72,'3PM':71,'4PM':67,'5PM':55,'6PM':48,'7PM':42,'8PM':38 },
  Thu:  { '7AM':50,'8AM':57,'9AM':72,'10AM':80,'11AM':83,'12PM':75,'1PM':77,'2PM':79,'3PM':78,'4PM':73,'5PM':64,'6PM':55,'7PM':49,'8PM':44 },
  Fri:  { '7AM':41,'8AM':46,'9AM':60,'10AM':68,'11AM':70,'12PM':62,'1PM':64,'2PM':66,'3PM':65,'4PM':61,'5PM':50,'6PM':42,'7PM':37,'8PM':33 },
};

const LECTURER_DATA = [
  { name: 'Dr. James Mwangi',   classes: 18, avg: 61, trend: 'down' as const },
  { name: 'Prof. Aisha Omondi', classes: 14, avg: 66, trend: 'stable' as const },
  { name: 'Mr. Kevin Njoroge',  classes: 22, avg: 70, trend: 'up' as const },
  { name: 'Dr. Fatuma Hassan',  classes: 16, avg: 74, trend: 'stable' as const },
  { name: 'Ms. Grace Wambua',   classes: 20, avg: 79, trend: 'up' as const },
  { name: 'Prof. David Otieno', classes: 12, avg: 85, trend: 'up' as const },
];

const TRAJECTORY_DATA = [
  { course: 'Intro to CS',          current: 61, projected: 56, weeksLeft: 6,  status: 'miss' as const },
  { course: 'Linear Algebra',       current: 63, projected: 60, weeksLeft: 6,  status: 'miss' as const },
  { course: 'Database Systems',     current: 66, projected: 71, weeksLeft: 6,  status: 'risk' as const },
  { course: 'Networks I',           current: 70, projected: 73, weeksLeft: 6,  status: 'risk' as const },
  { course: 'Software Engineering', current: 76, projected: 79, weeksLeft: 6,  status: 'ok' as const },
  { course: 'OS Fundamentals',      current: 79, projected: 82, weeksLeft: 6,  status: 'ok' as const },
  { course: 'Data Structures',      current: 83, projected: 86, weeksLeft: 6,  status: 'ok' as const },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TrendArrow = ({ trend }: { trend: 'up' | 'stable' | 'down' }) => {
  if (trend === 'up')     return <TrendingUp size={14} className="text-emerald-500" />;
  if (trend === 'down')   return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
};

function heatColor(pct: number): string {
  if (pct >= 85) return 'bg-emerald-600 text-white';
  if (pct >= 75) return 'bg-emerald-400 text-white';
  if (pct >= 65) return 'bg-yellow-400 text-gray-900';
  if (pct >= 55) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

function riskBadge(score: number) {
  if (score > 75) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">On Track</span>;
  if (score >= 50) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Medium Risk</span>;
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400">High Risk</span>;
}

function trajectoryPill(status: 'ok' | 'risk' | 'miss') {
  if (status === 'ok')   return <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">🟢 On Track</span>;
  if (status === 'risk') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">🟡 At Risk</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400">🔴 Will Miss Threshold</span>;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex-shrink-0">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AttendanceAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Risk intelligence and macro trends — last 4 weeks
        </p>
      </div>

      {/* 1. Department Trend Line */}
      <Section
        icon={<TrendingUp size={18} className="text-blue-500" />}
        title="Department Trend Line"
        subtitle="4-week average attendance. Dashed red line = 75% minimum target."
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={TREND_DATA} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis domain={[50, 100]} tick={{ fontSize: 12 }} unit="%" />
            <Tooltip
              formatter={(v: number | string | undefined) => [`${v ?? 0}%`]}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <ReferenceLine y={MIN_ATTENDANCE_THRESHOLD} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '75% min', position: 'right', fontSize: 10, fill: '#ef4444' }} />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#3b82f6' }}
              name="Dept Avg %"
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-400 text-center">
          Current trajectory: <span className="text-red-500 font-medium">↓ declining</span> — intervention recommended
        </p>
      </Section>

      {/* 2. Retention Risk Score */}
      <Section
        icon={<AlertTriangle size={18} className="text-amber-500" />}
        title="Retention Risk Score"
        subtitle="Recent absences weighted 3× vs older ones. High Risk = below 50 pts."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10">
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Semester %</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Risk Score</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Trend</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Missed</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {AT_RISK_STUDENTS.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                  <td className="py-3">
                    <span className={`font-medium ${s.pct < 60 ? 'text-red-500' : s.pct < 75 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {s.pct}%
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`text-lg font-bold ${s.score < 50 ? 'text-red-500' : s.score < 75 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {s.score}
                    </span>
                  </td>
                  <td className="py-3"><TrendArrow trend={s.trend} /></td>
                  <td className="py-3">
                    <span className={`text-sm font-medium ${s.recentMissed >= 4 ? 'text-red-500' : s.recentMissed >= 2 ? 'text-amber-500' : 'text-gray-600 dark:text-gray-400'}`}>
                      {s.recentMissed} consecutive
                    </span>
                  </td>
                  <td className="py-3">{riskBadge(s.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3. Cohort Benchmarking */}
      <Section
        icon={<BarChart3 size={18} className="text-purple-500" />}
        title="Cohort Benchmarking"
        subtitle="Each course vs department level average. Sorted by delta — worst first."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10">
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Course</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Attendance %</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Level Avg %</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {COHORT_BENCHMARK.map((row) => (
                <tr key={row.course} className={`hover:bg-gray-50 dark:hover:bg-white/3 transition-colors ${row.delta <= -15 ? 'bg-red-50/50 dark:bg-red-500/5' : ''}`}>
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{row.course}</td>
                  <td className="py-3 text-right text-slate-800 dark:text-gray-300">{row.pct}%</td>
                  <td className="py-3 text-right text-gray-500">{row.levelAvg}%</td>
                  <td className={`py-3 text-right font-bold ${row.delta < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {row.delta > 0 ? '+' : ''}{row.delta} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 4. Time-of-Day Heatmap */}
      <Section
        icon={<Clock size={18} className="text-orange-500" />}
        title="Time-of-Day & Day-of-Week Heatmap"
        subtitle="Avg attendance % by hour and day. Dark green = high attendance, dark red = low."
      >
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Day headers */}
            <div className="grid grid-cols-6 gap-1 mb-1">
              <div /> {/* empty slot column */}
              {HEATMAP_DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 pb-1">{d}</div>
              ))}
            </div>
            {/* Rows */}
            {HEATMAP_SLOTS.map((slot) => (
              <div key={slot} className="grid grid-cols-6 gap-1 mb-1">
                <div className="text-xs text-gray-400 flex items-center justify-end pr-2">{slot}</div>
                {HEATMAP_DAYS.map((day) => {
                  const pct = HEATMAP_DATA[day]?.[slot] ?? 0;
                  return (
                    <div
                      key={day}
                      title={`${day} ${slot}: ${pct}%`}
                      className={`h-7 rounded flex items-center justify-center text-[10px] font-medium ${heatColor(pct)} cursor-default`}
                    >
                      {pct}%
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-gray-400">Legend:</span>
          {[['≥85%', 'bg-emerald-600'], ['75–84%', 'bg-emerald-400'], ['65–74%', 'bg-yellow-400'], ['55–64%', 'bg-orange-400'], ['<55%', 'bg-red-500']].map(([label, bg]) => (
            <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-3 h-3 rounded ${bg}`} />
              {label}
            </span>
          ))}
        </div>
      </Section>

      {/* 5. Lecturer Correlation */}
      <Section
        icon={<Users size={18} className="text-cyan-500" />}
        title="Lecturer Correlation View"
        subtitle="Aggregate attendance rate per lecturer. Sorted lowest first. No individual student data."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10">
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Lecturer</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Classes Taught</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Attendance %</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {LECTURER_DATA.map((l) => (
                <tr key={l.name} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{l.name}</td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-400">{l.classes}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${l.avg >= 75 ? 'bg-emerald-500' : l.avg >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                          style={{ width: `${l.avg}%` }}
                        />
                      </div>
                      <span className={`font-semibold ${l.avg >= 75 ? 'text-emerald-600 dark:text-emerald-400' : l.avg >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {l.avg}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pl-4"><TrendArrow trend={l.trend} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Course Completion Trajectory */}
      <Section
        icon={<BookOpen size={18} className="text-indigo-500" />}
        title="Course Completion Trajectory"
        subtitle={`Linear projection to end of semester. Threshold = ${MIN_ATTENDANCE_THRESHOLD}%.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10">
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Course</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Avg %</th>
                <th className="text-right pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Projected Final %</th>
                <th className="text-center pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Weeks Left</th>
                <th className="text-left pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {TRAJECTORY_DATA.map((row) => (
                <tr key={row.course} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{row.course}</td>
                  <td className="py-3 text-right text-slate-800 dark:text-gray-300">{row.current}%</td>
                  <td className={`py-3 text-right font-semibold ${row.projected >= MIN_ATTENDANCE_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {row.projected}%
                  </td>
                  <td className="py-3 text-center text-gray-500">{row.weeksLeft}</td>
                  <td className="py-3">{trajectoryPill(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <Activity size={12} />
          Threshold variable: <code className="font-mono text-blue-500">MIN_ATTENDANCE_THRESHOLD = {MIN_ATTENDANCE_THRESHOLD}%</code>
        </div>
      </Section>
    </div>
  );
}

import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { School, Users, Radio, LifeBuoy, Battery, AlertTriangle, CheckCircle2, Clock, Smartphone, Cpu, ChevronRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useTheme } from '../../context/ThemeContext';
import { seriesColors } from '../../components/platform/vizPalette';

interface Home {
  tenants: number; activeStudents: { seat: number; usage30d: number }; checkInsToday: number; openSupportTickets: number; beaconsNeedingAttention: number;
  attention: { kind: string; text: string; link: string }[];
  institutions: { name: string; schools: { id: string; name: string; students: number; checkInsToday: number; beacons: number; tickets: number; isolated: boolean }[] }[];
  jobs: { name: string; lastFinishedAt: string | null; ok: boolean | null; late: boolean; lastError: string | null; runs: number; failures: number; everyMinutes: number | null }[];
  appVersions: { platform: string; version: string; people: number }[];
}
interface Series { series: Record<string, { label: string; value: number | null }[]> }
interface Onb { rows: { schoolId: string; name: string; completedAt: string | null; windowOpen: boolean; isolated: boolean; activation: { roster: number; claimed: number; firstCheckIn: number }; checklist: { done: boolean }[] }[] }

const JOB_LABEL: Record<string, string> = {
  purgeExpiredSelfies: 'Selfie purge', purgeAudit: 'Audit retention', beaconSweep: 'Beacon health', checkoutSweep: 'Check-out outcomes', benchmark: 'Benchmarks',
  syncTerms: 'Term switch-over', scheduledDirectoryStaging: 'Directory sync', purgeOldNotifications: 'Notification clean-up', sendBirthdayNotifications: 'Birthdays',
  runClassNotificationSweep: 'Class reminders', sweepFacilityTicketSlaBreaches: 'Facilities 5-min clock', runMonthlySnapshots: 'Monthly snapshots', sendMaterialReminders: 'Material reminders', announceNewMaterials: 'Material announcements',
  expireStaleFacilityTickets: 'Facilities midnight reset', sendCemWelcomes: 'CEM welcomes', runAnnouncementSweep: 'Scheduled announcements', processEmailQueue: 'Email queue', runCemDigestSweep: 'CEM digest',
};
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function Stat({ icon, label, value, spark, color, to }: { icon: React.ReactNode; label: string; value: number; spark?: { label: string; value: number | null }[]; color: string; to: string }) {
  return (
    <Link to={to} className="glass-card p-4 flex flex-col gap-1 hover:ring-2 hover:ring-blue-400/40 transition-shadow">
      <span className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</span>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</span>
      <div className="h-9">
        {spark?.some((p) => p.value !== null) && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark.map((p) => ({ label: p.label, v: p.value }))} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip formatter={(v) => [String(v ?? '—'), '']} labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string } | undefined)?.label ?? ''} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Link>
  );
}

/**
 * UAT §1 (2026-09-29) — the Watchtower home: headline counts (with their monthly trend), what needs
 * attention (each line links to where it's fixed), onboarding in progress, institutions at a glance,
 * background job health and app versions in the field. Counts only — never a person's record.
 */
export function PlatformHomePage() {
  const { dark } = useTheme();
  const color = seriesColors(dark)[0]!;
  const { data } = useApi<Home>('/platform/home', { refetchIntervalMs: 60_000, refetchWhenVisible: true });
  const { data: spark } = useApi<Series>('/platform/analytics/series?scope=platform&metrics=t0.students_active,t0.check_ins&granularity=month');
  const { data: onb } = useApi<Onb>('/platform/onboarding');
  const inProgress = (onb?.rows ?? []).filter((r) => !r.completedAt && !r.isolated).slice(0, 6);
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  const failing = data.jobs.filter((j) => j.ok === false || j.late);
  return (
    <div className="space-y-6" data-testid="platform-home">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Watchtower</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Health across every institution — counts only, never a person's record.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat icon={<School size={14} />} label="Tenants" value={data.tenants} color={color} to="/platform/institutions" />
        <Stat icon={<Users size={14} />} label="Active students (seats)" value={data.activeStudents.seat} spark={spark?.series['t0.students_active']} color={color} to="/platform/billing" />
        <Stat icon={<Radio size={14} />} label="Check-ins today" value={data.checkInsToday} spark={spark?.series['t0.check_ins']} color={color} to="/platform/analytics" />
        <Stat icon={<LifeBuoy size={14} />} label="Open support tickets" value={data.openSupportTickets} color={color} to="/platform/support" />
        <Stat icon={<Battery size={14} />} label="Beacons needing attention" value={data.beaconsNeedingAttention} color={color} to="/platform/fleet" />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <section className="glass-card p-5 lg:col-span-3">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-amber-500" /> Needs attention</h2>
          {!data.attention.length ? <p className="text-sm text-gray-500 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Nothing needs attention right now.</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {data.attention.map((a, i) => (
                <li key={i}><Link to={a.link} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-600 dark:hover:text-blue-400"><span>{a.text}</span><ChevronRight size={14} className="text-gray-400 shrink-0" /></Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="glass-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3"><Link to="/platform/onboarding" className="hover:underline">Onboarding</Link></h2>
          {!inProgress.length ? <p className="text-sm text-gray-500">No tenant is mid-setup.</p> : (
            <ul className="space-y-3">
              {inProgress.map((r) => {
                const done = r.checklist.filter((c) => c.done).length;
                const pct = r.checklist.length ? Math.round((done / r.checklist.length) * 100) : 0;
                const act = r.activation.roster ? Math.round((r.activation.firstCheckIn / r.activation.roster) * 100) : 0;
                return (
                  <li key={r.schoolId} className="text-sm">
                    <div className="flex justify-between"><span className="text-gray-800 dark:text-gray-200">{r.name}</span><span className="text-xs text-gray-500">setup {done}/{r.checklist.length} · {act}% active</span></div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 mt-1"><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="glass-card overflow-x-auto">
        <h2 className="font-semibold text-gray-900 dark:text-white p-5 pb-2">Institutions at a glance</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="px-5 py-2">Institution / campus</th><th className="px-3 py-2">Students</th><th className="px-3 py-2">Check-ins today</th><th className="px-3 py-2">Beacons ⚠</th><th className="px-3 py-2">Open tickets</th></tr></thead>
          <tbody>
            {data.institutions.map((g) => (
              <Fragment key={g.name}>
                {g.schools.length > 1 && <tr className="border-t border-gray-100 dark:border-white/5"><td className="px-5 py-2 font-semibold" colSpan={5}>{g.name}</td></tr>}
                {g.schools.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100 dark:border-white/5">
                    <td className={`py-2 ${g.schools.length > 1 ? 'pl-9 pr-5' : 'px-5 font-semibold'}`}><Link to={`/platform/institutions/${s.id}`} className="hover:underline">{s.name}</Link></td>
                    {s.isolated ? <td className="px-3 py-2 text-gray-500" colSpan={4}>Isolated — not connected</td> : (
                      <>
                        <td className="px-3 py-2 tabular-nums">{s.students.toLocaleString()}</td>
                        <td className="px-3 py-2 tabular-nums">{s.checkInsToday.toLocaleString()}</td>
                        <td className="px-3 py-2 tabular-nums">{s.beacons ? <span className="text-amber-700 dark:text-amber-300 font-medium">{s.beacons}</span> : 0}</td>
                        <td className="px-3 py-2 tabular-nums">{s.tickets}</td>
                      </>
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="glass-card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3"><Cpu size={16} /> Background jobs {failing.length ? <span className="text-xs font-normal text-rose-600">· {failing.length} need a look</span> : <span className="text-xs font-normal text-emerald-600">· all healthy</span>}</h2>
          {!data.jobs.length ? <p className="text-sm text-gray-500">No runs recorded yet — they appear after the next deploy.</p> : (
            <ul className="space-y-1.5 text-sm max-h-72 overflow-y-auto">
              {data.jobs.map((j) => (
                <li key={j.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {j.ok === false ? <AlertTriangle size={13} className="text-rose-500" /> : j.late ? <Clock size={13} className="text-amber-500" /> : <CheckCircle2 size={13} className="text-emerald-500" />}
                    {JOB_LABEL[j.name] ?? j.name}
                    <span className="text-xs text-gray-500">{j.ok === false ? 'failed' : j.late ? 'late' : 'ok'}</span>
                  </span>
                  <span className="text-xs text-gray-500" title={j.lastError ?? undefined}>{ago(j.lastFinishedAt)}{j.everyMinutes ? ` · every ${j.everyMinutes >= 60 ? `${j.everyMinutes / 60} h` : `${j.everyMinutes} min`}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="glass-card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3"><Smartphone size={16} /> App versions in the field <span className="text-xs font-normal text-gray-500">· people seen in the last 30 days</span></h2>
          {!data.appVersions.length ? <p className="text-sm text-gray-500">No app has reported its version yet — builds from this release onwards do.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="py-1">Platform</th><th className="py-1">Version</th><th className="py-1 text-right">People</th></tr></thead>
              <tbody>{data.appVersions.map((v) => <tr key={`${v.platform}-${v.version}`} className="border-t border-gray-100 dark:border-white/5"><td className="py-1.5">{v.platform === 'ios' ? 'iOS' : 'Android'}</td><td className="py-1.5">{v.version}</td><td className="py-1.5 text-right tabular-nums">{v.people.toLocaleString()}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

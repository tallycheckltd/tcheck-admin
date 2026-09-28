import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatCard } from '../../components/ui/StatCard';
import { useAuth } from '../../context/AuthContext';
import { Users, GraduationCap, Wrench, MessageSquareHeart, CheckCircle2, Clock, BarChart3, ChevronRight } from 'lucide-react';
import type { FacilityTicket, FacilityTicketPreset } from '../../types';

const PRESET_LABEL: Record<FacilityTicketPreset, string> = {
  AC_TOO_COLD: 'Room temperature',
  AV_ISSUE: 'Projector / sound',
  CATERING: 'Refreshments / food',
  WIFI_INTERNET: 'Wi-Fi / internet',
  SAFETY_MEDICAL: 'Safety or medical',
  OTHER: 'Other',
};

/** FIXED (same class of bug as the mobile clients' preset decode): `presetType` is a
 * server-authoritative string, not something this union actually constrains at runtime — a plain
 * `PRESET_LABEL[x]` index would render `undefined` for a presetType this bundle predates. */
function presetLabel(preset: string): string {
  return PRESET_LABEL[preset as FacilityTicketPreset] ?? PRESET_LABEL.OTHER;
}

interface CemCohort {
  id: string;
  name: string;
  studentCount: number;
  startDate: string | null;
  endDate: string | null;
  pendingWelcomeCount: number;
}

interface CemAnalytics {
  byCourse: { courseId: string; name: string; code: string; enrolled: number; classCount: number; present: number; possible: number; attendanceRate: number }[];
  totals: { enrolled: number; present: number; possible: number; attendanceRate: number };
}

type AnalyticsRange = 'week' | 'month' | 'year' | 'all';
const RANGE_LABEL: Record<AnalyticsRange, string> = { week: 'This week', month: 'This month', year: 'This year', all: 'All time' };

const dateRange = (start: string | null, end: string | null) => {
  if (!start || !end) return 'Dates not scheduled yet';
  const f = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return f(start) === f(end) ? f(start) : `${f(start)} – ${f(end)}`;
};

function urgency(t: FacilityTicket): { label: string; color: 'red' | 'yellow' | 'blue' | 'green' } {
  if (t.status === 'RESOLVED') return { label: 'Resolved', color: 'green' };
  if (t.priority === 'URGENT') return { label: 'Escalated', color: 'red' };
  if (t.status === 'ACKNOWLEDGED') return { label: 'Being handled', color: 'blue' };
  return { label: 'Open', color: 'yellow' };
}

/**
 * Outline B3 / 11.8 — a real CEM dashboard, scaled to what's buildable without CEM_MANAGER
 * (frozen, Phase 4). "My programmes" is every cohort GET /cem/dashboard returns (all scoped to
 * the caller — a CEM never sees another CEM's cohorts here); "My tickets" reuses the exact same
 * /facility-tickets query the existing Facilities page already runs for this role (outline 11.1:
 * "assigned to me OR unassigned at my whole school") — deliberately NOT re-scoped to "by
 * programme", since that's decision 18.7's change and belongs to Phase 5, also frozen.
 */
export function CemDashboardPage() {
  const { user } = useAuth();
  const { data: dashboard, loading: cohortsLoading } = useApi<{ cohorts: CemCohort[] }>('/cem/dashboard');
  const { data: tickets, loading: ticketsLoading } = useApi<FacilityTicket[]>('/facility-tickets');
  const [range, setRange] = useState<AnalyticsRange>('month');
  // No `cohortId` — pooled across every cohort this CEM is assigned to (staffScope.ts's
  // resolveStaffCourseIds derives the course set from every Cohort.assignedCemId match), same
  // endpoint the per-programme panel uses with cohortId narrowed to one.
  const { data: analytics, loading: analyticsLoading } = useApi<CemAnalytics>(`/staff/analytics?range=${range}`);

  const cohorts = dashboard?.cohorts ?? [];
  const openTickets = (tickets ?? []).filter((t) => t.status !== 'RESOLVED');
  const unacknowledgedTickets = (tickets ?? []).filter((t) => t.status === 'OPEN');
  const totalPendingWelcomes = cohorts.reduce((sum, c) => sum + c.pendingWelcomeCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.firstName}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Aggregate analytics across every programme you manage, plus what needs your attention.</p>
      </div>

      <section className="glass-card p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-500" /> Overview — all programmes
          </h2>
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5 text-sm">
            {(Object.keys(RANGE_LABEL) as AnalyticsRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  range === r ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading…</p>
        ) : !analytics || analytics.totals.enrolled === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No enrolled executives across your programmes yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{cohorts.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Programmes</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals.enrolled}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Enrolled</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals.present}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Present check-ins</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.totals.attendanceRate}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Attendance rate</p>
              </div>
            </div>
            {analytics.byCourse.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Attendance rate by course</p>
                <div className="space-y-2">
                  {analytics.byCourse.map((c) => (
                    <div key={c.courseId} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 text-gray-600 dark:text-gray-300 truncate" title={c.name}>{c.code}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, c.attendanceRate)}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right font-medium text-gray-700 dark:text-gray-200">{c.attendanceRate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Programmes" value={cohorts.length} icon={<GraduationCap size={24} />} color="blue" />
        <StatCard title="Open tickets" value={openTickets.length} icon={<Wrench size={24} />} color="orange" />
        <StatCard title="Welcome DMs pending" value={totalPendingWelcomes} icon={<MessageSquareHeart size={24} />} color="purple" />
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">My programmes</h2>
        {cohortsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : cohorts.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No programmes assigned yet" description="You'll see a card here as soon as you're assigned as the Client Experience Manager for a cohort." size="md" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohorts.map((c) => (
              <Link
                key={c.id}
                to={`/cem/cohorts/${c.id}`}
                className="glass-card p-4 space-y-2 block hover:ring-2 hover:ring-blue-400/50 transition-shadow cursor-pointer"
              >
                <h3 className="font-bold text-gray-900 dark:text-white">{c.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{dateRange(c.startDate, c.endDate)}</p>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Users size={14} className="text-blue-500" /> {c.studentCount} student{c.studentCount === 1 ? '' : 's'}
                </div>
                {c.pendingWelcomeCount > 0 && (
                  <Badge color="yellow">{c.pendingWelcomeCount} welcome DM{c.pendingWelcomeCount === 1 ? '' : 's'} pending</Badge>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">To do</h2>
        {unacknowledgedTickets.length === 0 && totalPendingWelcomes === 0 ? (
          <div className="glass-card p-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={16} /> Nothing waiting on you right now.
          </div>
        ) : (
          <ul className="glass-card divide-y divide-gray-100 dark:divide-white/5">
            {unacknowledgedTickets.map((t) => (
              <li key={t.id} className="p-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <Clock size={14} className="text-amber-500" /> Unacknowledged ticket — {presetLabel(t.presetType)} · {t.class?.title ?? 'a class'}
                </span>
                <Link to={`/admin/facilities?ticket=${t.id}`} className="text-blue-500 hover:underline">Open</Link>
              </li>
            ))}
            {totalPendingWelcomes > 0 && (
              <li className="p-3 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <MessageSquareHeart size={14} className="text-purple-500" />
                {totalPendingWelcomes} student{totalPendingWelcomes === 1 ? '' : 's'} not yet welcomed — sent automatically once they finish onboarding.
              </li>
            )}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          My tickets {(tickets ?? []).length > 0 && <span className="text-sm font-normal text-gray-400">({tickets!.length})</span>}
        </h2>
        {ticketsLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (tickets ?? []).length === 0 ? (
          <EmptyState icon={Wrench} title="No tickets" description="Nothing raised for your classes yet." size="md" />
        ) : (
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left py-2 px-4">Issue</th>
                  <th className="text-left py-2 px-4">Class</th>
                  <th className="text-left py-2 px-4">Raised by</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-left py-2 px-4">Raised</th>
                  <th className="text-right py-2 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {[...(tickets ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((t) => {
                  const u = urgency(t);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="py-2 px-4 text-gray-800 dark:text-gray-200">
                        <p className="font-medium">{presetLabel(t.presetType)}</p>
                        {t.detail && <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{t.detail}</p>}
                      </td>
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-300">{t.class?.title ?? '—'}{t.class?.room ? ` · ${t.class.room}` : ''}</td>
                      <td className="py-2 px-4 text-gray-600 dark:text-gray-300">{t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : '—'}</td>
                      <td className="py-2 px-4"><Badge color={u.color}>{u.label}</Badge></td>
                      <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 px-4 text-right">
                        <Link to={`/admin/facilities?ticket=${t.id}`} className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                          Open <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

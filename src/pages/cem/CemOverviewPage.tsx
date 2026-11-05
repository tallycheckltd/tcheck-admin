import { Link, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, ChevronRight, GraduationCap, Mail, Megaphone, Sparkles, Wrench } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { Scorecard, type PerfRow } from './CemPerformancePage';

/**
 * SBS (Hans, 2026-11-05) — one CEM at a glance, for their Head of CEM (or a School Admin): the
 * programmes they run (each opens the programme page and its Completion tab), the facility
 * tickets still open on them, the announcements they wrote, and their scorecard for the last
 * 30 days. Server: GET /cem-team/cems/:id/overview (cemTeam.service cemOverview).
 */

interface Programme {
  id: string; name: string; status: string; startDate: string | null; endDate: string | null; client: string | null;
  delegates: number; completed: number; sessions: number; sessionsHeld: number; nextSession: string | null; finished: boolean;
}
interface Ticket { id: string; type: string; status: string; priority: string; createdAt: string; late: boolean; programme: { id: string; name: string | null } | null; session: string | null; room: string | null }
interface Announcement {
  id: string; title: string; status: string; channels: string[]; programme: { id: string; name: string } | null; source: string | null;
  when: string | null; expired: boolean; recipients: number; reads: number; createdAt: string;
}
interface Data {
  cem: { id: string; firstName: string; lastName: string; email: string; status: string };
  programmes: Programme[];
  openTickets: Ticket[];
  announcements: Announcement[];
  numbers: PerfRow & { minTickets: number };
}

const TICKET: Record<string, string> = { AC_TOO_COLD: 'Room temperature', AV_ISSUE: 'Projector / sound', CATERING: 'Refreshments / food', WIFI_INTERNET: 'Wi-Fi / internet', SAFETY_MEDICAL: 'Safety or medical', OTHER: 'Other' };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const when = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const ago = (d: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60_000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

function programmeState(p: Programme) {
  if (p.finished) return { text: 'Delivered', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' };
  if (p.status === 'PLANNED') return { text: 'Planned', cls: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300' };
  return { text: 'Running', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' };
}
function announcementState(a: Announcement) {
  if (a.status === 'DRAFT') return { text: 'Draft', cls: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300' };
  if (a.status === 'SCHEDULED') return { text: 'Scheduled', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' };
  if (a.status === 'WITHDRAWN') return { text: 'Withdrawn', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' };
  if (a.expired) return { text: 'Ended', cls: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400' };
  return { text: 'Sent', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' };
}

const card = 'glass-card p-5 space-y-3';
const heading = 'text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2';

export function CemOverviewPage() {
  const { cemId = '' } = useParams<{ cemId: string }>();
  const { data, loading, error } = useApi<Data>(`/cem-team/cems/${cemId}/overview`);
  const back = (
    <Link to="/cem-team" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
      <ArrowLeft size={14} /> Back to CEM Team
    </Link>
  );

  if (loading && !data) return <div className="space-y-6">{back}<p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p></div>;
  if (error || !data) return <div className="space-y-6">{back}<p className="glass-card p-6 text-sm text-gray-500 dark:text-gray-400 text-center">This CEM isn't in your team (or doesn't exist).</p></div>;

  const { cem, programmes, openTickets, announcements, numbers } = data;
  const running = programmes.filter((p) => !p.finished);
  // Same figure as the CEM card and the scorecard: each person once, across their programmes.
  const delegates = numbers.quality?.delegates ?? numbers.students;
  const programmeLink = (id: string) => `/cem/cohorts/${id}`;
  const backState = { back: `/cem-team/cems/${cemId}`, backLabel: `${cem.firstName} ${cem.lastName}` };

  return (
    <div className="space-y-6">
      {back}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{cem.firstName} {cem.lastName}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
          <Mail size={14} /> <a href={`mailto:${cem.email}`} className="text-blue-500 hover:underline">{cem.email}</a>
          <span>· {running.length} programme{running.length === 1 ? '' : 's'} on now or coming up · {delegates} delegate{delegates === 1 ? '' : 's'} · {openTickets.length} open ticket{openTickets.length === 1 ? '' : 's'}</span>
        </p>
      </div>

      <section className={card}>
        <h3 className={heading}><GraduationCap size={18} className="text-blue-500" /> Programmes</h3>
        {programmes.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No programmes yet.</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {programmes.map((p) => {
              const st = programmeState(p);
              return (
                <li key={p.id} className="py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <Link to={programmeLink(p.id)} state={backState} className="min-w-0 flex-1 group">
                    <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {day(p.startDate)} – {day(p.endDate)}{p.client ? ` · ${p.client}` : ''}
                    </p>
                  </Link>
                  <div className="text-xs text-gray-600 dark:text-gray-300 w-40 shrink-0">
                    <p>{p.delegates} delegate{p.delegates === 1 ? '' : 's'}{p.completed ? `, ${p.completed} completed` : ''}</p>
                    <p className="text-gray-500 dark:text-gray-400">{p.sessionsHeld} of {p.sessions} sessions held</p>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 w-36 shrink-0 hidden md:block">{p.nextSession ? `Next: ${when(p.nextSession)}` : p.finished ? '' : p.sessions ? 'No more sessions' : 'No sessions yet'}</div>
                  <span className={clsx('text-xs font-medium px-2 py-1 rounded-full w-20 text-center shrink-0', st.cls)}>{st.text}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link to={`/cem/cohorts/${p.id}/completion`} state={backState} className="text-xs text-blue-500 hover:underline">Completion</Link>
                    <Link to={programmeLink(p.id)} state={backState} aria-label={`Open ${p.name}`} className="text-gray-400 hover:text-blue-500"><ChevronRight size={18} /></Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className={card}>
          <h3 className={heading}><Wrench size={18} className="text-blue-500" /> Open facility tickets</h3>
          {openTickets.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Nothing open right now.</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {openTickets.map((t) => (
                <li key={t.id} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{TICKET[t.type] ?? t.type}{t.priority === 'URGENT' && <span className="text-red-600 dark:text-red-400"> · urgent</span>}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{[t.programme?.name, t.session, t.room].filter(Boolean).join(' · ') || 'No session'} · {ago(t.createdAt)}</p>
                  </div>
                  <span className={clsx('text-xs font-medium px-2 py-1 rounded-full shrink-0', t.late ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : t.status === 'ACKNOWLEDGED' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}>
                    {t.late ? 'Late' : t.status === 'ACKNOWLEDGED' ? 'On it' : 'New'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h3 className={heading}><Megaphone size={18} className="text-blue-500" /> Announcements</h3>
          {announcements.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No announcements yet.</p> : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {announcements.map((a) => {
                const st = announcementState(a);
                return (
                  <li key={a.id} className="py-2.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                        {a.title}{a.source === 'TALI_COMPOSER' && <Sparkles size={12} className="text-blue-500 shrink-0" aria-label="Drafted with TALI" />}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {a.programme?.name ?? 'Whole school'} · {a.status === 'DRAFT' ? `started ${day(a.createdAt)}` : when(a.when)}
                        {a.status === 'PUBLISHED' && a.recipients > 0 && ` · read by ${a.reads} of ${a.recipients}`}
                        {a.channels.includes('EMAIL') && ' · email'}
                      </p>
                    </div>
                    <span className={clsx('text-xs font-medium px-2 py-1 rounded-full shrink-0', st.cls)}>{st.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Last 30 days</h2>
        <Scorecard r={numbers} minTickets={numbers.minTickets} own={false} />
      </div>
    </div>
  );
}

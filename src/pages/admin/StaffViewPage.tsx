import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Cake, ClipboardCheck, Info, Star, BarChart3, PieChart as PieChartIcon, Table as TableIcon, ChevronDown, Folder, Wrench } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { FacilitiesQueue } from '../../components/facilities/FacilitiesQueue';
import type { FacilityTicket } from '../../types';
import { RequestFeedbackWorkspace } from '../../components/feedback/FeedbackCampaigns';

interface StaffBirthday {
  id: string; firstName: string; lastName: string; avatarUrl?: string | null;
  month: number; day: number; daysAway: number; isToday: boolean;
}
interface StaffCheckIn {
  id: string;
  student: { id: string; firstName: string; lastName: string; studentId?: string | null };
  course: { id: string; name: string; code: string } | null;
  classTitle: string; room: string | null; checkInAt: string; status: string;
  // UAT F16
  classId?: string; classStart?: string; classEnd?: string; checkOutAt?: string | null; checkInType?: string;
  punctuality?: 'ON_TIME' | 'LATE' | 'EXTREMELY_LATE' | 'MANUAL';
  checkOutState?: 'CHECKED_OUT' | 'OPEN' | 'MISSING' | null; outcome?: 'ATTENDED' | 'INCOMPLETE' | null;
  markedBy?: { id: string; firstName: string; lastName: string } | null;
}
interface StaffCourse {
  id: string; name: string; code: string;
  classes: { id: string; title: string; date: string; room: string | null }[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Appends `?cohortId=`/`&cohortId=` when one is given — every /staff/* endpoint accepts it
 * optionally (staff.controller.ts's cohortIdParam) to narrow to one particular programme. */
function withCohort(url: string, cohortId?: string): string {
  if (!cohortId) return url;
  return `${url}${url.includes('?') ? '&' : '?'}cohortId=${encodeURIComponent(cohortId)}`;
}

/** Collapsed by default — a Staff/CXM account with several permissions previously saw every
 * panel's full content at once, which read as cluttered. Clicking the header expands just that
 * one panel; the rest stay closed until clicked, so the page opens as a clean list of section
 * headers instead of a wall of cards. `id` (when given) lets the sidebar's per-programme panel
 * links (Sidebar.tsx's cohort-context nav) deep-link straight to one panel via `#id` — matching
 * hash on mount/hashchange auto-expands and scrolls it into view. */
function Panel({ id, title, icon: Icon, children, defaultOpen = false }: { id?: string; title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  // react-router's own `location.hash` (not `window.location.hash`) — it updates on every
  // client-side navigation, including hash-only ones from the sidebar's per-panel links, which a
  // raw `window.addEventListener('hashchange', ...)` misses (pushState doesn't fire that event).
  const { hash } = useLocation();

  useEffect(() => {
    if (!id || hash !== `#${id}`) return;
    setOpen(true);
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [id, hash]);

  return (
    <div id={id} ref={ref} className="glass-card overflow-hidden scroll-mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-6 text-left cursor-pointer"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon size={18} className="text-blue-500" /> {title}
        </h2>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-6 pb-6 -mt-2">{children}</div>}
    </div>
  );
}

/** The actual grid of permission-gated panels — shared between the plain Staff View page (no
 * `cohortId`, pooled across every one of the caller's in-scope courses) and a CEM's per-programme
 * page (`cohortId` set, narrowed to just that one cohort's courses — see staffScope.ts's
 * resolveStaffCourseIds). One implementation, so the two surfaces can never drift apart. */
// UAT F17 — no Broadcast panel: announcements are sent from the one Announcements page.
export type StaffPanelKey = 'checkins' | 'manual-checkin' | 'materials' | 'feedback' | 'facilities' | 'analytics' | 'birthdays';

/** Panel display order — Birthdays deliberately LAST (per explicit request: a CEM's programme
 * page should lead with the operational panels, not birthdays). Doubles as the CEM per-programme
 * sidebar's own link order (Sidebar.tsx's buildCxmCohortLinks) and each panel's standalone-page
 * route order (CemCohortPanelPage.tsx) — keep all three in step. */
export const STAFF_PANEL_ORDER: StaffPanelKey[] = ['checkins', 'manual-checkin', 'materials', 'feedback', 'facilities', 'analytics', 'birthdays'];
export const STAFF_PANEL_LABEL: Record<StaffPanelKey, string> = {
  checkins: 'Check-Ins', 'manual-checkin': 'Manual Check-in', materials: 'Materials',
  feedback: 'Request Feedback', facilities: 'Facilities', analytics: 'Analytics', birthdays: 'Birthdays',
};

/** `only`, when given, renders just that one panel (still permission-gated) full-width instead of
 * the whole grid — CemCohortPanelPage.tsx's standalone per-panel pages use this so each panel
 * genuinely lives on its own page/route rather than a shared accordion, while StaffViewPage and the
 * plain (non-per-panel) programme overview keep using the full grid. */
export function StaffPanelsGrid({ cohortId, only }: { cohortId?: string; only?: StaffPanelKey }) {
  const { user } = useAuth();
  const perms = new Set(user?.permissions ?? []);
  const hasAny = perms.size > 0;

  if (!hasAny) {
    return (
      <div className="glass-card p-8 text-center">
        <Info size={28} className="mx-auto text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You don&apos;t have any permissions yet. Once your School Admin assigns you a role, the panels you&apos;re granted will appear here.
        </p>
      </div>
    );
  }

  const show = (key: StaffPanelKey) => !only || only === key;
  const granted: Record<StaffPanelKey, boolean> = {
    birthdays: perms.has('VIEW_BIRTHDAYS'),
    checkins: perms.has('VIEW_BLE_CHECKINS') || perms.has('VIEW_MANUAL_CHECKINS'),
    'manual-checkin': perms.has('MANUAL_CHECK_IN'),
    materials: perms.has('MANAGE_MATERIALS'),
    // Teaching staff send campaigns only at Executive Education schools — elsewhere the school's admins do.
    feedback: perms.has('REQUEST_FEEDBACK') && !!user?.school?.features?.execEdSuite,
    facilities: perms.has('VIEW_FACILITIES'),
    analytics: perms.has('VIEW_ANALYTICS'),
  };

  if (only && !granted[only]) {
    return (
      <div className="glass-card p-8 text-center">
        <Info size={28} className="mx-auto text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">You don&apos;t have the {STAFF_PANEL_LABEL[only]} permission.</p>
      </div>
    );
  }

  return (
    <div className={only ? '' : 'grid gap-6 lg:grid-cols-2'}>
      {show('checkins') && granted.checkins && (
        <CombinedCheckInsPanel canManual={perms.has('VIEW_MANUAL_CHECKINS')} canOnSite={perms.has('VIEW_BLE_CHECKINS')} cohortId={cohortId} open={!!only} />
      )}
      {show('manual-checkin') && granted['manual-checkin'] && <ManualCheckInPanel cohortId={cohortId} open={!!only} />}
      {show('materials') && granted.materials && <MaterialsPanel cohortId={cohortId} open={!!only} />}
      {show('feedback') && granted.feedback && <FeedbackRequestPanel cohortId={cohortId} open={!!only} />}
      {show('facilities') && granted.facilities && (
        only ? <FacilitiesQueue cohortId={cohortId} /> : <FacilitiesPanel cohortId={cohortId} open={false} />
      )}
      {show('analytics') && granted.analytics && (
        <div className={only ? '' : 'lg:col-span-2'}>
          <AnalyticsPanel showDemographics={perms.has('VIEW_ANALYTICS_DEMOGRAPHICS')} cohortId={cohortId} />
        </div>
      )}
      {show('birthdays') && granted.birthdays && <BirthdaysPanel cohortId={cohortId} open={!!only} />}
    </div>
  );
}

/** Dashboard mirror of the mobile Staff tab — same `/staff/*` and `/broadcasts` endpoints, so a
 * Lecturer/Client Experience Manager sees identical capabilities whether they're on mobile or
 * here (see the Permission enum's "surface-agnostic" contract). Every panel independently
 * shows/hides based on the logged-in user's own `permissions` — nothing here re-checks anything
 * client-side that the server doesn't also enforce on the actual request. */
export function StaffViewPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff View</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {user?.customRoleName ? `Role: ${user.customRoleName}` : 'No role assigned yet — ask your School Admin to grant one under Roles & Permissions.'}
        </p>
      </div>
      <StaffPanelsGrid />
    </div>
  );
}

function BirthdayRow({ b, note }: { b: StaffBirthday; note: string }) {
  const weekday = new Date(new Date().getFullYear(), b.month - 1, b.day).toLocaleDateString(undefined, { weekday: 'short' });
  return (
    <li className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
      <span className="text-sm text-gray-800 dark:text-gray-200">{b.firstName} {b.lastName}</span>
      <span className="text-xs text-gray-500">{weekday} {MONTH_NAMES[b.month - 1]} {b.day}{note ? <span className="ml-1.5 font-semibold text-blue-500">{note}</span> : null}</span>
    </li>
  );
}
function BirthdayHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-3 mb-1.5 first:mt-0">{children}</p>;
}

/**
 * UAT F19 (2026-09-29) — birthdays grouped so thirty delegates don't become one long list: Today,
 * Coming up this month ("in 3 days", with the weekday), Earlier this month, then later months folded.
 */
function BirthdaysPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const { data } = useApi<StaffBirthday[]>(withCohort('/staff/birthdays?all=1', cohortId));
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({});
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const rows = data ?? [];
  const today = rows.filter((b) => b.isToday);
  const upcoming = rows.filter((b) => !b.isToday && b.month === thisMonth && b.day > now.getDate()).sort((a, b) => a.day - b.day);
  const earlier = rows.filter((b) => !b.isToday && b.month === thisMonth && b.day < now.getDate()).sort((a, b) => b.day - a.day);
  const later = new Map<number, StaffBirthday[]>();
  for (const b of rows.filter((x) => x.month !== thisMonth).sort((a, b) => a.daysAway - b.daysAway)) later.set(b.month, [...(later.get(b.month) ?? []), b]);


  return (
    <Panel id="panel-birthdays" title="Birthdays" icon={Cake} defaultOpen={open}>
      {!rows.length ? (
        <p className="text-sm text-gray-400 py-4 text-center">No birthdays recorded in your assigned courses.</p>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          {today.length > 0 && (
            <>
              <BirthdayHeading>Today 🎂</BirthdayHeading>
              <ul className="space-y-1.5">{today.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-pink-50 dark:bg-pink-500/10">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{b.firstName} {b.lastName}</span>
                  <span className="text-xs font-semibold text-pink-500">Today</span>
                </li>
              ))}</ul>
            </>
          )}
          <BirthdayHeading>Coming up this month</BirthdayHeading>
          {upcoming.length ? <ul className="space-y-1.5">{upcoming.map((b) => <BirthdayRow key={b.id} b={b} note={b.daysAway === 1 ? 'tomorrow' : `in ${b.daysAway} days`} />)}</ul> : <p className="text-xs text-gray-400 px-1">None left this month.</p>}
          {earlier.length > 0 && (<><BirthdayHeading>Earlier this month</BirthdayHeading><ul className="space-y-1.5 opacity-75">{earlier.map((b) => <BirthdayRow key={b.id} b={b} note="" />)}</ul></>)}
          {later.size > 0 && <BirthdayHeading>Later</BirthdayHeading>}
          {[...later.entries()].map(([m, list]) => {
            const isOpen = openMonths[m] ?? false;
            return (
              <div key={m} className="mb-1.5">
                <button onClick={() => setOpenMonths((p) => ({ ...p, [m]: !isOpen }))} aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 text-sm cursor-pointer">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{MONTH_NAMES[m - 1]} <span className="text-gray-400 font-normal">· {list.length}</span></span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <ul className="space-y-1.5 mt-1.5">{list.map((b) => <BirthdayRow key={b.id} b={b} note="" />)}</ul>}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** Consolidated Check-Ins panel — a Manual/Aura toggle instead of two separate always-visible
 * lists (matches the same consolidation already shipped on iOS/Android). "Aura Check-In" is
 * this system's user-facing term for what used to be labeled "BLE" everywhere. */
const hhmm = (s?: string | null) => (s ? new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const PUNCT: Record<string, { label: string; cls: string }> = {
  ON_TIME: { label: 'On time', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  LATE: { label: 'Late', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  EXTREMELY_LATE: { label: 'Very late', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  MANUAL: { label: 'Manual', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
};
const OUT: Record<string, { label: string; cls: string }> = {
  CHECKED_OUT: { label: 'Checked out', cls: 'text-emerald-600 dark:text-emerald-400' },
  OPEN: { label: 'Check-out open', cls: 'text-slate-500' },
  MISSING: { label: 'No check-out', cls: 'text-rose-600 dark:text-rose-400' },
};

/**
 * UAT F16 (2026-09-29) — check-ins per course, then per session: each row is a student with check-in
 * and check-out times, how they checked in (Aura or manual — and who marked it), lateness and the
 * check-out outcome. Search by student; filter by course, day and method. Aura and manual come from
 * the same two permission-gated endpoints as before and are merged here.
 */
function CombinedCheckInsPanel({ canManual, canOnSite, cohortId, open = false }: { canManual: boolean; canOnSite: boolean; cohortId?: string; open?: boolean }) {
  const { data: manual } = useApi<StaffCheckIn[]>(canManual ? withCohort('/staff/checkins?type=manual', cohortId) : null);
  const { data: aura } = useApi<StaffCheckIn[]>(canOnSite ? withCohort('/staff/checkins?type=ble', cohortId) : null);
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [day, setDay] = useState('');
  const [method, setMethod] = useState<'ALL' | 'AURA' | 'MANUAL'>('ALL');
  const [openSessions, setOpenSessions] = useState<Record<string, boolean>>({});

  const all = useMemo(() => [...(manual ?? []), ...(aura ?? [])], [manual, aura]);
  const courses = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code: string }>();
    for (const c of all) if (c.course) m.set(c.course.id, c.course);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = all.filter((c) =>
      (!q || `${c.student.firstName} ${c.student.lastName} ${c.student.studentId ?? ''}`.toLowerCase().includes(q))
      && (!course || c.course?.id === course)
      && (!day || (c.classStart ?? c.checkInAt).slice(0, 10) === day)
      && (method === 'ALL' || (method === 'MANUAL' ? c.checkInType === 'MANUAL' : c.checkInType !== 'MANUAL')));
    const byCourse = new Map<string, { course: StaffCheckIn['course']; sessions: Map<string, { title: string; room: string | null; start?: string; end?: string; rows: StaffCheckIn[] }> }>();
    for (const c of rows) {
      const ck = c.course?.id ?? '_';
      const g = byCourse.get(ck) ?? { course: c.course, sessions: new Map() };
      const sk = c.classId ?? `${c.classTitle}|${c.checkInAt.slice(0, 10)}`;
      const sess = g.sessions.get(sk) ?? { title: c.classTitle, room: c.room, start: c.classStart, end: c.classEnd, rows: [] };
      sess.rows.push(c);
      g.sessions.set(sk, sess);
      byCourse.set(ck, g);
    }
    return [...byCourse.entries()].map(([id, g]) => ({
      id, course: g.course,
      sessions: [...g.sessions.entries()]
        .map(([key, v]) => ({ key, ...v, rows: v.rows.sort((a, b) => a.checkInAt.localeCompare(b.checkInAt)) }))
        .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? '')),
    })).sort((a, b) => (a.course?.name ?? '').localeCompare(b.course?.name ?? ''));
  }, [all, search, course, day, method]);

  const inputCls = 'py-1.5 px-2 rounded-lg text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10';
  return (
    <Panel id="panel-checkins" title="Check-Ins" icon={ClipboardCheck} defaultOpen={open}>
      <div className="flex flex-wrap gap-2 mb-3">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a student…" className={`${inputCls} flex-1 min-w-[160px]`} />
        <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course" className={inputCls}>
          <option value="">All my courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" className={inputCls} />
        {canManual && canOnSite && (
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} aria-label="Method" className={inputCls}>
            <option value="ALL">Aura + manual</option><option value="AURA">Aura only</option><option value="MANUAL">Manual only</option>
          </select>
        )}
      </div>
      {!groups.length ? (
        <p className="text-sm text-gray-400 py-4 text-center">{all.length ? 'Nothing matches.' : 'No check-ins yet.'}</p>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {groups.map((g) => (
            <section key={g.id}>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{g.course?.name ?? 'Course'} <span className="font-normal text-gray-400">{g.course?.code}</span></h3>
              <div className="space-y-2">
                {g.sessions.map((sess, idx) => {
                  const isOpen = openSessions[sess.key] ?? (idx === 0 || !!search.trim());
                  const outCount = sess.rows.filter((r) => r.checkOutState === 'CHECKED_OUT').length;
                  return (
                    <div key={sess.key} className="rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden">
                      <button onClick={() => setOpenSessions((p) => ({ ...p, [sess.key]: !isOpen }))} aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-gray-50 dark:bg-white/5 cursor-pointer">
                        <span className="text-sm">
                          <span className="font-medium text-gray-900 dark:text-white">{sess.title}</span>
                          <span className="text-gray-500"> · {sess.start ? new Date(sess.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''} {hhmm(sess.start)}–{hhmm(sess.end)}{sess.room ? ` · ${sess.room}` : ''}</span>
                        </span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{sess.rows.length} checked in · {outCount} checked out</span>
                      </button>
                      {isOpen && (
                        <table className="w-full text-sm">
                          <thead className="text-left text-[11px] uppercase text-gray-400">
                            <tr><th className="px-3 py-1.5">Student</th><th className="px-3 py-1.5">In</th><th className="px-3 py-1.5">Out</th><th className="px-3 py-1.5">How</th><th className="px-3 py-1.5">Status</th></tr>
                          </thead>
                          <tbody>
                            {sess.rows.map((r) => (
                              <tr key={r.id} className="border-t border-gray-100 dark:border-white/5">
                                <td className="px-3 py-1.5 text-gray-900 dark:text-white">{r.student.firstName} {r.student.lastName}{r.student.studentId ? <span className="text-xs text-gray-400"> · {r.student.studentId}</span> : null}</td>
                                <td className="px-3 py-1.5">{hhmm(r.checkInAt)}</td>
                                <td className="px-3 py-1.5">{hhmm(r.checkOutAt)}</td>
                                <td className="px-3 py-1.5 text-xs">{r.checkInType === 'MANUAL' ? `Manual${r.markedBy ? ` · by ${r.markedBy.firstName} ${r.markedBy.lastName}` : ''}` : 'Aura'}</td>
                                <td className="px-3 py-1.5">
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    {r.punctuality && r.punctuality !== 'MANUAL' && <span className={`text-[11px] rounded-full px-2 py-0.5 ${PUNCT[r.punctuality].cls}`}>{PUNCT[r.punctuality].label}</span>}
                                    {r.checkOutState && <span className={`text-[11px] ${OUT[r.checkOutState].cls}`}>{OUT[r.checkOutState].label}</span>}
                                    {r.outcome === 'INCOMPLETE' && <span className="text-[11px] rounded-full px-2 py-0.5 bg-rose-500 text-white">Incomplete</span>}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

interface StaffStudent {
  id: string; firstName: string; lastName: string; studentId?: string | null;
}

function ManualCheckInPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const { data: courses, refetch } = useApi<StaffCourse[]>(withCohort('/staff/courses', cohortId));
  const { mutate: checkIn, loading } = useMutation('post');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [student, setStudent] = useState<StaffStudent | null>(null);
  const [status, setStatus] = useState('');

  // Only fires once the caller has actually typed something — /staff/students returns [] for an
  // empty search anyway, but this also saves a request per keystroke on an empty box.
  const { data: results } = useApi<StaffStudent[]>(search.trim().length >= 2 ? withCohort(`/staff/students?search=${encodeURIComponent(search.trim())}`, cohortId) : null);

  const allClasses = (courses ?? []).flatMap((c) => c.classes.map((cls) => ({ ...cls, courseName: c.name })));

  const submit = async () => {
    if (!classId || !student) return;
    try {
      await checkIn('/attendance/manual-check-in', { classId, userId: student.id });
      setStatus(`Checked in ${student.firstName} ${student.lastName}.`);
      setStudent(null);
      setSearch('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to check in.');
    }
  };

  return (
    <Panel id="panel-manual-checkin" title="Manual Check-in" icon={ClipboardCheck} defaultOpen={open}>
      <div className="space-y-3">
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          onFocus={() => refetch({ silent: true })}
          className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white"
        >
          <option value="">Select a class…</option>
          {allClasses.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.courseName} — {cls.title} ({new Date(cls.date).toLocaleDateString()})</option>
          ))}
        </select>
        {student ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-sm">
            <span>{student.firstName} {student.lastName} {student.studentId ? `(${student.studentId})` : ''}</span>
            <button onClick={() => setStudent(null)} className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer">Change</button>
          </div>
        ) : (
          <div className="relative">
            <Input placeholder="Search by name or student ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {results && results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setStudent(r); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                  >
                    {r.firstName} {r.lastName} {r.studentId ? `(${r.studentId})` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Button onClick={() => void submit()} disabled={loading || !classId || !student} size="sm" className="w-full">
          Check In
        </Button>
        {status && <p className="text-xs text-gray-500 dark:text-gray-400">{status}</p>}
      </div>
    </Panel>
  );
}


interface StaffMaterial {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  course: { id: string; name: string; code: string } | null;
  // UAT F13
  kind?: 'BEFORE' | 'DURING' | 'AFTER' | 'LIBRARY';
  class?: { id: string; title: string; startTime: string } | null;
  dueAt?: string | null;
  createdAt?: string;
  openedCount?: number;
  audienceCount?: number | null;
}

const KIND_META: Record<string, { label: string; hint: string; cls: string }> = {
  BEFORE: { label: 'Before class', hint: 'A pre-read — due when the session starts; students get a reminder the evening before.', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  DURING: { label: 'In class', hint: 'Slides or a handout for the session itself.', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
  AFTER: { label: 'After class', hint: 'Homework or follow-up — pick when it is due.', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  LIBRARY: { label: 'Course library', hint: 'Course-wide — not tied to one session.', cls: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300' },
};

const fmtWhen = (d?: string | null) => (d ? new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
function MaterialItem({ m, onRemove }: { m: StaffMaterial; onRemove: () => void }) {
  return (
    <li className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.title}</p>
          <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5 mt-0.5">
            {m.kind && <span className={`rounded-full px-2 py-0.5 ${KIND_META[m.kind]?.cls ?? ''}`}>{KIND_META[m.kind]?.label ?? m.kind}</span>}
            {m.class && <span>{m.class.title} · {fmtWhen(m.class.startTime)}</span>}
            {m.kind === 'AFTER' && m.dueAt && <span>· due {fmtWhen(m.dueAt)}</span>}
          </p>
          {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
          {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Open link</a>}
        </div>
        <div className="text-right shrink-0">
          {m.audienceCount != null && <p className="text-xs text-gray-500">{m.openedCount ?? 0} / {m.audienceCount} opened</p>}
          <button onClick={onRemove} className="text-xs text-rose-500 hover:underline cursor-pointer">Remove</button>
        </div>
      </div>
    </li>
  
  );
}

/**
 * UAT F13 (2026-09-29) — share material on a course, for a specific session: pick the course, the
 * session and when it's for (before / in / after class, or the course library). Students are told
 * and see it under the course and the class; staff see how many opened it (counts only). Listed per
 * course as Upcoming, Past and Library.
 */
function MaterialsPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const { data: materials, refetch } = useApi<StaffMaterial[]>(withCohort('/staff/materials', cohortId));
  const { data: courses } = useApi<StaffCourse[]>(withCohort('/staff/courses', cohortId));
  const { mutate: create, loading, error } = useMutation('post');
  const { mutate: remove } = useMutation('delete');
  const [isAdding, setIsAdding] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [kind, setKind] = useState<'BEFORE' | 'DURING' | 'AFTER' | 'LIBRARY'>('BEFORE');
  const [classId, setClassId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  const sessions = useMemo(() => {
    const list = courses?.find((c) => c.id === courseId)?.classes ?? [];
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [courses, courseId]);
  const needsSession = kind !== 'LIBRARY';
  const canSave = !!title.trim() && !!courseId && (!needsSession || !!classId) && (kind !== 'AFTER' || !!dueAt);

  const reset = () => { setTitle(''); setDescription(''); setUrl(''); setClassId(''); setDueAt(''); setIsAdding(false); };
  const submit = async () => {
    if (!canSave) return;
    const ok = await create('/staff/materials', {
      courseId, kind, classId: needsSession ? classId : null,
      dueAt: kind === 'AFTER' && dueAt ? new Date(dueAt).toISOString() : null,
      title, description: description || undefined, url: url || undefined,
    });
    if (ok) { reset(); refetch(); }
  };

  // Captured once per mount (render must stay pure); good enough to split upcoming from past.
  const [now] = useState(() => Date.now());
  const grouped = useMemo(() => {
    const by = new Map<string, { course: StaffMaterial['course']; upcoming: StaffMaterial[]; past: StaffMaterial[]; library: StaffMaterial[] }>();
    for (const m of materials ?? []) {
      const key = m.course?.id ?? '_general';
      const g = by.get(key) ?? { course: m.course, upcoming: [], past: [], library: [] };
      const when = m.dueAt ?? m.class?.startTime ?? null;
      if (!m.kind || m.kind === 'LIBRARY' || !when) g.library.push(m);
      else if (new Date(when).getTime() >= now) g.upcoming.push(m);
      else g.past.push(m);
      by.set(key, g);
    }
    for (const g of by.values()) {
      const t = (m: StaffMaterial) => new Date(m.dueAt ?? m.class?.startTime ?? m.createdAt ?? 0).getTime();
      g.upcoming.sort((a, b) => t(a) - t(b));
      g.past.sort((a, b) => t(b) - t(a));
    }
    return [...by.values()];
  }, [materials, now]);

  const selectCls = 'w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white';


  return (
    <Panel id="panel-materials" title="Materials" icon={Folder} defaultOpen={open}>
      <div className="space-y-3">
        {isAdding ? (
          <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setClassId(''); }} className={selectCls} aria-label="Course">
              <option value="">Pick a course…</option>
              {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            <div role="radiogroup" aria-label="When is it for" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k as typeof kind)}
                  className={`text-xs rounded-lg px-2 py-2 border cursor-pointer ${kind === k ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300'}`}>
                  {KIND_META[k].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">{KIND_META[kind].hint}</p>
            {needsSession && (
              <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!courseId} className={selectCls} aria-label="Session">
                <option value="">{courseId ? 'Pick the session…' : 'Pick a course first'}</option>
                {sessions.map((c) => <option key={c.id} value={c.id}>{new Date(c.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} — {c.title}{c.room ? ` · ${c.room}` : ''}</option>)}
              </select>
            )}
            {kind === 'AFTER' && (
              <label className="block text-xs text-gray-500">Due
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${selectCls} mt-1`} />
              </label>
            )}
            <Input placeholder="Title — e.g. Read chapter 3" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Note for students (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input placeholder="Link (optional) — https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={loading || !canSave} size="sm">Share with students</Button>
              <Button onClick={reset} size="sm" variant="secondary">Cancel</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsAdding(true)} size="sm" variant="secondary">+ Share material</Button>
        )}

        {!grouped.length ? (
          <p className="text-sm text-gray-400 py-2">No materials yet.</p>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {grouped.map((g) => (
              <section key={g.course?.id ?? 'general'}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">{g.course?.name ?? 'General (whole school)'}</h3>
                {g.upcoming.length > 0 && (<><p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Upcoming</p><ul className="space-y-1.5 mb-2">{g.upcoming.map((m) => <MaterialItem key={m.id} m={m} onRemove={async () => { await remove(`/staff/materials/${m.id}`); refetch(); }} />)}</ul></>)}
                {g.library.length > 0 && (<><p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Library</p><ul className="space-y-1.5 mb-2">{g.library.map((m) => <MaterialItem key={m.id} m={m} onRemove={async () => { await remove(`/staff/materials/${m.id}`); refetch(); }} />)}</ul></>)}
                {g.past.length > 0 && (<><p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Past</p><ul className="space-y-1.5 opacity-75">{g.past.map((m) => <MaterialItem key={m.id} m={m} onRemove={async () => { await remove(`/staff/materials/${m.id}`); refetch(); }} />)}</ul></>)}
              </section>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** VIEW_FACILITIES panel — the same /facility-tickets list the standalone Facilities Queue page
 * uses, just narrowed with ?cohortId= when this grid is rendered for one particular programme
 * (see facilityTicket.service.ts's listFacilityTickets). Read-only here; replying/acknowledging
 * still happens on the full Facilities Queue page (linked below) — this is "what's open for this
 * programme at a glance", not a second copy of that page's whole workflow. */
function FacilitiesPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const { data: tickets } = useApi<FacilityTicket[]>(withCohort('/facility-tickets', cohortId));
  const openTickets = (tickets ?? []).filter((t) => t.status !== 'RESOLVED');

  return (
    <Panel id="panel-facilities" title="Facilities" icon={Wrench} defaultOpen={open}>
      {!tickets?.length ? (
        <p className="text-sm text-gray-400 py-4 text-center">No facility tickets for this programme yet.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {tickets.map((t) => (
            <li key={t.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.class?.title ?? 'a class'}</span>
                <Badge color={t.status === 'RESOLVED' ? 'green' : t.priority === 'URGENT' ? 'red' : t.status === 'ACKNOWLEDGED' ? 'blue' : 'yellow'}>
                  {t.status === 'RESOLVED' ? 'Resolved' : t.priority === 'URGENT' ? 'Escalated' : t.status === 'ACKNOWLEDGED' ? 'Being handled' : 'Open'}
                </Badge>
              </div>
              <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      )}
      {openTickets.length > 0 && (
        <a href="/admin/facilities" className="block mt-3 text-xs text-blue-500 hover:underline">Open the full Facilities Queue to reply →</a>
      )}
    </Panel>
  );
}

/** Request Feedback — the same workspace as the admin tab (components/feedback/FeedbackCampaigns),
 * scoped to this account's programmes. On a CEM programme's own page (`only`) it fills the page;
 * in the Staff View grid it sits in a collapsible panel like the others. */
function FeedbackRequestPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  if (open) return <RequestFeedbackWorkspace cohortId={cohortId} showHeader={false} />;
  return (
    <Panel id="panel-feedback" title="Request Feedback" icon={Star}>
      <RequestFeedbackWorkspace cohortId={cohortId} showHeader={false} />
    </Panel>
  );
}

interface StaffAnalytics {
  byCourse: { courseId: string; name: string; code: string; enrolled: number; classCount: number; present: number; possible: number; attendanceRate: number }[];
  totals: { enrolled: number; present: number; possible: number; attendanceRate: number };
}
interface StaffDemographics {
  gender: { label: string; count: number }[];
  nationality: { label: string; count: number }[];
  totalStudents: number;
}

type ChartMode = 'table' | 'bar' | 'pie';
const CHART_MODE_KEY = 'staffAnalyticsChartMode';
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

/** Which of table/bar/pie a viewer prefers — "those that understand what we currently have,
 * those that only understand bar graphs, and the ones that are circle format." Purely a per-viewer
 * display preference, not data, so it's kept in localStorage rather than round-tripped through the
 * server. */
function useChartMode(): [ChartMode, (m: ChartMode) => void] {
  const [mode, setModeState] = useState<ChartMode>(() => {
    try {
      return (localStorage.getItem(CHART_MODE_KEY) as ChartMode) || 'table';
    } catch {
      return 'table';
    }
  });
  const setMode = (m: ChartMode) => {
    setModeState(m);
    try { localStorage.setItem(CHART_MODE_KEY, m); } catch { /* private-browsing etc — harmless to skip persisting */ }
  };
  return [mode, setMode];
}

function ChartModeToggle({ mode, onChange }: { mode: ChartMode; onChange: (m: ChartMode) => void }) {
  const options: { value: ChartMode; label: string; icon: React.ElementType }[] = [
    { value: 'table', label: 'Table', icon: TableIcon },
    { value: 'bar', label: 'Bar', icon: BarChart3 },
    { value: 'pie', label: 'Pie', icon: PieChartIcon },
  ];
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
            mode === value ? 'bg-blue-500 text-white' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10'
          }`}
        >
          <Icon size={12} /> {label}
        </button>
      ))}
    </div>
  );
}

function BreakdownChart({ mode, data }: { mode: ChartMode; data: { label: string; count: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 py-4 text-center">No data yet.</p>;
  if (mode === 'table') {
    return (
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {data.map((d) => (
            <tr key={d.label}>
              <td className="py-1.5 text-gray-700 dark:text-gray-300">{d.label}</td>
              <td className="py-1.5 text-right font-medium text-gray-900 dark:text-white">{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (mode === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} (${e.value})`}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AnalyticsPanel({ showDemographics, cohortId }: { showDemographics: boolean; cohortId?: string }) {
  const [mode, setMode] = useChartMode();
  const { data: analytics } = useApi<StaffAnalytics>(withCohort('/staff/analytics', cohortId));
  const { data: demographics } = useApi<StaffDemographics>(showDemographics ? withCohort('/staff/analytics/demographics', cohortId) : null);

  const byCourseChartData = (analytics?.byCourse ?? []).map((c) => ({ label: c.code, count: c.attendanceRate }));

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-500" /> Analytics
        </h2>
        <ChartModeToggle mode={mode} onChange={setMode} />
      </div>

      {analytics && (
        <div className="grid grid-cols-3 gap-3 mb-5">
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
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Attendance rate by course</p>
          <BreakdownChart mode={mode} data={byCourseChartData} />
        </div>
        {showDemographics && demographics && (
          <>
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Gender</p>
              <BreakdownChart mode={mode} data={demographics.gender} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Nationality</p>
              <BreakdownChart mode={mode} data={demographics.nationality} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Cake, ClipboardCheck, Megaphone, Send, Info, Star, BarChart3, PieChart as PieChartIcon, Table as TableIcon, ChevronDown, Folder, Wrench } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { FacilitiesQueue } from '../../components/facilities/FacilitiesQueue';
import type { Permission, FeedbackRequest, FacilityTicket } from '../../types';
import { CampaignComposer, CampaignHistory } from '../../components/feedback/FeedbackCampaigns';

interface StaffBirthday {
  id: string; firstName: string; lastName: string; avatarUrl?: string | null;
  month: number; day: number; daysAway: number; isToday: boolean;
}
interface StaffCheckIn {
  id: string;
  student: { id: string; firstName: string; lastName: string; studentId?: string | null };
  course: { id: string; name: string; code: string } | null;
  classTitle: string; room: string | null; checkInAt: string; status: string;
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
export type StaffPanelKey = 'checkins' | 'manual-checkin' | 'broadcast' | 'materials' | 'feedback' | 'facilities' | 'analytics' | 'birthdays';

/** Panel display order — Birthdays deliberately LAST (per explicit request: a CEM's programme
 * page should lead with the operational panels, not birthdays). Doubles as the CEM per-programme
 * sidebar's own link order (Sidebar.tsx's buildCxmCohortLinks) and each panel's standalone-page
 * route order (CemCohortPanelPage.tsx) — keep all three in step. */
export const STAFF_PANEL_ORDER: StaffPanelKey[] = ['checkins', 'manual-checkin', 'broadcast', 'materials', 'feedback', 'facilities', 'analytics', 'birthdays'];
export const STAFF_PANEL_LABEL: Record<StaffPanelKey, string> = {
  checkins: 'Check-Ins', 'manual-checkin': 'Manual Check-in', broadcast: 'Broadcast', materials: 'Materials',
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
    broadcast: BROADCAST_PERMISSIONS.some((p) => perms.has(p)),
    materials: perms.has('MANAGE_MATERIALS'),
    feedback: perms.has('REQUEST_FEEDBACK'),
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
      {show('broadcast') && granted.broadcast && <BroadcastPanel perms={perms} cohortId={cohortId} open={!!only} />}
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

function BirthdaysPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const { data } = useApi<StaffBirthday[]>(withCohort('/staff/birthdays', cohortId));
  return (
    <Panel id="panel-birthdays" title="Birthdays" icon={Cake} defaultOpen={open}>
      {!data?.length ? (
        <p className="text-sm text-gray-400 py-4 text-center">No upcoming birthdays in your assigned courses.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {data.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
              <span className="text-sm text-gray-800 dark:text-gray-200">{b.firstName} {b.lastName}</span>
              <span className={`text-xs font-semibold ${b.isToday ? 'text-pink-500' : 'text-gray-400'}`}>
                {b.isToday ? 'Today 🎂' : `${MONTH_NAMES[b.month - 1]} ${b.day}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Consolidated Check-Ins panel — a Manual/Aura toggle instead of two separate always-visible
 * lists (matches the same consolidation already shipped on iOS/Android). "Aura Check-In" is
 * this system's user-facing term for what used to be labeled "BLE" everywhere. */
function CombinedCheckInsPanel({ canManual, canOnSite, cohortId, open = false }: { canManual: boolean; canOnSite: boolean; cohortId?: string; open?: boolean }) {
  const [type, setType] = useState<'manual' | 'ble'>(canManual ? 'manual' : 'ble');
  const { data } = useApi<StaffCheckIn[]>(withCohort(`/staff/checkins?type=${type}`, cohortId));
  return (
    <Panel id="panel-checkins" title="Check-Ins" icon={ClipboardCheck} defaultOpen={open}>
      {canManual && canOnSite && (
        <div className="flex gap-1 p-1 mb-3 rounded-xl bg-gray-100 dark:bg-white/5 text-sm">
          <button
            onClick={() => setType('manual')}
            className={`flex-1 py-1.5 rounded-lg cursor-pointer ${type === 'manual' ? 'bg-white dark:bg-white/15 shadow font-medium' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Manual
          </button>
          <button
            onClick={() => setType('ble')}
            className={`flex-1 py-1.5 rounded-lg cursor-pointer ${type === 'ble' ? 'bg-white dark:bg-white/15 shadow font-medium' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Aura Check-In
          </button>
        </div>
      )}
      {!data?.length ? (
        <p className="text-sm text-gray-400 py-4 text-center">No {type === 'ble' ? 'Aura' : 'manual'} check-ins yet.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {data.map((c) => (
            <li key={c.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-800 dark:text-gray-200">{c.student.firstName} {c.student.lastName}</span>
                <span className="text-xs text-gray-400">{new Date(c.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-xs text-gray-400">{c.course?.name} &middot; {c.classTitle}</p>
            </li>
          ))}
        </ul>
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

type BroadcastTemplate = 'STUDENTS_APPROVED' | 'CLASS_SCHEDULE' | 'PROGRAM_WELCOME' | 'MATERIALS_READY' | 'UPDATE';

export const BROADCAST_PERMISSIONS: Permission[] = [
  'BROADCAST_STUDENTS_APPROVED', 'BROADCAST_CLASS_SCHEDULE', 'BROADCAST_PROGRAM_WELCOME', 'BROADCAST_MATERIALS_READY', 'BROADCAST_UPDATE',
];

const TEMPLATE_META: Record<BroadcastTemplate, { permission: Permission; label: string }> = {
  STUDENTS_APPROVED: { permission: 'BROADCAST_STUDENTS_APPROVED', label: 'Students Approved' },
  CLASS_SCHEDULE: { permission: 'BROADCAST_CLASS_SCHEDULE', label: 'Class Starting' },
  PROGRAM_WELCOME: { permission: 'BROADCAST_PROGRAM_WELCOME', label: 'Program Welcome' },
  MATERIALS_READY: { permission: 'BROADCAST_MATERIALS_READY', label: 'Materials Ready' },
  UPDATE: { permission: 'BROADCAST_UPDATE', label: 'Free-form Update' },
};

const UPDATE_QUICK_TOPICS = ['Schedule Change', 'Room Change', 'Class Cancelled', 'General Reminder', 'Event Announcement', 'Emergency Notice', 'Assignment Due', 'Holiday Notice'];

function BroadcastPanel({ perms, cohortId, open = false }: { perms: Set<string>; cohortId?: string; open?: boolean }) {
  const { data: courses } = useApi<StaffCourse[]>(withCohort('/staff/courses', cohortId));
  const { mutate: send, loading } = useMutation('post');
  const [courseId, setCourseId] = useState('');
  const available = (Object.keys(TEMPLATE_META) as BroadcastTemplate[]).filter((t) => perms.has(TEMPLATE_META[t].permission));
  const [template, setTemplate] = useState<BroadcastTemplate>(available[0] ?? 'STUDENTS_APPROVED');
  const [room, setRoom] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [breakfastFrom, setBreakfastFrom] = useState('');
  const [breakfastTo, setBreakfastTo] = useState('');
  const [programName, setProgramName] = useState('');
  const [venue, setVenue] = useState('');
  const [classroom, setClassroom] = useState('');
  const [duration, setDuration] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceLabel, setResourceLabel] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [status, setStatus] = useState('');

  const submit = async () => {
    if (!courseId) { setStatus('Pick a course first.'); return; }
    try {
      if (template === 'UPDATE') {
        await send('/broadcasts', { courseId, title: updateTitle, body: updateBody });
      } else {
        await send('/broadcasts', {
          courseId,
          template,
          ...(template === 'CLASS_SCHEDULE' ? { room, dateFrom, dateTo, timeFrom, timeTo, breakfastFrom: breakfastFrom || undefined, breakfastTo: breakfastTo || undefined } : {}),
          ...(template === 'PROGRAM_WELCOME' ? { programName, venue, classroom, duration } : {}),
          ...(template === 'MATERIALS_READY' ? { resourceUrl: resourceUrl || undefined, resourceLabel: resourceLabel || undefined } : {}),
        });
      }
      setStatus('Sent — students will see it in-app and by email.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to send.');
    }
  };

  return (
    <Panel id="panel-broadcast" title="Broadcast" icon={Megaphone} defaultOpen={open}>
      <div className="space-y-3">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white">
          <option value="">Select a course…</option>
          {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {available.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemplate(t)}
              className={`px-3 py-2 rounded-xl text-sm font-medium border cursor-pointer ${template === t ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
            >
              {TEMPLATE_META[t].label}
            </button>
          ))}
        </div>
        {template === 'CLASS_SCHEDULE' && (
          <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
            <Input placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" label="Start time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
              <Input type="time" label="End time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" label="Breakfast from (optional)" value={breakfastFrom} onChange={(e) => setBreakfastFrom(e.target.value)} />
              <Input type="time" label="Breakfast to (optional)" value={breakfastTo} onChange={(e) => setBreakfastTo(e.target.value)} />
            </div>
          </div>
        )}
        {template === 'PROGRAM_WELCOME' && (
          <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
            <Input placeholder="Program name" value={programName} onChange={(e) => setProgramName(e.target.value)} />
            <Input placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
            <Input placeholder="Classroom" value={classroom} onChange={(e) => setClassroom(e.target.value)} />
            <Input placeholder="Duration (e.g. 5 days)" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        )}
        {template === 'MATERIALS_READY' && (
          <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
            <Input placeholder="Materials link (optional)" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} />
            <Input placeholder="Link label (optional)" value={resourceLabel} onChange={(e) => setResourceLabel(e.target.value)} />
          </div>
        )}
        {template === 'UPDATE' && (
          <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
            <div className="flex flex-wrap gap-1.5">
              {UPDATE_QUICK_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setUpdateTitle(topic)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer ${updateTitle === topic ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
                >
                  {topic}
                </button>
              ))}
            </div>
            <Input placeholder="Title" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} />
            <textarea
              placeholder="Message"
              value={updateBody}
              onChange={(e) => setUpdateBody(e.target.value)}
              rows={3}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white"
            />
          </div>
        )}
        <Button onClick={() => void submit()} disabled={loading || !courseId} size="sm" className="w-full">
          <Send size={14} className="mr-1.5" /> Send Broadcast
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
}

function MaterialsPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const { data: materials, refetch } = useApi<StaffMaterial[]>(withCohort('/staff/materials', cohortId));
  const { data: courses } = useApi<StaffCourse[]>(withCohort('/staff/courses', cohortId));
  const { mutate: create, loading } = useMutation('post');
  const [isAdding, setIsAdding] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    await create('/staff/materials', { courseId: courseId || null, title, description: description || undefined, url: url || undefined });
    setTitle(''); setDescription(''); setUrl(''); setCourseId(''); setIsAdding(false);
    refetch();
  };

  return (
    <Panel id="panel-materials" title="Materials" icon={Folder} defaultOpen={open}>
      <div className="space-y-3">
        {!materials?.length ? (
          <p className="text-sm text-gray-400 py-2">No materials yet.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {materials.map((m) => (
              <li key={m.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.title}</span>
                  <span className="text-xs text-gray-400">{m.course?.name ?? 'General'}</span>
                </div>
                {m.description && <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>}
                {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Open</a>}
              </li>
            ))}
          </ul>
        )}
        {isAdding ? (
          <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white">
              <option value="">General (all courses)</option>
              {(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={loading || !title.trim()} size="sm">Save Material</Button>
              <Button onClick={() => setIsAdding(false)} size="sm" variant="secondary">Cancel</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setIsAdding(true)} size="sm" variant="secondary">+ Add Material</Button>
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

type FeedbackMode = 'STUDENT' | 'COHORT';

/** One-student mode reuses the original single-attendance flow (POST /staff/request-feedback,
 * unchanged). Cohort mode is the new ad hoc survey (POST /feedback-requests) — every student in
 * one Cohort at once, sent on both push/in-app and email with a deep link into the mobile popup
 * (see server/src/services/feedbackRequest.service.ts). The "Sent requests" list underneath lets
 * the sender switch between cohorts/past requests to pull up that one's particular results. */
function FeedbackRequestPanel({ cohortId, open = false }: { cohortId?: string; open?: boolean }) {
  const [mode, setMode] = useState<FeedbackMode>('STUDENT');

  return (
    <Panel id="panel-feedback" title="Request Feedback" icon={Star} defaultOpen={open}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('STUDENT')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border cursor-pointer ${mode === 'STUDENT' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
          >
            One Student
          </button>
          <button
            type="button"
            onClick={() => setMode('COHORT')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border cursor-pointer ${mode === 'COHORT' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'}`}
          >
            Whole Cohort
          </button>
        </div>
        {mode === 'STUDENT' ? <StudentFeedbackRequestForm cohortId={cohortId} /> : <CohortFeedbackRequestForm defaultCohortId={cohortId} />}
      </div>
    </Panel>
  );
}

function StudentFeedbackRequestForm({ cohortId }: { cohortId?: string }) {
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentLabel, setStudentLabel] = useState('');
  const { mutate: request, loading } = useMutation('post');
  const [status, setStatus] = useState('');
  const { data: results } = useApi<StaffStudent[]>(search.trim().length >= 2 ? withCohort(`/staff/students?search=${encodeURIComponent(search.trim())}`, cohortId) : null);

  const submit = async () => {
    if (!studentId) return;
    try {
      await request('/staff/request-feedback', { studentId });
      setStatus(`Feedback requested from ${studentLabel}.`);
      setStudentId('');
      setStudentLabel('');
      setSearch('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to request feedback.');
    }
  };

  return (
    <div className="space-y-3">
      {studentId ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-sm">
          <span>{studentLabel}</span>
          <button onClick={() => { setStudentId(''); setStudentLabel(''); }} className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer">Change</button>
        </div>
      ) : (
        <div className="relative">
          <Input placeholder="Search by name or student ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {results && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setStudentId(r.id); setStudentLabel(`${r.firstName} ${r.lastName}`); setSearch(''); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  {r.firstName} {r.lastName} {r.studentId ? `(${r.studentId})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Button onClick={() => void submit()} disabled={loading || !studentId} size="sm" className="w-full">Request Feedback</Button>
      {status && <p className="text-xs text-gray-500 dark:text-gray-400">{status}</p>}
    </div>
  );
}

interface StaffCohort { id: string; name: string; year: number }

function CohortFeedbackRequestForm({ defaultCohortId }: { defaultCohortId?: string }) {
  const { data: cohorts } = useApi<StaffCohort[]>('/staff/cohorts');
  const { data: sent, refetch: refetchSent } = useApi<FeedbackRequest[]>('/feedback-requests');
  const [cohortId, setCohortId] = useState(defaultCohortId ?? '');

  // SBS Phase 5 — same composer/history/anonymous results as the admin Request Feedback page
  // (components/feedback/FeedbackCampaigns.tsx); only the cohort list differs (staff-scoped).
  return (
    <div className="space-y-4">
      {!cohorts?.length ? (
        <p className="text-xs text-gray-400">No cohorts reachable through your assigned courses yet.</p>
      ) : (
        <CampaignComposer
          cohortId={cohortId}
          onSent={() => { setCohortId(defaultCohortId ?? ''); refetchSent({ silent: true }); }}
          audience={(
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="staff-campaign-cohort">Cohort</label>
              <select id="staff-campaign-cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="w-full text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-gray-900 dark:text-white">
                <option value="">Select a cohort…</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
              </select>
            </div>
          )}
        />
      )}

      {!!sent?.length && (
        <div className="pt-2 border-t border-gray-100 dark:border-white/10">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your campaigns</p>
          <CampaignHistory requests={sent} onChanged={() => refetchSent({ silent: true })} compact />
        </div>
      )}
    </div>
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

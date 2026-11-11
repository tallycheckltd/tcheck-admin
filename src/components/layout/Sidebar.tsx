import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useApi } from '../../hooks/useApi';
import {
  LayoutDashboard, School, Users, Users2, Settings, BookOpen, Calendar,
  Radio, FileText, MessageSquare, Sun, Moon, LogOut, UserCheck, ClipboardList,
  BarChart3, Sparkles, Smartphone, GraduationCap, Tags, Link2, Megaphone, Star, Presentation,
  ShieldAlert, ChevronDown, ChevronRight, ChevronLeft, X, LifeBuoy, PanelLeftClose, PanelLeftOpen, ScanEye, Search, Radar, Layers, Siren, Battery, Network, UploadCloud,
  User as UserIcon, Plug, Wrench, DoorOpen, FileBarChart, Eye, MailCheck, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardStats, Ticket, Escalation, FacilityTicket, Permission, User } from '../../types';
import { isHierarchyRole, ROLE_LABEL } from '../../lib/rbac';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
  children?: NavItem[];
  superAdminOnly?: boolean;
}

/* ---- SUPER_ADMIN (Tallycheck Global) ---- */
const superAdminOverview: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview' },
  // Moi Pilot's main screen — sign-ins, check-ins, PIN lockouts (AnalyticsPage.tsx).
  { to: '/analytics', icon: Activity, label: 'Analytics' },
];

const superAdminAdmin: NavItem[] = [
  { to: '/admin/schools', icon: School, label: 'Schools' },
  { to: '/admin/school-admins', icon: Users, label: 'School Admins' },
  { to: '/admin/people', icon: Network, label: 'People & Organization' },
  { to: '/admin/integrations', icon: Plug, label: 'Integrations' },
  { to: '/admin/email-activity', icon: MailCheck, label: 'Email Activity' },
  { to: '/admin/setup-wizard', icon: UploadCloud, label: 'Setup Wizard' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
  // Cohort CRUD existed as a page (CohortsPage.tsx) but had no route/nav entry before the SBS
  // Comms & Concierge plan (Phase 2) needed cohort->CEM assignment reachable in the UI.
  { to: '/admin/cohorts', icon: Users2, label: 'Cohorts' },
  { to: '/admin/levels', icon: GraduationCap, label: 'Levels' },
  { to: '/admin/majors', icon: Tags, label: 'Majors' },
  { to: '/admin/course-assignments', icon: Link2, label: 'Course Assignments' },
  // Cross-CEM oversight report (cem.routes.ts's GET /cem/report) — "detailed data on CEMs,
  // programmes and students, exportable to PDF" for whoever actually manages CEMs day to day.
  { to: '/admin/cem-reports', icon: FileBarChart, label: 'CEM & Programmes Report' },
];

const superAdminGeneral: NavItem[] = [
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  // Executive Ed Phase 9 — visible to SUPER_ADMIN unconditionally (global role, not scoped to one
  // school's execEdSuite flag); the page itself is empty/harmless for a school with no NPS data.
  { to: '/insights', icon: Presentation, label: 'Insights' },
  { to: '/admin/nps-analytics', icon: Star, label: 'NPS Analytics' },
  { to: '/admin/beacons', icon: Sparkles, label: 'Aura Sensors' },
  { to: '/admin/classrooms', icon: DoorOpen, label: 'Classrooms' },
  { to: '/admin/beacon-heatmap', icon: Radar, label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: Battery, label: 'Aura Health' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/admin/escalations', icon: Siren, label: 'Escalations' },
  { to: '/admin/facilities', icon: Wrench, label: 'Facilities' },
  { to: '/admin/system-announcements', icon: Megaphone, label: 'System Announcements' },
  { to: '/admin/request-feedback', icon: Star, label: 'Request Feedback' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- ADMIN / SUB_ADMIN (University HOD) ---- */
const hodOverview: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  // SUB_ADMIN + SCHOOL_ADMIN only (hodOverview isn't shared with ICT_ADMIN/hierarchy navs) —
  // matches the RequireRole guard on /analytics in App.tsx.
  { to: '/analytics', icon: Activity, label: 'Analytics' },
];

const hodAdmin: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  // The school-scoped "create a user, assign them a role, roles carry permissions" page — see
  // PeopleOrganizationPage.tsx. Distinct from the plain Users list above (roster/approvals).
  { to: '/admin/people', icon: Network, label: 'People & Organization' },
  { to: '/admin/integrations', icon: Plug, label: 'Integrations' },
  { to: '/admin/email-activity', icon: MailCheck, label: 'Email Activity' },
  { to: '/admin/setup-wizard', icon: UploadCloud, label: 'Setup Wizard' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
  { to: '/admin/levels', icon: GraduationCap, label: 'Levels' },
  { to: '/admin/majors', icon: Tags, label: 'Majors' },
  { to: '/admin/course-assignments', icon: Link2, label: 'Course Assignments' },
  { to: '/admin/cem-reports', icon: FileBarChart, label: 'CEM & Programmes Report' },
];

const hodOperations: NavItem[] = [
  { to: '/courses', icon: BookOpen, label: 'All Courses' },
  { to: '/classes', icon: Calendar, label: 'Classes' },
  {
    to: '/admin/attendance',
    icon: ClipboardList,
    label: 'Attendance',
    children: [
      { to: '/admin/attendance-overview', icon: ClipboardList, label: 'Overview' },
      { to: '/admin/attendance-analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/attendance', icon: UserCheck, label: 'Sessions' },
    ],
  },
  { to: '/admin/fraud-detection', icon: ShieldAlert, label: 'Fraud Detection' },
  { to: '/admin/escalations', icon: Siren, label: 'Escalations' },
  { to: '/admin/facilities', icon: Wrench, label: 'Facilities' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/lecturer-presence', icon: UserCheck, label: 'Lecturer Presence' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  // Executive Ed Phase 9 — hidden entirely unless this school has execEdSuite on, via
  // filterBySchoolConfig/hiddenNavLabels below (same mechanism as the Announcements/Terms toggle).
  { to: '/insights', icon: Presentation, label: 'Insights' },
  { to: '/admin/nps-analytics', icon: Star, label: 'NPS Analytics' },
];

const hodGeneral: NavItem[] = [
  { to: '/admin/beacons', icon: Sparkles, label: 'Aura Sensors' },
  { to: '/admin/classrooms', icon: DoorOpen, label: 'Classrooms' },
  { to: '/admin/beacon-heatmap', icon: Radar, label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: Battery, label: 'Aura Health' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  // FIXED: AdminMessagesPage (conversation/flag oversight) was previously reachable by nobody —
  // guarded SUPER_ADMIN-only in App.tsx while its backend routes require SUB_ADMIN/SCHOOL_ADMIN
  // and explicitly exclude SUPER_ADMIN, and had no nav link for either. Distinct from "Messages"
  // above (that's this admin's own personal conversations).
  { to: '/admin/messages', icon: Eye, label: 'Message Oversight' },
  { to: '/admin/system-announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/admin/request-feedback', icon: Star, label: 'Request Feedback' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- LECTURER ---- */
const lecturerLinks: NavItem[] = [
  { to: '/lecturer', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Courses' },
  { to: '/classes', icon: Calendar, label: 'Classes' },
  // FIXED: program.routes.ts's GET /programs already permits LECTURER — this nav entry was
  // missing, so a lecturer could never reach the page the backend already lets them read.
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/escalations', icon: Siren, label: 'Escalations' },
  { to: '/admin/facilities', icon: Wrench, label: 'Facilities' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Device Verification' },
  // Birthdays/check-ins/manual check-in/broadcasts — only shown when the lecturer actually holds
  // at least one staff-capability permission; the page itself renders an empty state otherwise
  // rather than being hidden entirely, since that's cheaper than threading permission fetches
  // into this static nav array. Same page as CLIENT_EXPERIENCE_MANAGER's cxmLinks below.
  { to: '/staff', icon: UserCheck, label: 'Staff View' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/insights', icon: Presentation, label: 'Insights' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
];

/* ---- CLIENT_EXPERIENCE_MANAGER — front-of-house, not tied to a taught Course like LECTURER.
   Thin at the top level: Birthdays/Check-Ins/Manual Check-in/Broadcast/Materials/Request Feedback
   only mean something scoped to one particular programme, so those stay per-programme-only
   (cxmCohortLinks/buildCxmCohortLinks below). Facilities is the one exception — per explicit
   request, a CEM also gets a top-level Facilities page (CemFacilitiesPage, StaffPanelsGrid's
   `only` mode with no cohortId) pooling every open ticket across every programme they manage, not
   just one at a time. "Programs" is the post-login landing page (lib/rbac.ts's homeRouteFor),
   leading with aggregate analytics + the "My programmes" card list (CemDashboardPage) — clicking
   into one switches the sidebar itself into the 7-item per-programme panel list below. Messages
   here is pooled across every assigned programme; the per-programme variant lives in
   cxmCohortLinks instead. */
const cxmLinks: NavItem[] = [
  { to: '/cem', icon: Layers, label: 'Programs' },
  { to: '/cem/facilities', icon: Wrench, label: 'Facilities' },
  { to: '/insights', icon: Presentation, label: 'Insights' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
];

/** Shown instead of `cxmLinks` while viewing one specific programme (`/cem/cohorts/:cohortId`) —
 * built per-render since every `to` is parameterized by the cohort in view. Each panel is its own
 * real page/route (CemCohortPanelPage.tsx), not a hash-anchored section of one shared page, per
 * explicit request — order matches STAFF_PANEL_ORDER (StaffViewPage.tsx), Birthdays deliberately
 * last. Messages carries `?cohortId=` so its contact list narrows to just this programme's
 * executives (message.service.ts's getContacts). */
function buildCxmCohortLinks(cohortId: string): NavItem[] {
  const base = `/cem/cohorts/${cohortId}`;
  return [
    { to: '/cem', icon: ChevronLeft, label: 'Back to Programs' },
    { to: base, icon: Users, label: 'Overview & Students' },
    { to: `${base}/checkins`, icon: UserCheck, label: 'Check-Ins' },
    { to: `${base}/manual-checkin`, icon: ClipboardList, label: 'Manual Check-in' },
    { to: `${base}/broadcast`, icon: Megaphone, label: 'Broadcast' },
    { to: `${base}/materials`, icon: FileText, label: 'Materials' },
    { to: `${base}/feedback`, icon: Star, label: 'Request Feedback' },
    { to: `${base}/facilities`, icon: Wrench, label: 'Facilities' },
    { to: `${base}/birthdays`, icon: Sparkles, label: 'Birthdays' },
    { to: `/messages?cohortId=${cohortId}`, icon: MessageSquare, label: 'Messages' },
  ];
}

/** Which Permission(s) gate a LECTURER/CLIENT_EXPERIENCE_MANAGER nav item — an array means "any
 * one of these", matching staff.controller.ts's own granularity for the Staff View tab. A link
 * with no entry here (Dashboard, Courses, Classes, Attendance, Alerts, Announcements) is core to
 * the role itself, never gated — only ever applied when the viewer is actually on a CustomRole
 * (see requiredPermissionFilter below); everyone else keeps seeing the full legacy set unchanged. */
const requiredPermissionFor: Record<string, Permission | Permission[]> = {
  '/live': 'VIEW_LIVE_ATTENDANCE',
  '/reports': 'VIEW_REPORTS',
  '/admin/escalations': 'VIEW_ESCALATIONS',
  '/admin/facilities': 'VIEW_FACILITIES',
  '/cem/facilities': 'VIEW_FACILITIES',
  '/admin/invigilation': 'VIEW_INVIGILATION',
  '/admin/device-verification': 'VIEW_DEVICE_VERIFICATION',
  '/messages': 'MESSAGING',
  '/staff': ['VIEW_BIRTHDAYS', 'VIEW_BLE_CHECKINS', 'VIEW_MANUAL_CHECKINS', 'MANUAL_CHECK_IN', 'REQUEST_FEEDBACK'],
};

/* ---- Enterprise hierarchy tiers (Phase 5) — VC/DVC/Dean/HOD/Deputy HOD share one broad
   operations-facing nav; Registrars get a records-only nav; ICT Admin gets infra-only. See
   spec §4's Menu Visibility Matrix; DEPUTY_HOD's narrower Terms/Programs access is filtered
   out at render time below, not by a separate array. ---- */
const hierarchyOverview: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
];

const hierarchyAdmin: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/setup-wizard', icon: UploadCloud, label: 'Setup Wizard' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
  // Backend gates this to DEAN/HOD (not DEPUTY_HOD) — matches the Sidebar's own existing
  // `role === 'DEPUTY_HOD' ? hierarchyAdmin.filter(l => l.label === 'Users') : hierarchyAdmin`
  // narrowing below, so DEPUTY_HOD never sees this entry either.
  { to: '/admin/cem-reports', icon: FileBarChart, label: 'CEM & Programmes Report' },
];

const hierarchyOperations: NavItem[] = [
  { to: '/courses', icon: BookOpen, label: 'All Courses' },
  { to: '/classes', icon: Calendar, label: 'Classes' },
  {
    to: '/admin/attendance',
    icon: ClipboardList,
    label: 'Attendance',
    children: [
      { to: '/admin/attendance-overview', icon: ClipboardList, label: 'Overview' },
      { to: '/admin/attendance-analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/attendance', icon: UserCheck, label: 'Sessions' },
    ],
  },
  { to: '/admin/fraud-detection', icon: ShieldAlert, label: 'Fraud Detection' },
  { to: '/admin/escalations', icon: Siren, label: 'Escalations' },
  { to: '/admin/facilities', icon: Wrench, label: 'Facilities' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  // Executive Ed Phase 9 — same execEdSuite gating as hodOperations above.
  { to: '/insights', icon: Presentation, label: 'Insights' },
  { to: '/admin/nps-analytics', icon: Star, label: 'NPS Analytics' },
];

/* ---- The "Executive Diet" (§18.3) — VC/DVC need institutional oversight, not granular IT or
   classroom-management tools. A deliberately thin nav: Dashboard, Users (view-only, enforced in
   UsersPage.tsx), Attendance, Fraud Detection, Reports — nothing else. ---- */
const execAdmin: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Users' },
];

const execOperations: NavItem[] = [
  {
    to: '/admin/attendance',
    icon: ClipboardList,
    label: 'Attendance',
    children: [
      { to: '/admin/attendance-overview', icon: ClipboardList, label: 'Overview' },
      { to: '/admin/attendance-analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/attendance', icon: UserCheck, label: 'Sessions' },
    ],
  },
  { to: '/admin/fraud-detection', icon: ShieldAlert, label: 'Fraud Detection' },
  // Executive Ed Phase 9 — the VC/DVC "Executive Diet" nav is exactly this feature's home
  // audience; gated the same as everywhere else via hiddenNavLabels/filterBySchoolConfig.
  { to: '/insights', icon: Presentation, label: 'Insights' },
  { to: '/admin/nps-analytics', icon: Star, label: 'NPS Analytics' },
  { to: '/admin/cem-reports', icon: FileBarChart, label: 'CEM & Programmes Report' },
];

const execGeneral: NavItem[] = [
  { to: '/reports', icon: FileText, label: 'Reports' },
];

const hierarchyGeneral: NavItem[] = [
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- Registrar (Academic/Administration) — records-only, no operational modules ---- */
const registrarAdmin: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
];

const registrarGeneral: NavItem[] = [
  { to: '/attendance', icon: ClipboardList, label: 'Attendance Records' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- ICT Admin — infrastructure only ---- */
const ictAdminLinks: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'System Health' },
  { to: '/admin/beacons', icon: Sparkles, label: 'Aura Sensors' },
  { to: '/admin/classrooms', icon: DoorOpen, label: 'Classrooms' },
  { to: '/admin/beacon-heatmap', icon: Radar, label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: Battery, label: 'Aura Health' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Device Verification' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/messages', icon: MessageSquare, label: 'System Alerts' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/** Live clock under the brand header — ticks every second so the glow reads as "live" rather
 * than a static timestamp that happens to be right once. */
function LiveClock({ collapsed }: { collapsed: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <p
      className={clsx(
        'mt-1 flex items-center gap-1.5 text-[10.5px] leading-none tabular-nums text-[color:var(--app-text-muted)] whitespace-nowrap overflow-hidden',
        collapsed && 'lg:hidden',
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
      </span>
      <span className="truncate">{date} &middot; {time}</span>
    </p>
  );
}

/** A titled (collapsible) or untitled (flat) block of nav rows. `isActive` overrides NavLink's own
 * pathname matching for links whose activeness depends on more than the path (the CEM programme
 * panels' `?cohortId=` Messages link). */
interface NavGroup {
  title?: string;
  links: NavItem[];
  isActive?: (link: NavItem) => boolean;
}

/** Pages a role has at or below this count get the narrower, content-height sidebar. */
const FEW_PAGES_THRESHOLD = 6;
const COLLAPSED_GROUPS_KEY = 'sidebarCollapsedGroups';

function readCollapsedGroups(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Mirrors NavLink's own matching: `end` routes match exactly, everything else matches itself and
 * any nested path. Used to find which group holds the current page (so it can be opened). */
function pathMatches(to: string, pathname: string): boolean {
  const path = to.split('?')[0];
  if (path === '/admin' || path === '/lecturer') return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function linkIsActive(link: NavItem, pathname: string, group?: NavGroup): boolean {
  if (group?.isActive) return group.isActive(link);
  if (link.children?.length) return link.children.some((c) => pathMatches(c.to, pathname));
  return pathMatches(link.to, pathname);
}

const ROW_BASE =
  'relative flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] leading-none font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
const ROW_RAIL = 'lg:justify-center lg:px-0 lg:w-10 lg:mx-auto';

function NavIcon({ Icon, active }: { Icon: React.ComponentType<{ size?: number }>; active: boolean }) {
  return (
    <span
      className={clsx(
        'flex items-center justify-center w-4 h-4 flex-shrink-0 transition-colors',
        active ? 'text-blue-600 dark:text-blue-400' : 'opacity-75',
      )}
      aria-hidden="true"
    >
      <Icon size={16} />
    </span>
  );
}

function NavBadge({ count, collapsed }: { count?: number; collapsed: boolean }) {
  if (!count) return null;
  if (collapsed) {
    return (
      <span
        className="hidden lg:block absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[color:var(--app-elevated-solid)]"
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="text-[10px] leading-none font-semibold bg-blue-500 text-white px-1.5 py-[3px] rounded-full min-w-[18px] text-center tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavRow({
  link, collapsed, onNavigate, forcedActive,
}: {
  link: NavItem; collapsed: boolean; onNavigate: () => void; forcedActive?: boolean;
}) {
  const location = useLocation();
  const hasChildren = !!link.children?.length;
  const childActive = hasChildren && link.children!.some((c) => pathMatches(c.to, location.pathname));
  // Rows with sub-pages start expanded when one of them is the current page.
  const [expanded, setExpanded] = useState(childActive);

  const label = (
    <span className={clsx('flex-1 min-w-0 truncate text-left', collapsed && 'lg:hidden')}>{link.label}</span>
  );

  if (hasChildren && !collapsed) {
    const subId = `nav-sub-${link.label.replace(/\W+/g, '-').toLowerCase()}`;
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={subId}
          className={clsx(ROW_BASE, 'w-full cursor-pointer', childActive ? 'nav-link-active' : 'nav-link-idle')}
        >
          <NavIcon Icon={link.icon} active={childActive} />
          {label}
          <ChevronRight size={14} className={clsx('shrink-0 opacity-60 transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
        </button>
        {expanded && (
          <div id={subId} className="mt-0.5 ml-[17px] pl-3 border-l border-[color:var(--sidebar-edge)] space-y-0.5">
            {link.children!.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center h-7 px-2.5 rounded-md text-[12.5px] leading-none font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                    isActive ? 'nav-link-active' : 'nav-link-idle',
                  )
                }
              >
                <span className="truncate">{child.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  // In collapsed rail mode there's no room for a flyout submenu — the parent becomes a direct link
  // to its first child instead of an expand toggle.
  const target = hasChildren ? link.children![0].to : link.to;
  return (
    <NavLink
      to={target}
      end={target === '/admin' || target === '/lecturer'}
      onClick={onNavigate}
      title={collapsed ? link.label : undefined}
      aria-label={collapsed ? link.label : undefined}
      className={({ isActive }) => {
        const active = forcedActive ?? (isActive || childActive);
        return clsx(ROW_BASE, collapsed && ROW_RAIL, active ? 'nav-link-active' : 'nav-link-idle');
      }}
    >
      {({ isActive }) => {
        const active = forcedActive ?? (isActive || childActive);
        return (
          <>
            <NavIcon Icon={link.icon} active={active} />
            {label}
            {!collapsed && <NavBadge count={link.badge} collapsed={false} />}
            {collapsed && <NavBadge count={link.badge} collapsed />}
          </>
        );
      }}
    </NavLink>
  );
}

function NavSection({
  group, collapsed, groupCollapsed, onToggleGroup, onNavigate, showDivider,
}: {
  group: NavGroup;
  collapsed: boolean;
  groupCollapsed: boolean;
  onToggleGroup: (title: string) => void;
  onNavigate: () => void;
  showDivider: boolean;
}) {
  const location = useLocation();
  if (group.links.length === 0) return null;
  const { title } = group;
  // Titled groups collapse from their header. Rail mode (desktop only) has no headers to click, so
  // a collapsed group's rows stay visible there via `lg:block` while the mobile drawer hides them.
  const open = !title || !groupCollapsed;
  const listId = title ? `nav-group-${title.replace(/\W+/g, '-').toLowerCase()}` : undefined;

  return (
    <div className={clsx(title && 'pt-2 first:pt-0')}>
      {title && (
        <button
          type="button"
          onClick={() => onToggleGroup(title)}
          aria-expanded={open}
          aria-controls={listId}
          className={clsx(
            'group/sec flex items-center w-full h-6 px-2.5 mb-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-[0.08em] cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 hover:text-[color:var(--app-text)] dark:hover:text-slate-200',
            collapsed && 'lg:hidden',
          )}
          style={{ color: 'var(--nav-section)' }}
        >
          <span className="flex-1 text-left truncate">{title}</span>
          <ChevronDown
            size={12}
            className={clsx('shrink-0 opacity-0 group-hover/sec:opacity-100 group-focus-visible/sec:opacity-100 transition-all', !open && '-rotate-90 opacity-100')}
            aria-hidden="true"
          />
        </button>
      )}
      {collapsed && showDivider && (
        <div className="hidden lg:block mx-3 my-2 h-px bg-[color:var(--sidebar-edge)]" aria-hidden="true" />
      )}
      {(open || collapsed) && (
        <div id={listId} className={clsx('space-y-0.5', !open && 'hidden lg:block')}>
          {group.links.map((link) => (
            <NavRow
              key={`${link.to}-${link.label}`}
              link={link}
              collapsed={collapsed}
              onNavigate={onNavigate}
              forcedActive={group.isActive ? linkIsActive(link, location.pathname, group) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}


/** Collapses Search/Theme/Logout behind one avatar trigger instead of three permanently-visible
 * rows — was the last thing in the sidebar feeling like "an old sidebar" (a flat list of account
 * actions with no chrome around them). Opens as a popover above the trigger since the trigger
 * itself lives at the very bottom of the screen. */
function ProfileMenu({
  user, roleAccent, dark, onToggleTheme, onOpenSearch, onLogout, collapsed,
}: {
  user: User | null | undefined;
  roleAccent: string;
  dark: boolean;
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onLogout: () => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The sidebar is content-height now, so with a short nav the trigger can sit high on the screen —
  // the menu opens downward when there isn't room for it above.
  const [openUp, setOpenUp] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const MENU_HEIGHT_ESTIMATE = 300;

  const toggleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(rect.top >= MENU_HEIGHT_ESTIMATE + 12);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Each row gets its own tinted icon tile so the menu reads at a glance in light mode too —
  // the old uniform grey boxes on white washed out into one flat block.
  const itemClass = 'group flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer transition-colors text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
  const iconTileClass = 'flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 ring-1 ring-inset transition-colors';
  const roleLabel = user?.role ? ROLE_LABEL[user.role] : undefined;

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            // Deliberately opaque and painted via inline style rather than Tailwind's dark:
            // variant — this dropdown sits directly over other content in the same panel (nav
            // items, or the page behind it when the rail is collapsed), and a solid hex here
            // guarantees full coverage regardless of any compositing/paint-order quirk.
            className={clsx(
              'absolute left-0 z-50 isolate w-64 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden',
              'shadow-[0_18px_48px_-12px_rgba(15,23,42,0.28),0_4px_12px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_48px_-12px_rgba(0,0,0,0.6)]',
              openUp ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-2 origin-top-left',
            )}
            style={{ backgroundColor: dark ? '#0f172a' : '#ffffff' }}
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 dark:border-white/[0.06] bg-gradient-to-br from-slate-50 to-blue-50/60 dark:from-white/[0.03] dark:to-blue-500/[0.06]">
              <div className={clsx(`w-9 h-9 rounded-full bg-gradient-to-br ${roleAccent} flex items-center justify-center text-white text-xs font-semibold shadow-sm flex-shrink-0`)}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate text-slate-900 dark:text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11.5px] truncate text-slate-500 dark:text-slate-400">{user?.email}</p>
                {roleLabel && (
                  <span className="mt-1 inline-flex items-center px-1.5 py-px rounded-md text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    {roleLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="p-1.5 space-y-0.5">
              <button onClick={() => { onOpenSearch(); setOpen(false); }} type="button" className={itemClass}>
                <span className={clsx(iconTileClass, 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/15')}>
                  <Search size={16} />
                </span>
                <span className="flex-1 text-left">Search</span>
                <kbd className="inline-flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-md text-[10px] font-semibold border border-slate-200 bg-slate-50 text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:shadow-none">
                  /
                </kbd>
              </button>
              <button onClick={() => { navigate('/profile'); setOpen(false); }} type="button" className={itemClass}>
                <span className={clsx(iconTileClass, 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/15')}>
                  <UserIcon size={16} />
                </span>
                <span className="flex-1 text-left">My Profile</span>
              </button>
              {/* Stays open on toggle so you see the switch flip; role="switch" exposes state to AT. */}
              <button onClick={onToggleTheme} type="button" role="switch" aria-checked={dark} className={itemClass}>
                <span className={clsx(iconTileClass, dark
                  ? 'bg-slate-700/60 text-slate-200 ring-white/10'
                  : 'bg-amber-50 text-amber-600 ring-amber-100')}>
                  {dark ? <Moon size={16} /> : <Sun size={16} />}
                </span>
                <span className="flex-1 text-left">Appearance</span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{dark ? 'Dark' : 'Light'}</span>
                <span
                  aria-hidden="true"
                  className={clsx(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    dark ? 'bg-indigo-500' : 'bg-slate-300',
                  )}
                >
                  <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', dark ? 'translate-x-[18px]' : 'translate-x-0.5')} />
                </span>
              </button>
            </div>

            <div className="p-1.5 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                onClick={() => { onLogout(); setOpen(false); }}
                type="button"
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                <span className={clsx(iconTileClass, 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/15')}>
                  <LogOut size={16} />
                </span>
                <span className="flex-1 text-left">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggleOpen}
        title={collapsed ? `${user?.firstName} ${user?.lastName}` : undefined}
        aria-expanded={open}
        aria-label={`Account menu for ${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
        className={clsx(
          'flex items-center gap-2 w-full p-1.5 rounded-xl border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
          open
            ? 'bg-black/[0.04] dark:bg-white/[0.07] border-black/5 dark:border-white/5'
            : 'bg-black/[0.03] dark:bg-white/[0.05] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
          collapsed && 'lg:justify-center lg:px-0',
        )}
      >
        <div className="relative flex-shrink-0">
          <div className={clsx(`w-7 h-7 rounded-full bg-gradient-to-br ${roleAccent} flex items-center justify-center text-white text-[11px] font-semibold ring-2 ring-[color:var(--app-elevated-solid)] shadow-sm`)}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[color:var(--app-elevated-solid)]" aria-hidden="true" />
        </div>
        <div className={clsx('flex-1 min-w-0 text-left', collapsed && 'lg:hidden')}>
          <p className="text-[12.5px] leading-tight font-semibold truncate text-[color:var(--app-text)] dark:text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-[11px] leading-tight truncate text-[color:var(--app-text-muted)] dark:text-slate-500">{user?.email}</p>
        </div>
        <ChevronDown
          size={14}
          className={clsx('shrink-0 transition-transform text-[color:var(--app-text-muted)]', open && 'rotate-180', collapsed && 'lg:hidden')}
        />
      </button>
    </div>
  );
}

export function Sidebar({
  open, onClose, collapsed, onToggleCollapse, onOpenSearch, onFewPagesChange,
}: {
  open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void; onOpenSearch: () => void;
  /** Reports whether this role's nav is short enough for the narrower sidebar, so the layout can
   * match its content offset. */
  onFewPagesChange?: (fewPages: boolean) => void;
}) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  // Context-sensitive CEM nav: viewing one specific programme swaps the flat [Programs, Messages]
  // nav for the 7-panel + Messages list scoped to that cohort (buildCxmCohortLinks above).
  const cxmCohortMatch = location.pathname.match(/^\/cem\/cohorts\/([^/]+)/);
  const cxmCohortId = cxmCohortMatch?.[1];
  // SCHOOL_ADMIN behaves exactly like SUB_ADMIN in the sidebar — same nav, same "Administration"
  // section — see server-side SCHOOL_ADMIN_TIER for the equivalent backend-side grouping.
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN' || user?.role === 'SCHOOL_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isRegistrar = user?.role === 'REGISTRAR_ACADEMIC' || user?.role === 'REGISTRAR_ADMIN';
  const isIctAdmin = user?.role === 'ICT_ADMIN';
  const isExecutive = user?.role === 'VC' || user?.role === 'DVC';
  const isHierarchyOps = isHierarchyRole(user?.role) && !isRegistrar && !isIctAdmin && !isExecutive;
  const isCxm = user?.role === 'CLIENT_EXPERIENCE_MANAGER';
  const isLecturer = !isAdmin && !isRegistrar && !isIctAdmin && !isHierarchyOps && !isExecutive && !isCxm;

  // Pending-approvals badge — only SUB_ADMIN gets a Students link in the sidebar today, and
  // dashboard-stats is already scoped to their own school server-side.
  const { data: dashboardStats } = useApi<DashboardStats>(
    isAdmin && !isSuperAdmin ? '/attendance/dashboard-stats' : null,
    { refetchIntervalMs: 60_000, refetchWhenVisible: true },
  );
  const pendingApprovals = dashboardStats?.pendingApprovals || 0;

  // Open-tickets badge on Support — shown for both admin roles.
  const { data: ticketsData, refetch: refetchTickets } = useApi<Ticket[]>(
    isAdmin ? '/tickets?status=OPEN' : null,
    { refetchIntervalMs: 60_000, refetchWhenVisible: true },
  );
  const openTicketsCount = ticketsData?.length || 0;

  // Open-escalations badge — shown for every role that can see the page (SUPER_ADMIN, SUB_ADMIN,
  // LECTURER); the endpoint itself scopes a lecturer down to just their own classes. CEM has no
  // Escalations nav item at all (cxmLinks never runs addEscalationBadge), and the endpoint 403s a
  // CEM outright, so skip the fetch rather than firing it just to eat a console error every load.
  const { data: escalationsData, refetch: refetchEscalations } = useApi<Escalation[]>(
    isCxm ? null : '/escalations?status=OPEN',
    { refetchIntervalMs: 30_000, refetchWhenVisible: true },
  );
  const openEscalationsCount = escalationsData?.length || 0;

  // SBS Comms & Concierge plan, Phase 3 — open facility tickets badge, same shape as the
  // escalations badge above. STUDENT never renders this sidebar at all, so '/facility-tickets'
  // here always resolves to the LECTURER/admin "my queue + unclaimed" scope, never a student's own.
  const { data: facilityTicketsData, refetch: refetchFacilityTickets } = useApi<FacilityTicket[]>(
    user?.school?.features?.execEdSuite ? '/facility-tickets?status=OPEN' : null,
    { refetchIntervalMs: 30_000, refetchWhenVisible: true },
  );
  const openFacilityTicketsCount = facilityTicketsData?.length || 0;

  // Real-time ticket / escalation / facility-ticket badge updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const ticketHandler = () => refetchTickets({ silent: true });
    const escalationHandler = () => refetchEscalations({ silent: true });
    const facilityTicketHandler = () => refetchFacilityTickets({ silent: true });
    s.on('ticket:new', ticketHandler);
    s.on('ticket:updated', ticketHandler);
    // No dedicated socket event for escalations yet — the 30s poll above keeps this reasonably
    // fresh; a new message notification is a decent proxy trigger for an early refresh too, since
    // every escalation is also a DM to the lecturer.
    s.on('message:new', escalationHandler);
    s.on('facilityTicket:new', facilityTicketHandler);
    s.on('facilityTicket:updated', facilityTicketHandler);
    return () => { s.disconnect(); };
  }, [refetchTickets, refetchEscalations, refetchFacilityTickets]);

  const roleLabel = user?.role ? ROLE_LABEL[user.role] : 'Lecturer';
  const roleAccent = isSuperAdmin ? 'from-purple-500 to-purple-600' : isAdmin ? 'from-blue-500 to-blue-600' : 'from-emerald-500 to-emerald-600';

  const addTicketBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/support' ? { ...l, badge: openTicketsCount } : l);

  const addEscalationBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/escalations' ? { ...l, badge: openEscalationsCount } : l);

  const addFacilitiesBadge = (links: NavItem[]) =>
    links.map((l) => (l.to === '/admin/facilities' || l.to === '/cem/facilities') ? { ...l, badge: openFacilityTicketsCount } : l);

  const addPendingBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/users' ? { ...l, badge: pendingApprovals } : l);

  // Every nav item gated on the viewer's own school configuration resolves here, so there is one
  // place to change when a new per-school nav rule appears. SUPER_ADMIN manages every school, so
  // it bypasses all of this and always sees the full set.
  //
  // Terms and Programs are mutually exclusive by design (School.attendanceMode): a CALENDAR_BASED
  // school schedules against academic terms and never touches Programs, while a STAGE_BASED school
  // runs students through a Program/Module pipeline with no calendar at all. If a school ever needs
  // both at once, attendanceMode being a single either/or enum is the only thing in the way — split
  // it into two independent flags and widen this block; no other nav code reads it.
  const attendanceMode = user?.school?.attendanceMode ?? 'CALENDAR_BASED';
  const hiddenNavLabels = new Set<string>();
  if (!isSuperAdmin) {
    if (!(user?.school?.features?.broadcasts ?? true)) hiddenNavLabels.add('Announcements');
    hiddenNavLabels.add(attendanceMode === 'STAGE_BASED' ? 'Terms' : 'Programs');
    // Executive Ed Phase 9 — NPS Analytics only means anything for a school actually running the
    // NPS engine (Phase 6's sweep is itself execEdSuite-gated), so it's hidden everywhere else.
    if (!user?.school?.features?.execEdSuite) hiddenNavLabels.add('NPS Analytics');
    // Insights (Executive Reports + Feedback Intelligence, merged 09-27) — session feedback and the
    // exec-ed reporting model only exist at execEdSuite schools, so it's hidden everywhere else.
    if (!user?.school?.features?.execEdSuite) hiddenNavLabels.add('Insights');
    // SBS Comms & Concierge plan, Phase 3 — the Facilities queue is empty/unreachable server-side
    // for any school with execEdSuite off (every /facility-tickets route is gated on it), so hide
    // the nav entry rather than link to a page that can only ever show a 403.
    if (!user?.school?.features?.execEdSuite) hiddenNavLabels.add('Facilities');
  }
  const filterBySchoolConfig = (links: NavItem[]) =>
    hiddenNavLabels.size === 0 ? links : links.filter((l) => !hiddenNavLabels.has(l.label));

  // Only a LECTURER/CEM actually placed on a CustomRole gets their nav customized to what that
  // role was granted — everyone else (the overwhelming default: no CustomRole assigned) keeps
  // seeing the exact same nav they always have, so this can never silently take away access from
  // an existing account. `user.permissions` is already the *effective* set (resolveEffectivePermissions
  // on the server resolves CustomRole vs. direct grant before it ever reaches the client).
  const filterByPermission = (links: NavItem[]) => {
    // cxmLinks (Dashboard, Messages) carries nothing permission-gated any more — Staff
    // View/Facilities moved to CemCohortDetailPage, reachable only per-programme — so CEM no
    // longer needs a special-cased branch here; it falls through to the general rule below like
    // every other role.
    if (!user?.customRoleId) return links;
    const granted = user.permissions ?? [];
    return links.filter((l) => {
      const required = requiredPermissionFor[l.to];
      if (!required) return true;
      const requiredList = Array.isArray(required) ? required : [required];
      return requiredList.some((p) => granted.includes(p));
    });
  };

  // One list of groups per role — titled groups collapse from their header; flat roles get a single
  // untitled group. Order and filtering are unchanged from the per-role nav arrays above.
  const groups: NavGroup[] = (() => {
    if (isSuperAdmin) {
      return [
        { title: 'Overview', links: superAdminOverview },
        { title: 'Administration', links: superAdminAdmin },
        { title: 'General', links: addFacilitiesBadge(addEscalationBadge(addTicketBadge(superAdminGeneral))) },
      ];
    }
    if (isAdmin) {
      return [
        { title: 'Overview', links: hodOverview },
        { title: 'Administration', links: filterBySchoolConfig(addPendingBadge(hodAdmin)) },
        { title: 'Operations', links: filterBySchoolConfig(addFacilitiesBadge(addEscalationBadge(hodOperations))) },
        { title: 'General', links: filterBySchoolConfig(addTicketBadge(hodGeneral)) },
      ];
    }
    if (isExecutive) {
      return [
        { title: 'Overview', links: hierarchyOverview },
        { title: 'Administration', links: execAdmin },
        { title: 'Operations', links: filterBySchoolConfig(execOperations) },
        { title: 'General', links: execGeneral },
      ];
    }
    if (isHierarchyOps) {
      const isDeputy = user?.role === 'DEPUTY_HOD';
      return [
        { title: 'Overview', links: hierarchyOverview },
        { title: 'Administration', links: filterBySchoolConfig(isDeputy ? hierarchyAdmin.filter((l) => l.label === 'Users') : hierarchyAdmin) },
        {
          title: 'Operations',
          links: filterBySchoolConfig(addFacilitiesBadge(addEscalationBadge(
            isDeputy
              ? hierarchyOperations.filter((l) => l.label !== 'Fraud Detection' && l.label !== 'Escalations' && l.label !== 'Facilities')
              : hierarchyOperations,
          ))),
        },
        { title: 'General', links: filterBySchoolConfig(addTicketBadge(hierarchyGeneral)) },
      ];
    }
    if (isRegistrar) {
      return [
        { title: 'Overview', links: hierarchyOverview },
        { title: 'Administration', links: filterBySchoolConfig(registrarAdmin) },
        { title: 'General', links: filterBySchoolConfig(registrarGeneral) },
      ];
    }
    if (isIctAdmin) return [{ links: addEscalationBadge(ictAdminLinks) }];
    if (isLecturer) return [{ links: addFacilitiesBadge(addEscalationBadge(filterByPermission(filterBySchoolConfig(lecturerLinks)))) }];
    if (isCxm && cxmCohortId) {
      // Every panel is its own real route, so plain path matching works — except the overview link
      // (`/cem/cohorts/:id`), a prefix of every panel route, which must match exactly; and Messages,
      // which carries `?cohortId=` instead of a distinct path and is matched on the query string.
      const overview = `/cem/cohorts/${cxmCohortId}`;
      return [{
        links: buildCxmCohortLinks(cxmCohortId),
        isActive: (link: NavItem) => {
          if (link.to.startsWith('/messages')) {
            return location.pathname === '/messages' && location.search.includes(`cohortId=${cxmCohortId}`);
          }
          if (link.to === '/cem') return false;
          return link.to === overview ? location.pathname === overview : location.pathname === link.to;
        },
      }];
    }
    // Deliberately skips filterBySchoolConfig — that helper's Terms/Programs mutual-exclusivity rule
    // (keyed on the *label* "Programs") targets the unrelated admin/hierarchy nav item of the same
    // name and would otherwise hide a CEM's own "Programs" link on every CALENDAR_BASED school.
    if (isCxm) return [{ links: addFacilitiesBadge(filterByPermission(cxmLinks)) }];
    return [];
  })()
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.superAdminOnly || isSuperAdmin) }))
    .filter((g) => g.links.length > 0);

  const pageCount = groups.reduce((n, g) => n + g.links.length, 0);
  const fewPages = pageCount <= FEW_PAGES_THRESHOLD;

  useEffect(() => {
    onFewPagesChange?.(fewPages);
  }, [fewPages, onFewPagesChange]);

  // Collapsed section groups, remembered across visits. The group holding the current page is
  // re-opened whenever the route changes (derived during render, not in an effect), so you never
  // land on a page whose nav entry is hidden — you can still fold it again afterwards.
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(readCollapsedGroups);
  const [openedForRoute, setOpenedForRoute] = useState<string | null>(null);
  const routeKey = `${location.pathname}${location.search}`;
  const activeGroupTitle = groups.find((g) => g.title && g.links.some((l) => linkIsActive(l, location.pathname, g)))?.title;
  if (openedForRoute !== routeKey) {
    setOpenedForRoute(routeKey);
    if (activeGroupTitle && collapsedGroups.includes(activeGroupTitle)) {
      setCollapsedGroups(collapsedGroups.filter((t) => t !== activeGroupTitle));
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(collapsedGroups));
    } catch {
      /* storage blocked — the folding still works for this session */
    }
  }, [collapsedGroups]);

  const toggleGroup = (title: string) =>
    setCollapsedGroups((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));

  const desktopWidth = collapsed ? 'lg:w-[64px]' : fewPages ? 'lg:w-[212px]' : 'lg:w-[232px]';

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Sidebar"
        className={clsx(
          // Mobile: an edge-to-edge, full-height drawer. Desktop (lg:): a floating rounded card that
          // is only as tall as its content (capped at the viewport) — short role navs no longer
          // stretch into a tall empty column, and the user card sits right below the last group.
          'fixed inset-y-0 left-0 h-screen glass-sidebar flex flex-col z-40 border border-[color:var(--sidebar-edge)] transition-[transform,width] duration-200',
          'w-[248px]',
          'lg:inset-auto lg:left-3 lg:top-3 lg:h-auto lg:max-h-[calc(100vh-1.5rem)] lg:rounded-2xl',
          desktopWidth,
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
      {/* Collapse toggle — desktop only, straddles the sidebar's right edge */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className="hidden lg:flex absolute -right-3 top-[22px] z-10 w-6 h-6 rounded-full glass-sidebar border border-[color:var(--sidebar-edge)] items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer text-[color:var(--app-text-muted)]"
      >
        {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
      </button>

      <div className={clsx('px-3.5 py-3 flex items-center gap-2.5 border-b border-[color:var(--sidebar-edge)] shrink-0', collapsed && 'lg:justify-center lg:px-2')}>
        <img src="/logo.svg" alt="Tcheck" className="w-8 h-8 flex-shrink-0" />
        <div className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
          <p className="text-[14px] leading-tight font-semibold tracking-tight text-[color:var(--app-text)] dark:text-white whitespace-nowrap">Tcheck</p>
          <p className="mt-0.5 text-[10.5px] leading-tight font-medium uppercase tracking-[0.06em] text-[color:var(--app-accent-label)] truncate" title={roleLabel}>
            {roleLabel}
          </p>
          <LiveClock collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-[color:var(--app-text)] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X size={16} />
        </button>
      </div>

      <nav
        aria-label="Main navigation"
        className={clsx('sidebar-nav-scroll flex-1 lg:flex-initial min-h-0 px-2 py-2.5 space-y-0.5 overflow-y-auto overflow-x-hidden', collapsed && 'lg:px-1.5')}
      >
        {groups.map((group, i) => (
          <NavSection
            key={group.title ?? `group-${i}`}
            group={group}
            collapsed={collapsed}
            groupCollapsed={!!group.title && collapsedGroups.includes(group.title)}
            onToggleGroup={toggleGroup}
            onNavigate={onClose}
            showDivider={i > 0}
          />
        ))}
      </nav>

      <div className={clsx('p-2 border-t border-[color:var(--sidebar-edge)] shrink-0', collapsed && 'lg:px-1.5')}>
        <ProfileMenu
          user={user}
          roleAccent={roleAccent}
          dark={dark}
          onToggleTheme={toggle}
          onOpenSearch={() => { onOpenSearch(); onClose(); }}
          onLogout={() => { logout(); navigate('/login'); }}
          collapsed={collapsed}
        />
      </div>
      </aside>
    </>
  );
}

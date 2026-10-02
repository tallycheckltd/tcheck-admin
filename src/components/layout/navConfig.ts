/**
 * P2 (A2.1) — the dashboard's navigation as plain data: every nav item, the nav set each role gets
 * (the role table's `nav`, shared/roles.ts) and nothing React-specific, so the backend test suite
 * can load it and prove G-2.3 (no nav link sends a role to a page whose API refuses it —
 * server/src/routes/navAccess.test.ts). Icons are referenced by lucide name; Sidebar.tsx maps them.
 */
import type { NavSet, RoleName } from '../../shared/roles';
import { ROLE_TABLE } from '../../shared/roles';
import type { Permission } from '../../types';

export type IconName = 'ShieldCheck' | 'BarChart3' | 'Battery' | 'BookOpen' | 'Calendar' | 'ClipboardList' | 'DoorOpen' | 'Eye' | 'FileBarChart' | 'FileText' | 'GraduationCap' | 'Layers' | 'LayoutDashboard' | 'LifeBuoy' | 'Link2' | 'MailCheck' | 'Megaphone' | 'MessageSquare' | 'MessageSquareQuote' | 'Network' | 'Plug' | 'Presentation' | 'Radar' | 'Radio' | 'ScanEye' | 'School' | 'Settings' | 'ShieldAlert' | 'Siren' | 'Smartphone' | 'Sparkles' | 'Star' | 'Tags' | 'UploadCloud' | 'UserCheck' | 'Users' | 'Users2' | 'Wrench';

export interface NavLinkDef {
  to: string;
  icon: IconName;
  label: string;
  children?: NavLinkDef[];
  superAdminOnly?: boolean;
}

/* ---- SUPER_ADMIN (P10, A7.1/A7.2) — the watchtower. Its own area (/platform); tenant pages are
   not reachable (the API refuses them — middleware/platformGate.ts). ---- */
export const superAdminOverview: NavLinkDef[] = [
  { to: '/platform', icon: 'LayoutDashboard', label: 'Home' },
];

export const superAdminAdmin: NavLinkDef[] = [
  { to: '/platform/institutions', icon: 'School', label: 'Institutions' },
  { to: '/platform/onboarding', icon: 'UploadCloud', label: 'Onboarding' },
  { to: '/platform/billing', icon: 'FileBarChart', label: 'Billing' },
];

export const superAdminGeneral: NavLinkDef[] = [
  { to: '/platform/support', icon: 'LifeBuoy', label: 'Support' },
  { to: '/platform/grants', icon: 'ShieldCheck', label: 'Support access' },
  { to: '/platform/fleet', icon: 'Battery', label: 'Fleet health' },
  { to: '/platform/analytics', icon: 'BarChart3', label: 'Analytics' },
];

export const hodOverview: NavLinkDef[] = [
  { to: '/admin', icon: 'LayoutDashboard', label: 'Dashboard' },
];

export const hodAdmin: NavLinkDef[] = [
  { to: '/admin/users', icon: 'Users', label: 'Users' },
  // P3 (A2.4): Co-Admin is gone — a School Admin adds another School Admin here, by invite.
  { to: '/admin/school-admins', icon: 'ShieldCheck', label: 'School Admins' },
  // The school-scoped "create a user, assign them a role, roles carry permissions" page — see
  // PeopleOrganizationPage.tsx. Distinct from the plain Users list above (roster/approvals).
  { to: '/admin/people', icon: 'Network', label: 'People & Organization' },
  { to: '/admin/integrations', icon: 'Plug', label: 'Integrations' },
  { to: '/admin/email-activity', icon: 'MailCheck', label: 'Email Activity' },
  // P6 (A5.1): the ordered Institution Setup (dry run + apply) replaces the old 4-step wizard.
  { to: '/admin/setup', icon: 'UploadCloud', label: 'Institution Setup' },
  // P5 (A4): one Academics entry (Calendar, Programmes, Cohorts, Levels, Course links, Training
  // pipelines as tabs) replaces the six separate pages; their old URLs redirect (App.tsx).
  { to: '/admin/academics', icon: 'GraduationCap', label: 'Academics' },
  { to: '/admin/cem-reports', icon: 'FileBarChart', label: 'CEM & Programmes Report' },
  // P9 (D-11.8) — the CEM Manager board at tenant scope (hidden unless execEdSuite, Sidebar.tsx).
  { to: '/cem-team', icon: 'Users2', label: 'CEM Team' },
];

export const hodOperations: NavLinkDef[] = [
  { to: '/courses', icon: 'BookOpen', label: 'All Courses' },
  { to: '/classes', icon: 'Calendar', label: 'Classes' },
  {
    to: '/admin/attendance',
    icon: 'ClipboardList',
    label: 'Attendance',
    children: [
      { to: '/admin/attendance-overview', icon: 'ClipboardList', label: 'Overview' },
      { to: '/admin/attendance-analytics', icon: 'BarChart3', label: 'Analytics' },
      { to: '/attendance', icon: 'UserCheck', label: 'Sessions' },
    ],
  },
  { to: '/admin/fraud-detection', icon: 'ShieldAlert', label: 'Fraud Detection' },
  { to: '/admin/escalations', icon: 'Siren', label: 'Escalations' },
  { to: '/admin/facilities', icon: 'Wrench', label: 'Facilities' },
  { to: '/live', icon: 'Radio', label: 'Live Attendance' },
  { to: '/admin/lecturer-presence', icon: 'UserCheck', label: 'Lecturer Presence' },
  { to: '/admin/invigilation', icon: 'ScanEye', label: 'Invigilation' },
  // Executive Ed Phase 9 — hidden entirely unless this school has execEdSuite on, via
  // filterBySchoolConfig/hiddenNavLabels below (same mechanism as the Announcements/Terms toggle).
  { to: '/insights', icon: 'Presentation', label: 'Insights' },
  { to: '/admin/nps-analytics', icon: 'Star', label: 'NPS Analytics' },
];

export const hodGeneral: NavLinkDef[] = [
  { to: '/admin/beacons', icon: 'Sparkles', label: 'Aura Sensors' },
  { to: '/admin/classrooms', icon: 'DoorOpen', label: 'Classrooms' },
  { to: '/admin/beacon-heatmap', icon: 'Radar', label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: 'Battery', label: 'Aura Health' },
  { to: '/admin/device-verification', icon: 'Smartphone', label: 'Verification' },
  { to: '/reports', icon: 'FileText', label: 'Reports' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
  // FIXED: AdminMessagesPage (conversation/flag oversight) was previously reachable by nobody —
  // guarded SUPER_ADMIN-only in App.tsx while its backend routes require SCHOOL_ADMIN
  // and explicitly exclude SUPER_ADMIN, and had no nav link for either. Distinct from "Messages"
  // above (that's this admin's own personal conversations).
  { to: '/admin/messages', icon: 'Eye', label: 'Message Oversight' },
  { to: '/admin/system-announcements', icon: 'Megaphone', label: 'Announcements' },
  { to: '/admin/request-feedback', icon: 'Star', label: 'Request Feedback' },
  { to: '/admin/support', icon: 'LifeBuoy', label: 'Support' },
  { to: '/admin/settings', icon: 'Settings', label: 'Settings' },
];

export const lecturerLinks: NavLinkDef[] = [
  { to: '/lecturer', icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/courses', icon: 'BookOpen', label: 'Courses' },
  { to: '/classes', icon: 'Calendar', label: 'Classes' },
  // FIXED: program.routes.ts's GET /programs already permits LECTURER — this nav entry was
  // missing, so a lecturer could never reach the page the backend already lets them read.
  { to: '/admin/programs', icon: 'Layers', label: 'Training pipelines' },
  { to: '/attendance', icon: 'ClipboardList', label: 'Attendance' },
  { to: '/live', icon: 'Radio', label: 'Live Attendance' },
  { to: '/admin/escalations', icon: 'Siren', label: 'Escalations' },
  // UAT F9 — every lecturer gets the same set, Executive Education school or not: no Facilities,
  // Insights, Device Verification or Staff View (manual check-in stays on Live Attendance and on
  // an escalation).
  { to: '/admin/invigilation', icon: 'ScanEye', label: 'Invigilation' },
  { to: '/reports', icon: 'FileText', label: 'Reports' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
  { to: '/announcements', icon: 'Megaphone', label: 'Announcements' },
];

export const cxmLinks: NavLinkDef[] = [
  { to: '/cem', icon: 'Layers', label: 'Programmes' },
  { to: '/cem/facilities', icon: 'Wrench', label: 'Facilities' },
  { to: '/insights', icon: 'Presentation', label: 'Insights' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
  // UAT F17 — the one Announcements page (send to own courses / programmes).
  { to: '/announcements', icon: 'Megaphone', label: 'Announcements' },
];

/* ---- CEM_MANAGER (P9, A8.6) — the team board first; the facilities queue is the team's tickets. ---- */
export const cemManagerLinks: NavLinkDef[] = [
  { to: '/cem-team', icon: 'Users2', label: 'CEM Team' },
  { to: '/admin/facilities', icon: 'Wrench', label: 'Facilities' },
  // UAT F24 — read-only oversight of the manager's own CEMs' direct chats.
  { to: '/admin/messages', icon: 'Eye', label: 'Message Oversight' },
];

export const hierarchyOverview: NavLinkDef[] = [
  { to: '/admin', icon: 'LayoutDashboard', label: 'Dashboard' },
];

export const hierarchyAdmin: NavLinkDef[] = [
  { to: '/admin/users', icon: 'Users', label: 'Users' },
  // UAT F26 — Setup Wizard, Terms and CEM & Programmes Report removed for Dean / HOD / Deputy HOD:
  // setting the institution up is the School Admin's job.
  { to: '/admin/programs', icon: 'Layers', label: 'Training pipelines' },
];

export const hierarchyOperations: NavLinkDef[] = [
  { to: '/courses', icon: 'BookOpen', label: 'All Courses' },
  { to: '/classes', icon: 'Calendar', label: 'Classes' },
  {
    to: '/admin/attendance',
    icon: 'ClipboardList',
    label: 'Attendance',
    children: [
      { to: '/admin/attendance-overview', icon: 'ClipboardList', label: 'Overview' },
      { to: '/admin/attendance-analytics', icon: 'BarChart3', label: 'Analytics' },
      { to: '/attendance', icon: 'UserCheck', label: 'Sessions' },
    ],
  },
  { to: '/admin/fraud-detection', icon: 'ShieldAlert', label: 'Fraud Detection' },
  { to: '/admin/escalations', icon: 'Siren', label: 'Escalations' },
  { to: '/admin/facilities', icon: 'Wrench', label: 'Facilities' },
  { to: '/live', icon: 'Radio', label: 'Live Attendance' },
  { to: '/admin/invigilation', icon: 'ScanEye', label: 'Invigilation' },
  // Executive Ed Phase 9 — same execEdSuite gating as hodOperations above.
  { to: '/insights', icon: 'Presentation', label: 'Insights' },
  // P11 (A8.5) — Dean only (the group view is granted to VC / DVC / Dean; NAV_HIDE removes it for HODs).
  { to: '/insights/group', icon: 'Network', label: 'Institution group' },
  { to: '/admin/nps-analytics', icon: 'Star', label: 'NPS Analytics' },
];

// UAT (09-29) — VC / DVC see how the institution is doing and announce; no actionable tabs
// (no Users, Fraud Detection, Device Verification, CEM report).
export const execOperations: NavLinkDef[] = [
  {
    to: '/admin/attendance',
    icon: 'ClipboardList',
    label: 'Attendance',
    children: [
      { to: '/admin/attendance-overview', icon: 'ClipboardList', label: 'Overview' },
      { to: '/admin/attendance-analytics', icon: 'BarChart3', label: 'Analytics' },
    ],
  },
  // Executive Ed Phase 9 — gated the same as everywhere else via hiddenNavLabels/filterBySchoolConfig.
  { to: '/insights', icon: 'Presentation', label: 'Insights' },
  { to: '/admin/nps-analytics', icon: 'Star', label: 'NPS Analytics' },
  // P11 (A8.5) — the aggregate-only view across the institution group (only if granted).
  { to: '/insights/group', icon: 'Network', label: 'Institution group' },
];

export const execGeneral: NavLinkDef[] = [
  { to: '/reports', icon: 'FileText', label: 'Reports' },
  { to: '/announcements', icon: 'Megaphone', label: 'Announcements' },
];

// UAT (09-29): no Settings — school-wide rules are the School Admin's alone. Device Verification is
// HOD and higher (Deputy HOD hidden via NAV_HIDE), scoped to the unit's students on the server.
export const hierarchyGeneral: NavLinkDef[] = [
  { to: '/admin/device-verification', icon: 'Smartphone', label: 'Verification' },
  { to: '/reports', icon: 'FileText', label: 'Reports' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
  // UAT F17 — Dean / HOD / Deputy HOD announce to their own department.
  { to: '/announcements', icon: 'Megaphone', label: 'Announcements' },
];

export const registrarAdmin: NavLinkDef[] = [
  { to: '/admin/users', icon: 'Users', label: 'Users' },
  { to: '/admin/terms', icon: 'Calendar', label: 'Terms' },
  { to: '/admin/programs', icon: 'Layers', label: 'Training pipelines' },
];

export const registrarGeneral: NavLinkDef[] = [
  { to: '/attendance', icon: 'ClipboardList', label: 'Attendance Records' },
  { to: '/admin/invigilation', icon: 'ScanEye', label: 'Invigilation' },
  { to: '/reports', icon: 'FileText', label: 'Reports' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
];

export const ictAdminLinks: NavLinkDef[] = [
  // P2 (G-2.3): ICT Admin lands on beacon health — the admin overview's stats refuse this role.
  { to: '/admin/beacon-health', icon: 'LayoutDashboard', label: 'System Health' },
  { to: '/admin/beacons', icon: 'Sparkles', label: 'Aura Sensors' },
  { to: '/admin/classrooms', icon: 'DoorOpen', label: 'Classrooms' },
  { to: '/admin/beacon-heatmap', icon: 'Radar', label: 'Heatmap Simulator' },
  { to: '/admin/device-verification', icon: 'Smartphone', label: 'Device Verification' },
  { to: '/live', icon: 'Radio', label: 'Live Attendance' },
  { to: '/messages', icon: 'MessageSquare', label: 'System Alerts' },
];

/* ---- STAFF (P2) — a plain staff account: everything it sees comes from its granted permissions
   (Sidebar filters by requiredPermissionFor for this set, always). ---- */
export const staffLinks: NavLinkDef[] = [
  { to: '/staff', icon: 'UserCheck', label: 'Staff View' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
  { to: '/announcements', icon: 'Megaphone', label: 'Announcements' },
];

/* ---- INVIGILATOR (P2) — a scan-only account; the lecturer nav it used to share led to pages its
   API refuses. ---- */
export const invigilatorLinks: NavLinkDef[] = [
  { to: '/lecturer', icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/messages', icon: 'MessageSquare', label: 'Messages' },
  { to: '/announcements', icon: 'Megaphone', label: 'Announcements' },
];

/**
 * Links a role never gets even though its nav set has them — because the backend refuses that role
 * (P2 G-2.3). The sidebar and navTargetsForRole both apply this; fixing access server-side (not by
 * widening a guard in a pure refactor) is what removes an entry.
 */
export const NAV_HIDE: Partial<Record<RoleName, string[]>> = {
  // /programs is the training-pipeline API (LECTURER + admin tier only)
  REGISTRAR_ACADEMIC: ['/admin/programs'],
  REGISTRAR_ADMIN: ['/admin/programs'],
  DEAN: ['/admin/programs'],
  HOD: ['/admin/programs', '/insights/group'],
  DEPUTY_HOD: ['/admin/programs', '/admin/fraud-detection', '/admin/escalations', '/admin/facilities', '/insights/group', '/admin/device-verification'],
};

/** The sections each nav set renders, in order (titles as shown). */
export const NAV_SECTIONS: Record<NavSet, { title?: string; links: NavLinkDef[] }[]> = {
  superAdmin: [{ title: 'Overview', links: superAdminOverview }, { title: 'Administration', links: superAdminAdmin }, { title: 'General', links: superAdminGeneral }],
  admin: [{ title: 'Overview', links: hodOverview }, { title: 'Administration', links: hodAdmin }, { title: 'Operations', links: hodOperations }, { title: 'General', links: hodGeneral }],
  executive: [{ title: 'Overview', links: hierarchyOverview }, { title: 'Operations', links: execOperations }, { title: 'General', links: execGeneral }],
  hierarchyOps: [{ title: 'Overview', links: hierarchyOverview }, { title: 'Administration', links: hierarchyAdmin }, { title: 'Operations', links: hierarchyOperations }, { title: 'General', links: hierarchyGeneral }],
  registrar: [{ title: 'Overview', links: hierarchyOverview }, { title: 'Administration', links: registrarAdmin }, { title: 'General', links: registrarGeneral }],
  ict: [{ links: ictAdminLinks }],
  cem: [{ links: cxmLinks }],
  cemManager: [{ links: cemManagerLinks }],
  lecturer: [{ links: lecturerLinks }],
  staff: [{ links: staffLinks }],
  invigilator: [{ links: invigilatorLinks }],
  none: [],
};

/** Every page a role's sidebar can link to (all sections, children included; before per-school and
 * per-permission filtering, which only ever removes links). DEPUTY_HOD sees only "Users" of its
 * Administration section (Sidebar.tsx). */
export function navTargetsForRole(role: RoleName): string[] {
  const out = new Set<string>();
  const hidden = new Set(NAV_HIDE[role] ?? []);
  const walk = (links: NavLinkDef[]) => links.forEach((l) => { if (l.children) walk(l.children); else if (!hidden.has(l.to)) out.add(l.to); });
  for (const section of NAV_SECTIONS[ROLE_TABLE[role].nav]) {
    walk(role === 'DEPUTY_HOD' && section.links === hierarchyAdmin ? section.links.filter((l) => l.label === 'Users') : section.links);
  }
  return [...out];
}

/**
 * P2 (G-2.3) — the backend call each nav target's page cannot work without. The backend suite
 * (server/src/routes/navAccess.test.ts) checks, for every role, that every link its sidebar can
 * show points at a page whose call the real router admits for that role — so "the page opens,
 * then says no" cannot be shipped. Every nav target must be listed here.
 */
export const NAV_PAGE_API: Record<string, string> = {
  '/admin': 'GET /attendance/dashboard-stats',
  '/platform': 'GET /platform/home',
  '/platform/institutions': 'GET /platform/institutions',
  '/platform/onboarding': 'GET /platform/onboarding',
  '/platform/billing': 'GET /platform/billing',
  '/platform/support': 'GET /tickets',
  '/platform/grants': 'GET /platform/support-grants',
  '/platform/fleet': 'GET /platform/fleet',
  '/platform/analytics': 'GET /platform/home',
  '/admin/attendance-analytics': 'GET /attendance/campus-analytics',
  '/admin/attendance-overview': 'GET /attendance/dashboard-stats',
  '/admin/beacon-health': 'GET /beacons',
  '/admin/beacon-heatmap': 'GET /beacons',
  '/admin/beacons': 'GET /beacons',
  '/admin/cem-reports': 'GET /cem/report',
  '/admin/classrooms': 'GET /academic/classrooms',
  '/admin/academics': 'GET /academic/majors',
  '/admin/cohorts': 'GET /academic/cohorts',
  '/admin/course-assignments': 'GET /courses',
  '/admin/device-verification': 'GET /devices/pending',
  '/admin/email-activity': 'GET /email/deliveries',
  '/admin/escalations': 'GET /escalations',
  '/admin/facilities': 'GET /facility-tickets',
  '/admin/fraud-detection': 'GET /attendance/fraud-analytics',
  '/admin/integrations': 'GET /integrations/connections',
  '/admin/invigilation': 'GET /attendance/exam-cards',
  '/admin/lecturer-presence': 'GET /attendance/lecturer-punctuality',
  '/admin/levels': 'GET /academic/levels',
  '/admin/majors': 'GET /academic/majors',
  '/admin/messages': 'GET /messages/admin/conversations',
  '/admin/nps-analytics': 'GET /feedback/analytics/nps-by-lecturer',
  '/admin/people': 'GET /users',
  '/admin/programs': 'GET /programs',
  '/admin/request-feedback': 'GET /feedback-requests',
  '/admin/school-admins': 'GET /users',
  '/admin/schools': 'GET /schools',
  '/admin/settings': 'GET /schools/:id',
  '/admin/setup': 'GET /setup/templates',
  '/admin/setup-wizard': 'POST /setup-wizard/rooms',
  '/admin/support': 'GET /tickets',
  '/admin/system-announcements': 'GET /broadcasts/manage',
  '/admin/terms': 'GET /terms',
  '/admin/users': 'GET /users',
  '/announcements': 'GET /broadcasts',
  '/attendance': 'GET /attendance/class-stats',
  '/cem': 'GET /cem/dashboard',
  '/cem/facilities': 'GET /facility-tickets',
  '/cem-team': 'GET /cem-team/board',
  '/classes': 'GET /classes',
  '/courses': 'GET /courses',
  '/insights': 'GET /reports/overview',
  '/insights/feedback': 'GET /feedback/intelligence',
  '/insights/reports': 'GET /reports/overview',
  '/insights/group': 'GET /institutions/group-views/mine',
  '/lecturer': 'GET /classes',
  '/live': 'GET /courses',
  '/messages': 'GET /messages/conversations',
  '/reports': 'GET /classes',
  '/staff': 'GET /staff/cohorts',
};

/** Which Permission(s) gate a LECTURER/CLIENT_EXPERIENCE_MANAGER nav item — an array means "any
 * one of these", matching staff.controller.ts's own granularity for the Staff View tab. A link
 * with no entry here (Dashboard, Courses, Classes, Attendance, Alerts, Announcements) is core to
 * the role itself, never gated. Since P4 applied to every viewer (Sidebar.tsx filterByPermission);
 * server routes/presets.test.ts proves "Lecturer (default)" keeps every lecturer link. */
export const NAV_REQUIRED_PERMISSION: Record<string, Permission | Permission[]> = {
  '/live': 'VIEW_LIVE_ATTENDANCE',
  '/reports': 'VIEW_REPORTS',
  '/admin/escalations': 'VIEW_ESCALATIONS',
  '/admin/facilities': 'VIEW_FACILITIES',
  '/cem/facilities': 'VIEW_FACILITIES',
  '/cem-team': 'VIEW_CEM_TEAM',
  '/admin/invigilation': 'VIEW_INVIGILATION',
  '/admin/device-verification': 'VIEW_DEVICE_VERIFICATION',
  '/messages': 'MESSAGING',
  '/staff': ['VIEW_BIRTHDAYS', 'VIEW_BLE_CHECKINS', 'VIEW_MANUAL_CHECKINS', 'MANUAL_CHECK_IN', 'REQUEST_FEEDBACK'],
};

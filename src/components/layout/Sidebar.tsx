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
  BarChart3, Sparkles, Smartphone, GraduationCap, Tags, Link2, Megaphone, Star, MessageSquareQuote, Presentation,
  ShieldAlert, ShieldCheck, ChevronDown, ChevronRight, ChevronLeft, X, LifeBuoy, PanelLeftClose, PanelLeftOpen, ScanEye, Search, Radar, Layers, Siren, Battery, Network, UploadCloud,
  User as UserIcon, Plug, Wrench, DoorOpen, FileBarChart, Eye, MailCheck, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardStats, Ticket, Escalation, FacilityTicket, User } from '../../types';
import { ROLE_LABEL } from '../../lib/rbac';
import * as NAV from './navConfig';
import type { IconName, NavLinkDef } from './navConfig';
import { roleDef, ROLE_TABLE, homeRouteFor, type RoleName } from '../../shared/roles';

// P2: nav items live in navConfig.ts as plain data (icon names); this maps the names to components.
const ICONS: Record<IconName, React.ComponentType<{ size?: number }>> = { ShieldCheck, BarChart3, Battery, BookOpen, Calendar, ClipboardList, DoorOpen, Eye, FileBarChart, FileText, GraduationCap, Layers, LayoutDashboard, LifeBuoy, Link2, MailCheck, Megaphone, MessageSquare, MessageSquareQuote, Network, Plug, Presentation, Radar, Radio, ScanEye, School, Settings, ShieldAlert, Siren, Smartphone, Sparkles, Star, Tags, UploadCloud, UserCheck, Users, Users2, Wrench };
function withIcons(links: NavLinkDef[]): NavItem[] {
  return links.map((l) => ({ ...l, icon: ICONS[l.icon], children: l.children ? withIcons(l.children) : undefined }));
}

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  badge?: number;
  children?: NavItem[];
  superAdminOnly?: boolean;
}

/* ---- SUPER_ADMIN (Tallycheck Global) ---- */
const superAdminOverview = withIcons(NAV.superAdminOverview);

const superAdminAdmin = withIcons(NAV.superAdminAdmin);

const superAdminGeneral = withIcons(NAV.superAdminGeneral);

/* ---- ADMIN / SCHOOL_ADMIN (University HOD) ---- */
const hodOverview = withIcons(NAV.hodOverview);

const hodAdmin = withIcons(NAV.hodAdmin);

const hodOperations = withIcons(NAV.hodOperations);

const hodGeneral = withIcons(NAV.hodGeneral);

/* ---- LECTURER ---- */
const lecturerLinks = withIcons(NAV.lecturerLinks);

/* ---- CLIENT_EXPERIENCE_MANAGER — front-of-house, not tied to a taught Course like LECTURER.
   Thin at the top level: Birthdays/Check-Ins/Manual Check-in/Broadcast/Materials/Request Feedback
   only mean something scoped to one particular programme, so those stay per-programme-only
   (cxmCohortLinks/buildCxmCohortLinks below). Facilities is the one exception — per explicit
   request, a CEM also gets a top-level Facilities page (CemFacilitiesPage, StaffPanelsGrid's
   `only` mode with no cohortId) pooling every open ticket across every programme they manage, not
   just one at a time. "Programmes" is the post-login landing page (lib/rbac.ts's homeRouteFor),
   leading with aggregate analytics + the "My programmes" card list (CemDashboardPage) — clicking
   into one switches the sidebar itself into the 7-item per-programme panel list below. Messages
   here is pooled across every assigned programme; the per-programme variant lives in
   cxmCohortLinks instead. */
const cxmLinks = withIcons(NAV.cxmLinks);

/** Shown instead of `cxmLinks` while viewing one specific programme (`/cem/cohorts/:cohortId`) —
 * built per-render since every `to` is parameterized by the cohort in view. Each panel is its own
 * real page/route (CemCohortPanelPage.tsx), not a hash-anchored section of one shared page, per
 * explicit request — order matches STAFF_PANEL_ORDER (StaffViewPage.tsx), Birthdays deliberately
 * last. Messages carries `?cohortId=` so its contact list narrows to just this programme's
 * executives (message.service.ts's getContacts). */
function buildCxmCohortLinks(cohortId: string): NavItem[] {
  const base = `/cem/cohorts/${cohortId}`;
  return [
    { to: '/cem', icon: ChevronLeft, label: 'Back to Programmes' },
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

// Which Permission(s) gate a nav item: NAV_REQUIRED_PERMISSION in navConfig.ts (plain data, tested server-side).
const requiredPermissionFor = NAV.NAV_REQUIRED_PERMISSION;

/* ---- Enterprise hierarchy tiers (Phase 5) — VC/DVC/Dean/HOD/Deputy HOD share one broad
   operations-facing nav; Registrars get a records-only nav; ICT Admin gets infra-only. See
   spec §4's Menu Visibility Matrix; DEPUTY_HOD's narrower Terms/Programs access is filtered
   out at render time below, not by a separate array. ---- */
const hierarchyOverview = withIcons(NAV.hierarchyOverview);

const hierarchyAdmin = withIcons(NAV.hierarchyAdmin);

const hierarchyOperations = withIcons(NAV.hierarchyOperations);

/* ---- The "Executive Diet" (§18.3) — VC/DVC need institutional oversight, not granular IT or
   classroom-management tools. A deliberately thin nav: Dashboard, Users (view-only, enforced in
   UsersPage.tsx), Attendance, Fraud Detection, Reports — nothing else. ---- */
const execAdmin = withIcons(NAV.execAdmin);

const execOperations = withIcons(NAV.execOperations);

const execGeneral = withIcons(NAV.execGeneral);

const hierarchyGeneral = withIcons(NAV.hierarchyGeneral);

/* ---- Registrar (Academic/Administration) — records-only, no operational modules ---- */
const registrarAdmin = withIcons(NAV.registrarAdmin);

const registrarGeneral = withIcons(NAV.registrarGeneral);

/* ---- ICT Admin — infrastructure only ---- */
const ictAdminLinks = withIcons(NAV.ictAdminLinks);

/** Live clock under the brand header — ticks every second so the glow reads as "live" rather
 * than a static timestamp that happens to be right once. */
function LiveClock({ collapsed }: { collapsed: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <p
      className={clsx(
        'mt-1 flex items-center gap-1.5 text-[10px] font-mono tabular-nums tracking-tight text-blue-500 dark:text-blue-400 truncate',
        collapsed && 'lg:hidden',
      )}
      style={{ textShadow: '0 0 8px rgba(59,130,246,0.6)' }}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
      </span>
      <span className="truncate">{date} &middot; {time}</span>
    </p>
  );
}

function NavIcon({ Icon, active }: { Icon: React.ComponentType<{ size?: number }>; active: boolean }) {
  return (
    <span
      className={clsx(
        'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors',
        active ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'text-inherit',
      )}
    >
      <Icon size={18} />
    </span>
  );
}

function NavBadge({ count, collapsed }: { count?: number; collapsed: boolean }) {
  if (!count) return null;
  if (collapsed) {
    return (
      <span
        className="hidden lg:block absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-[color:var(--app-elevated-solid)]"
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavSection({
  title, links, isSuperAdmin, onNavigate, collapsed,
}: {
  title: string; links: NavItem[]; isSuperAdmin: boolean; onNavigate: () => void; collapsed: boolean;
}) {
  const visibleLinks = links.filter((l) => !l.superAdminOnly || isSuperAdmin);
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const location = window.location;

  if (visibleLinks.length === 0) return null;

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  return (
    <>
      <p
        className={clsx(
          'px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest first:pt-2 whitespace-nowrap overflow-hidden transition-opacity',
          collapsed && 'lg:hidden',
        )}
        style={{ color: 'var(--nav-section)' }}
      >
        {title}
      </p>
      {visibleLinks.map((link) => {
        const hasChildren = link.children && link.children.length > 0;
        const isExpanded = expandedItems.includes(link.label);
        const isChildActive = hasChildren && link.children?.some(child => location.pathname.startsWith(child.to));

        // In collapsed rail mode there's no room for a flyout submenu — the parent becomes a
        // direct link to its first child instead of an expand toggle.
        const collapsedParentTarget = hasChildren ? link.children![0].to : link.to;

        return (
          <div key={link.label} className="space-y-1 relative">
            {hasChildren && !collapsed ? (
              <button
                onClick={() => toggleExpand(link.label)}
                className={clsx(
                  'flex items-center gap-3 w-full px-2 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer',
                  isChildActive
                    ? 'nav-link-active font-semibold'
                    : 'nav-link-idle hover:bg-slate-100 dark:hover:bg-white/5',
                )}
              >
                <NavIcon Icon={link.icon} active={!!isChildActive} />
                <span className="flex-1 text-left whitespace-nowrap overflow-hidden">{link.label}</span>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <NavLink
                to={hasChildren ? collapsedParentTarget : link.to}
                end={link.to === '/admin' || link.to === '/lecturer'}
                onClick={onNavigate}
                title={collapsed ? link.label : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all relative',
                    collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                    (isActive || isChildActive) ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
                  )
                }
              >
                <NavIcon Icon={link.icon} active={!!isChildActive} />
                <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>
                  {link.label}
                </span>
                {!collapsed && <NavBadge count={link.badge} collapsed={false} />}
                {collapsed && <NavBadge count={link.badge} collapsed />}
              </NavLink>
            )}

            {hasChildren && isExpanded && !collapsed && (
              <div className="pl-9 space-y-1 animate-in slide-in-from-top-1 duration-200">
                {link.children?.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        isActive
                          ? 'nav-link-active border-l-2 border-blue-500'
                          : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300',
                      )
                    }
                  >
                    <child.icon size={16} />
                    <span>{child.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
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
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { switchTenant } = useAuth();

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

  const itemClass = 'flex items-center gap-3 w-full px-2.5 py-2 rounded-xl text-sm cursor-pointer transition-colors nav-link-idle';
  const iconBadgeClass = 'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 bg-black/[0.03] dark:bg-white/5';

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            // Deliberately opaque and painted via inline style rather than Tailwind's dark:
            // variant — this dropdown sits directly over other content in the same panel (nav
            // items, or the page behind it when the rail is collapsed), and a solid hex here
            // guarantees full coverage regardless of any compositing/paint-order quirk.
            className="absolute bottom-full left-0 z-50 isolate mb-2 w-64 rounded-2xl border border-[color:var(--sidebar-edge)] shadow-xl overflow-hidden p-1.5 space-y-0.5 origin-bottom-left"
            style={{ backgroundColor: dark ? '#0f172a' : '#ffffff' }}
          >
            <button onClick={() => { onOpenSearch(); setOpen(false); }} type="button" className={itemClass}>
              <span className={iconBadgeClass}><Search size={16} /></span>
              <span className="flex-1 text-left">Search</span>
              <kbd className="inline-flex items-center justify-center px-1.5 h-5 rounded-md text-[10px] font-medium border border-[color:var(--sidebar-edge)] text-[color:var(--app-text-muted)]">
                /
              </kbd>
            </button>
            <button onClick={() => { navigate('/profile'); setOpen(false); }} type="button" className={itemClass}>
              <span className={iconBadgeClass}><UserIcon size={16} /></span>
              <span className="flex-1 text-left">My Profile</span>
            </button>
            {(user?.memberships?.length ?? 0) > 1 && (
              <div data-testid="tenant-switcher">
                <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--app-text-muted)]">Switch institution</p>
                {user!.memberships!.map((m) => (
                  <button
                    key={m.schoolId}
                    type="button"
                    disabled={m.schoolId === user!.schoolId}
                    onClick={() => { setOpen(false); void switchTenant(m.schoolId).then((u) => { navigate(homeRouteFor(u.role as RoleName)); }); }}
                    className={`${itemClass} ${m.schoolId === user!.schoolId ? 'opacity-60 cursor-default' : ''}`}
                  >
                    <span className={iconBadgeClass}><Building2 size={16} /></span>
                    <span className="flex-1 text-left min-w-0">
                      <span className="block truncate">{m.schoolName}</span>
                      <span className="block text-[11px] text-[color:var(--app-text-muted)]">{ROLE_TABLE[m.role as RoleName]?.label ?? m.role}{m.schoolId === user!.schoolId ? ' · current' : ''}</span>
                    </span>
                  </button>
                ))}
                <div className="my-1 border-t border-[color:var(--sidebar-edge)]" />
              </div>
            )}
            <button onClick={() => { onToggleTheme(); setOpen(false); }} type="button" className={itemClass}>
              <span className={iconBadgeClass}>{dark ? <Sun size={16} /> : <Moon size={16} />}</span>
              <span className="flex-1 text-left">{dark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <div className="my-1 border-t border-[color:var(--sidebar-edge)]" />
            <button
              onClick={() => { onLogout(); setOpen(false); }}
              type="button"
              className="flex items-center gap-3 w-full px-2.5 py-2 rounded-xl text-sm text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 bg-red-500/10">
                <LogOut size={16} />
              </span>
              <span className="flex-1 text-left">Logout</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? `${user?.firstName} ${user?.lastName}` : undefined}
        className={clsx(
          'flex items-center gap-2 w-full p-2 rounded-2xl border transition-colors cursor-pointer',
          open
            ? 'bg-black/[0.04] dark:bg-white/[0.07] border-black/5 dark:border-white/5'
            : 'bg-black/[0.03] dark:bg-white/[0.05] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
          collapsed && 'lg:justify-center lg:px-0',
        )}
      >
        <div className="relative flex-shrink-0">
          <div className={clsx(`w-9 h-9 rounded-full bg-gradient-to-br ${roleAccent} flex items-center justify-center text-white text-xs font-bold ring-2 ring-[color:var(--app-elevated-solid)] shadow-sm`)}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[color:var(--app-elevated-solid)]" aria-hidden="true" />
        </div>
        <div className={clsx('flex-1 min-w-0 text-left', collapsed && 'lg:hidden')}>
          <p className="text-sm font-semibold truncate text-[color:var(--app-text)] dark:text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-[11px] truncate text-[color:var(--app-text-muted)] dark:text-slate-500">{user?.email}</p>
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
  open, onClose, collapsed, onToggleCollapse, onOpenSearch,
}: {
  open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void; onOpenSearch: () => void;
}) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  // Context-sensitive CEM nav: viewing one specific programme swaps the flat [Programs, Messages]
  // nav for the 7-panel + Messages list scoped to that cohort (buildCxmCohortLinks above).
  const cxmCohortMatch = location.pathname.match(/^\/cem\/cohorts\/([^/]+)/);
  const cxmCohortId = cxmCohortMatch?.[1];
  // SCHOOL_ADMIN behaves exactly like SCHOOL_ADMIN in the sidebar — same nav, same "Administration"
  // section — see server-side SCHOOL_ADMIN_TIER for the equivalent backend-side grouping.
  // P2: which nav set a role gets comes from the role table (shared/roles.ts `nav`), not from
  // booleans kept here. An unknown role falls back to the lecturer set, as before.
  const navSet = roleDef(user?.role)?.nav ?? 'lecturer';
  const isSuperAdmin = navSet === 'superAdmin';
  const isAdmin = navSet === 'superAdmin' || navSet === 'admin';
  const isRegistrar = navSet === 'registrar';
  const isIctAdmin = navSet === 'ict';
  const isExecutive = navSet === 'executive';
  const isHierarchyOps = navSet === 'hierarchyOps';
  const isCxm = navSet === 'cem';
  const isLecturer = navSet === 'lecturer' || navSet === 'invigilator';
  const lecturerNavLinks = navSet === 'invigilator' ? withIcons(NAV.invigilatorLinks) : lecturerLinks;
  const isStaff = navSet === 'staff';
  const staffNavLinks = withIcons(NAV.staffLinks);
  // P9: CEM Manager — its links are exactly its grants (VIEW_CEM_TEAM / VIEW_FACILITIES), like STAFF.
  const isCemManager = navSet === 'cemManager';
  const cemManagerNavLinks = withIcons(NAV.cemManagerLinks);

  // Pending-approvals badge — only SCHOOL_ADMIN gets a Students link in the sidebar today, and
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

  // Open-escalations badge — shown for every role that can see the page (SUPER_ADMIN, SCHOOL_ADMIN,
  // LECTURER); the endpoint itself scopes a lecturer down to just their own classes. CEM has no
  // Escalations nav item at all (cxmLinks never runs addEscalationBadge), and the endpoint 403s a
  // CEM outright, so skip the fetch rather than firing it just to eat a console error every load.
  const { data: escalationsData, refetch: refetchEscalations } = useApi<Escalation[]>(
    // P10: not the platform (refused); P9: a CEM Manager has no escalations queue.
    isCxm || isSuperAdmin || navSet === 'cemManager' ? null : '/escalations?status=OPEN',
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
    s.on('facilityTicket:changed', facilityTicketHandler); // P9: tenant staff room, id only
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
    hiddenNavLabels.add(attendanceMode === 'STAGE_BASED' ? 'Terms' : 'Training pipelines'); // P13: renamed from "Programs"
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
    // P9 — the CEM Manager board is Executive Education tooling (its routes are execEdSuite-gated).
    if (!user?.school?.features?.execEdSuite) hiddenNavLabels.add('CEM Team');
  }
  // P2: links the role table's nav set has but the backend refuses this role (navConfig NAV_HIDE).
  const roleHidden = new Set(user?.role ? NAV.NAV_HIDE[user.role] ?? [] : []);
  const filterBySchoolConfig = (links: NavItem[]): NavItem[] =>
    links
      .filter((l) => !hiddenNavLabels.has(l.label) && !roleHidden.has(l.to))
      .map((l) => (l.children ? { ...l, children: l.children.filter((c) => !roleHidden.has(c.to)) } : l));

  // Links gated by a permission (NAV_REQUIRED_PERMISSION) show only when the viewer holds it.
  // `user.permissions` is already the *effective* set (preset ± Adjust-Access differences,
  // resolved server-side by resolveEffectivePermissions).
  const filterByPermission = (links: NavItem[]) => {
    // cxmLinks (Dashboard, Messages) carries nothing permission-gated any more — Staff
    // View/Facilities moved to CemCohortDetailPage, reachable only per-programme — so CEM no
    // longer needs a special-cased branch here; it falls through to the general rule below like
    // every other role.
    // A STAFF account has no capability of its own, so its nav is always exactly its grants.
    // P4: applies to everyone — every lecturer is on a preset now ("Lecturer (default)" holds every
    // permission below, so its nav is unchanged); the no-CustomRole shortcut is gone.
    const granted = user?.permissions ?? [];
    return links.filter((l) => {
      const required = requiredPermissionFor[l.to];
      if (!required) return true;
      const requiredList = Array.isArray(required) ? required : [required];
      return requiredList.some((p) => granted.includes(p));
    });
  };

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
        className={clsx(
          // Floats clear of the viewport edges on desktop (lg:) — a rounded, fully-bordered card
          // with an ambient shadow instead of a flush panel glued to the browser chrome. The
          // mobile drawer (below lg:) stays edge-to-edge/square since it's a full-height overlay,
          // not a persistent piece of chrome, so "floating" there would just cost screen space.
          'fixed inset-y-0 left-0 h-screen glass-sidebar flex flex-col z-40 border border-[color:var(--sidebar-edge)] transition-[transform,width] duration-200',
          'w-64',
          'lg:inset-auto lg:left-3 lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-2xl',
          collapsed ? 'lg:w-[76px]' : 'lg:w-64',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
      {/* Collapse toggle — desktop only, straddles the sidebar's right edge */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden lg:flex absolute -right-3 top-7 w-6 h-6 rounded-full glass-sidebar items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer text-[color:var(--app-text-muted)]"
      >
        {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
      </button>

      <div className={clsx('p-5 flex items-center gap-3 border-b border-[color:var(--sidebar-edge)]', collapsed && 'lg:justify-center lg:px-3')}>
        <img src="/logo.svg" alt="Tcheck" className="w-10 h-10 flex-shrink-0" />
        <div className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
          <h1 className="text-lg font-bold tracking-tight text-[color:var(--app-text)] dark:text-white whitespace-nowrap">Tcheck</h1>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--app-accent-label)] whitespace-nowrap">
            {roleLabel}
          </p>
          <LiveClock collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className={clsx('lg:hidden p-1.5 rounded-lg text-[color:var(--app-text)] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer', collapsed && 'lg:hidden')}
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav-scroll flex-1 px-3 pt-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {isSuperAdmin && (
          <>
            <NavSection title="Overview" links={superAdminOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={superAdminAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={addFacilitiesBadge(addEscalationBadge(addTicketBadge(superAdminGeneral)))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isAdmin && !isSuperAdmin && (
          <>
            <NavSection title="Overview" links={hodOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={filterBySchoolConfig(addPendingBadge(hodAdmin))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Operations" links={filterBySchoolConfig(addFacilitiesBadge(addEscalationBadge(hodOperations)))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={filterBySchoolConfig(addTicketBadge(hodGeneral))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isExecutive && (
          <>
            <NavSection title="Overview" links={hierarchyOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={execAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Operations" links={filterBySchoolConfig(execOperations)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={execGeneral} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isHierarchyOps && (
          <>
            <NavSection title="Overview" links={hierarchyOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection
              title="Administration"
              links={filterBySchoolConfig(user?.role === 'DEPUTY_HOD' ? hierarchyAdmin.filter((l) => l.label === 'Users') : hierarchyAdmin)}
              isSuperAdmin={isSuperAdmin}
              onNavigate={onClose}
              collapsed={collapsed}
            />
            <NavSection
              title="Operations"
              links={filterBySchoolConfig(addFacilitiesBadge(addEscalationBadge(
                user?.role === 'DEPUTY_HOD'
                  ? hierarchyOperations.filter((l) => l.label !== 'Fraud Detection' && l.label !== 'Escalations' && l.label !== 'Facilities')
                  : hierarchyOperations,
              )))}
              isSuperAdmin={isSuperAdmin}
              onNavigate={onClose}
              collapsed={collapsed}
            />
            <NavSection title="General" links={filterBySchoolConfig(addTicketBadge(hierarchyGeneral))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isRegistrar && (
          <>
            <NavSection title="Overview" links={hierarchyOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={filterBySchoolConfig(registrarAdmin)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={filterBySchoolConfig(registrarGeneral)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isIctAdmin && addEscalationBadge(ictAdminLinks).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin'}
            onClick={onClose}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                isActive ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
              )
            }
          >
            <NavIcon Icon={link.icon} active={false} />
            <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>{link.label}</span>
            {!collapsed && <NavBadge count={link.badge} collapsed={false} />}
            {collapsed && <NavBadge count={link.badge} collapsed />}
          </NavLink>
        ))}
        {isLecturer && addFacilitiesBadge(addEscalationBadge(filterByPermission(filterBySchoolConfig(lecturerNavLinks)))).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/lecturer'}
            onClick={onClose}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                isActive ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
              )
            }
          >
            <NavIcon Icon={link.icon} active={false} />
            <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>{link.label}</span>
            {!collapsed && <NavBadge count={link.badge} collapsed={false} />}
            {collapsed && <NavBadge count={link.badge} collapsed />}
          </NavLink>
        ))}
        {isCemManager && addFacilitiesBadge(filterByPermission(filterBySchoolConfig(cemManagerNavLinks))).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onClose}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                isActive ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
              )
            }
          >
            <NavIcon Icon={link.icon} active={false} />
            <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>{link.label}</span>
            {!collapsed && <NavBadge count={link.badge} collapsed={false} />}
            {collapsed && <NavBadge count={link.badge} collapsed />}
          </NavLink>
        ))}
        {isStaff && filterByPermission(filterBySchoolConfig(staffNavLinks)).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/staff'}
            onClick={onClose}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                isActive ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
              )
            }
          >
            <NavIcon Icon={link.icon} active={false} />
            <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>{link.label}</span>
          </NavLink>
        ))}
        {isCxm && cxmCohortId && buildCxmCohortLinks(cxmCohortId).map((link) => {
          // Every panel is its own real route now, so NavLink's own pathname-based isActive works
          // natively — except the overview link (`/cem/cohorts/:id`), which is a *prefix* of every
          // panel route and needs `end` to avoid staying lit while on a sub-page. Messages carries
          // `?cohortId=` instead of a distinct path, so it's matched on the query string.
          const isOverview = link.to === `/cem/cohorts/${cxmCohortId}`;
          const isMessages = link.to.startsWith('/messages');
          const isActive = isMessages
            ? location.pathname === '/messages' && location.search.includes(`cohortId=${cxmCohortId}`)
            : isOverview
              ? location.pathname === link.to
              : location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={isOverview}
              onClick={onClose}
              title={collapsed ? link.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                isActive ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
              )}
            >
              <NavIcon Icon={link.icon} active={isActive} />
              <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>{link.label}</span>
            </NavLink>
          );
        })}
        {/* Deliberately skips filterBySchoolConfig — that helper's Terms/Programs mutual-exclusivity
            rule (keyed on the *label* "Training pipelines") targets the admin/hierarchy pipelines item
            and must never touch a CEM's own "Programmes" link on any
            CALENDAR_BASED school. */}
        {isCxm && !cxmCohortId && addFacilitiesBadge(filterByPermission(cxmLinks)).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onClose}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all',
                collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:mx-auto',
                isActive ? 'shadow-sm nav-link-active font-semibold' : 'nav-link-idle',
              )
            }
          >
            <NavIcon Icon={link.icon} active={false} />
            <span className={clsx('flex-1 whitespace-nowrap overflow-hidden', collapsed && 'lg:hidden')}>{link.label}</span>
            {!collapsed && <NavBadge count={link.badge} collapsed={false} />}
            {collapsed && <NavBadge count={link.badge} collapsed />}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
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

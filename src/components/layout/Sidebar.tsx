import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useApi } from '../../hooks/useApi';
import {
  LayoutDashboard, School, Users, Settings, BookOpen, Calendar,
  Radio, FileText, MessageSquare, Sun, Moon, LogOut, UserCheck, ClipboardList,
  BarChart3, Bluetooth, Smartphone, Bell, Megaphone,
  ShieldAlert, ChevronDown, ChevronRight, X, LifeBuoy, PanelLeftClose, PanelLeftOpen, ScanEye, Search, Radar, Layers, Siren, Battery, Network, UploadCloud,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardStats, Ticket, Escalation, User } from '../../types';
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
];

const superAdminAdmin: NavItem[] = [
  { to: '/admin/schools', icon: School, label: 'Schools' },
  { to: '/admin/school-admins', icon: Users, label: 'School Admins' },
  { to: '/admin/org-units', icon: Network, label: 'Organization' },
  { to: '/admin/setup-wizard', icon: UploadCloud, label: 'Setup Wizard' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
];

const superAdminGeneral: NavItem[] = [
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/beacons', icon: Bluetooth, label: 'TB Manager' },
  { to: '/admin/beacon-heatmap', icon: Radar, label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: Battery, label: 'Beacon Health' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/admin/escalations', icon: Siren, label: 'Escalations' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/admin/system-announcements', icon: Megaphone, label: 'System Announcements' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- ADMIN / SUB_ADMIN (University HOD) ---- */
const hodOverview: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
];

const hodAdmin: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/org-units', icon: Network, label: 'Organization' },
  { to: '/admin/setup-wizard', icon: UploadCloud, label: 'Setup Wizard' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
  { to: '/admin/programs', icon: Layers, label: 'Programs' },
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
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/lecturer-presence', icon: UserCheck, label: 'Lecturer Presence' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
];

const hodGeneral: NavItem[] = [
  { to: '/admin/beacons', icon: Bluetooth, label: 'TB Manager' },
  { to: '/admin/beacon-heatmap', icon: Radar, label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: Battery, label: 'Beacon Health' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/system-announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- LECTURER ---- */
const lecturerLinks: NavItem[] = [
  { to: '/lecturer', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Courses' },
  { to: '/classes', icon: Calendar, label: 'Classes' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/escalations', icon: Siren, label: 'Escalations' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Device Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
];

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
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
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
];

const execGeneral: NavItem[] = [
  { to: '/reports', icon: FileText, label: 'Reports' },
];

const hierarchyGeneral: NavItem[] = [
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
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
  { to: '/admin/beacons', icon: Bluetooth, label: 'TB Manager' },
  { to: '/admin/beacon-heatmap', icon: Radar, label: 'Heatmap Simulator' },
  { to: '/admin/beacon-health', icon: Battery, label: 'Beacon Health' },
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
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isRegistrar = user?.role === 'REGISTRAR_ACADEMIC' || user?.role === 'REGISTRAR_ADMIN';
  const isIctAdmin = user?.role === 'ICT_ADMIN';
  const isExecutive = user?.role === 'VC' || user?.role === 'DVC';
  const isHierarchyOps = isHierarchyRole(user?.role) && !isRegistrar && !isIctAdmin && !isExecutive;
  const isLecturer = !isAdmin && !isRegistrar && !isIctAdmin && !isHierarchyOps && !isExecutive;
  const { data: unreadData, refetch: refetchUnread } = useApi<{ count: number }>('/notifications/unread-count', {
    refetchIntervalMs: 60_000,
    refetchWhenVisible: true,
  });
  const unreadCount = unreadData?.count || 0;

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
  // LECTURER); the endpoint itself scopes a lecturer down to just their own classes.
  const { data: escalationsData, refetch: refetchEscalations } = useApi<Escalation[]>(
    '/escalations?status=OPEN',
    { refetchIntervalMs: 30_000, refetchWhenVisible: true },
  );
  const openEscalationsCount = escalationsData?.length || 0;

  // Real-time unread count + ticket updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const handler = () => refetchUnread({ silent: true });
    const ticketHandler = () => refetchTickets({ silent: true });
    const escalationHandler = () => refetchEscalations({ silent: true });
    s.on('message:new', handler);
    s.on('flag:new', handler);
    s.on('ticket:new', ticketHandler);
    s.on('ticket:updated', ticketHandler);
    // No dedicated socket event for escalations yet — the 30s poll above keeps this reasonably
    // fresh; a new message notification is a decent proxy trigger for an early refresh too, since
    // every escalation is also a DM to the lecturer.
    s.on('message:new', escalationHandler);
    return () => { s.disconnect(); };
  }, [refetchUnread, refetchTickets, refetchEscalations]);

  const roleLabel = user?.role ? ROLE_LABEL[user.role] : 'Lecturer';
  const roleAccent = isSuperAdmin ? 'from-purple-500 to-purple-600' : isAdmin ? 'from-blue-500 to-blue-600' : 'from-emerald-500 to-emerald-600';

  // Inject unread badge into Alerts link
  const addAlertBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/alerts' ? { ...l, badge: unreadCount } : l);

  const addTicketBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/support' ? { ...l, badge: openTicketsCount } : l);

  const addEscalationBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/escalations' ? { ...l, badge: openEscalationsCount } : l);

  const addPendingBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/users' ? { ...l, badge: pendingApprovals } : l);

  // Phase 4: hide Announcements when the user's own school has broadcasts switched off — Super
  // Admin manages every school so always keeps the link regardless of any one school's setting.
  const broadcastsEnabledForUser = isSuperAdmin || (user?.school?.features?.broadcasts ?? true);
  const filterByFeatures = (links: NavItem[]) =>
    broadcastsEnabledForUser ? links : links.filter((l) => l.label !== 'Announcements');

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
            <NavSection title="General" links={addEscalationBadge(addTicketBadge(addAlertBadge(superAdminGeneral)))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isAdmin && !isSuperAdmin && (
          <>
            <NavSection title="Overview" links={hodOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={addPendingBadge(hodAdmin)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Operations" links={addEscalationBadge(hodOperations)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={filterByFeatures(addTicketBadge(addAlertBadge(hodGeneral)))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isExecutive && (
          <>
            <NavSection title="Overview" links={hierarchyOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={execAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Operations" links={execOperations} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={execGeneral} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isHierarchyOps && (
          <>
            <NavSection title="Overview" links={hierarchyOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection
              title="Administration"
              links={user?.role === 'DEPUTY_HOD' ? hierarchyAdmin.filter((l) => l.label === 'Users') : hierarchyAdmin}
              isSuperAdmin={isSuperAdmin}
              onNavigate={onClose}
              collapsed={collapsed}
            />
            <NavSection
              title="Operations"
              links={addEscalationBadge(
                user?.role === 'DEPUTY_HOD'
                  ? hierarchyOperations.filter((l) => l.label !== 'Fraud Detection' && l.label !== 'Escalations')
                  : hierarchyOperations,
              )}
              isSuperAdmin={isSuperAdmin}
              onNavigate={onClose}
              collapsed={collapsed}
            />
            <NavSection title="General" links={filterByFeatures(addTicketBadge(addAlertBadge(hierarchyGeneral)))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isRegistrar && (
          <>
            <NavSection title="Overview" links={hierarchyOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={registrarAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={filterByFeatures(registrarGeneral)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
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
        {isLecturer && addEscalationBadge(filterByFeatures(lecturerLinks)).map((link) => (
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

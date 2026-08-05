import { useEffect } from 'react';
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { createSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useApi } from '../../hooks/useApi';
import {
  LayoutDashboard, School, Users, Settings, BookOpen, Calendar,
  Radio, FileText, MessageSquare, Sun, Moon, LogOut, UserCheck, ClipboardList,
  BarChart3, GraduationCap, Bluetooth, Smartphone, Bell, Scale, Megaphone,
  ShieldAlert, ChevronDown, ChevronRight, X, LifeBuoy, PanelLeftClose, PanelLeftOpen, ScanEye,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardStats, Ticket } from '../../types';

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
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
];

const superAdminGeneral: NavItem[] = [
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/beacons', icon: Bluetooth, label: 'TB Manager' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/admin/system-announcements', icon: Megaphone, label: 'System Announcements' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
  { to: '/legal', icon: Scale, label: 'Legal' },
];

/* ---- ADMIN / SUB_ADMIN (University HOD) ---- */
const hodOverview: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
];

const hodAdmin: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/students', icon: GraduationCap, label: 'Students' },
  { to: '/admin/lecturers', icon: BookOpen, label: 'Lecturers' },
  { to: '/admin/school-admins', icon: Users, label: 'School Admins' },
  { to: '/admin/terms', icon: Calendar, label: 'Terms' },
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
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/lecturer-presence', icon: UserCheck, label: 'Lecturer Presence' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
];

const hodGeneral: NavItem[] = [
  { to: '/admin/beacons', icon: Bluetooth, label: 'TB Manager' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/system-announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/admin/support', icon: LifeBuoy, label: 'Support' },
  { to: '/legal', icon: Scale, label: 'Legal' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

/* ---- LECTURER ---- */
const lecturerLinks: NavItem[] = [
  { to: '/lecturer', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Courses' },
  { to: '/classes', icon: Calendar, label: 'Classes' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/admin/invigilation', icon: ScanEye, label: 'Invigilation' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Device Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/legal', icon: Scale, label: 'Legal' },
];

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

export function Sidebar({
  open, onClose, collapsed, onToggleCollapse,
}: {
  open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void;
}) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
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

  // Real-time unread count + ticket updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const handler = () => refetchUnread({ silent: true });
    const ticketHandler = () => refetchTickets({ silent: true });
    s.on('message:new', handler);
    s.on('flag:new', handler);
    s.on('ticket:new', ticketHandler);
    s.on('ticket:updated', ticketHandler);
    return () => { s.disconnect(); };
  }, [refetchUnread, refetchTickets]);

  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Lecturer';
  const roleAccent = isSuperAdmin ? 'from-purple-500 to-purple-600' : isAdmin ? 'from-blue-500 to-blue-600' : 'from-emerald-500 to-emerald-600';

  // Inject unread badge into Alerts link
  const addAlertBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/alerts' ? { ...l, badge: unreadCount } : l);

  const addTicketBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/support' ? { ...l, badge: openTicketsCount } : l);

  const addPendingBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/admin/students' ? { ...l, badge: pendingApprovals } : l);

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
          'fixed left-0 top-0 h-screen glass-sidebar flex flex-col z-40 border-r border-[color:var(--sidebar-edge)] transition-[transform,width] duration-200',
          'w-64',
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
        className="hidden lg:flex absolute -right-3 top-7 w-6 h-6 rounded-full glass-sidebar items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer text-[color:var(--app-text-muted)]"
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

      <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {isSuperAdmin && (
          <>
            <NavSection title="Overview" links={superAdminOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={superAdminAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={addTicketBadge(addAlertBadge(superAdminGeneral))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {isAdmin && !isSuperAdmin && (
          <>
            <NavSection title="Overview" links={hodOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Administration" links={addPendingBadge(hodAdmin)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="Operations" links={hodOperations} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
            <NavSection title="General" links={filterByFeatures(addTicketBadge(addAlertBadge(hodGeneral)))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} collapsed={collapsed} />
          </>
        )}
        {!isAdmin && filterByFeatures(lecturerLinks).map((link) => (
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
            <span className={clsx(collapsed && 'lg:hidden')}>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[color:var(--sidebar-edge)] space-y-1">
        <div className={clsx('flex items-center gap-3 px-2 py-2 mb-1', collapsed && 'lg:justify-center lg:px-0')} title={collapsed ? `${user?.firstName} ${user?.lastName}` : undefined}>
          <div className={clsx(`w-9 h-9 rounded-full bg-gradient-to-br ${roleAccent} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-[color:var(--app-elevated-solid)]`)}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
            <p className="text-sm font-medium truncate text-[color:var(--app-text)] dark:text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] truncate text-[color:var(--app-text-muted)] dark:text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          type="button"
          title={collapsed ? (dark ? 'Light Mode' : 'Dark Mode') : undefined}
          className={clsx('flex items-center gap-3 w-full px-2 py-2 rounded-xl text-sm cursor-pointer transition-colors nav-link-idle', collapsed && 'lg:justify-center lg:px-0')}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          <span className={clsx(collapsed && 'lg:hidden')}>{dark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          title={collapsed ? 'Logout' : undefined}
          className={clsx('flex items-center gap-3 w-full px-2 py-2 rounded-xl text-sm text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors', collapsed && 'lg:justify-center lg:px-0')}
        >
          <LogOut size={18} />
          <span className={clsx(collapsed && 'lg:hidden')}>Logout</span>
        </button>
      </div>
      </aside>
    </>
  );
}

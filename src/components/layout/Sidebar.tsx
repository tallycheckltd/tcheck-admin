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
  ShieldAlert, ChevronDown, ChevronRight, X, LifeBuoy
} from 'lucide-react';
import { clsx } from 'clsx';

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
];

const superAdminGeneral: NavItem[] = [
  { to: '/admin/beacons', icon: Bluetooth, label: 'BLE Manager' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Verification' },
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
  { to: '/admin/school-admins', icon: Users, label: 'School Admins' },
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
];

const hodGeneral: NavItem[] = [
  { to: '/admin/beacons', icon: Bluetooth, label: 'BLE Manager' },
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
  { to: '/admin/device-verification', icon: Smartphone, label: 'Device Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/legal', icon: Scale, label: 'Legal' },
];

function NavSection({ title, links, isSuperAdmin, onNavigate }: { title: string; links: NavItem[]; isSuperAdmin: boolean; onNavigate: () => void }) {
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
        className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest first:pt-2"
        style={{ color: 'var(--nav-section)' }}
      >
        {title}
      </p>
      {visibleLinks.map((link) => {
        const hasChildren = link.children && link.children.length > 0;
        const isExpanded = expandedItems.includes(link.label);
        const isChildActive = hasChildren && link.children?.some(child => location.pathname.startsWith(child.to));

        return (
          <div key={link.label} className="space-y-1">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(link.label)}
                className={clsx(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
                  isChildActive
                    ? 'nav-link-active'
                    : 'nav-link-idle hover:bg-slate-100 dark:hover:bg-white/5',
                )}
              >
                <link.icon size={18} />
                <span className="flex-1 text-left">{link.label}</span>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <NavLink
                to={link.to}
                end={link.to === '/admin' || link.to === '/lecturer'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    isActive ? 'shadow-sm nav-link-active' : 'nav-link-idle',
                  )
                }
              >
                <link.icon size={18} />
                <span className="flex-1">{link.label}</span>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {link.badge > 99 ? '99+' : link.badge}
                  </span>
                )}
              </NavLink>
            )}

            {hasChildren && isExpanded && (
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

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  // Real-time unread count updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const handler = () => refetchUnread({ silent: true });
    s.on('message:new', handler);
    s.on('flag:new', handler);
    return () => { s.disconnect(); };
  }, [refetchUnread]);

  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Lecturer';

  // Inject unread badge into Alerts link
  const addAlertBadge = (links: NavItem[]) =>
    links.map((l) => l.to === '/alerts' ? { ...l, badge: unreadCount } : l);

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
        className={`fixed left-0 top-0 h-screen w-64 glass-sidebar flex flex-col z-40 border-r border-[color:var(--sidebar-edge)] transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
      <div className="p-5 flex items-center gap-3 border-b border-[color:var(--sidebar-edge)]">
        <img src="/logo.svg" alt="Tcheck" className="w-10 h-10" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-[color:var(--app-text)] dark:text-white">Tcheck</h1>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--app-accent-label)]">
            {roleLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-[color:var(--app-text)] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
        {isSuperAdmin && (
          <>
            <NavSection title="Overview" links={superAdminOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
            <NavSection title="Administration" links={superAdminAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
            <NavSection title="General" links={addAlertBadge(superAdminGeneral)} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
          </>
        )}
        {isAdmin && !isSuperAdmin && (
          <>
            <NavSection title="Overview" links={hodOverview} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
            <NavSection title="Administration" links={hodAdmin} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
            <NavSection title="Operations" links={hodOperations} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
            <NavSection title="General" links={filterByFeatures(addAlertBadge(hodGeneral))} isSuperAdmin={isSuperAdmin} onNavigate={onClose} />
          </>
        )}
        {!isAdmin && filterByFeatures(lecturerLinks).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/lecturer'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive ? 'shadow-sm nav-link-active' : 'nav-link-idle',
              )
            }
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[color:var(--sidebar-edge)] space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-[color:var(--app-text)] dark:text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] truncate text-[color:var(--app-text-muted)] dark:text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          type="button"
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm cursor-pointer transition-colors nav-link-idle"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
      </aside>
    </>
  );
}

import { useEffect, useState } from 'react';
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { createSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useApi } from '../../hooks/useApi';
import {
  LayoutDashboard, School, Users, Settings, BookOpen, Calendar,
  Radio, FileText, MessageSquare, Sun, Moon, LogOut, UserCheck, ClipboardList,
  BarChart3, GraduationCap, Link2, Bluetooth, Smartphone, Bell, ShieldAlert,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  superAdminOnly?: boolean;
  badge?: number;
  children?: NavItem[];
}

const overviewLinks: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
];

const adminLinks: NavItem[] = [
  { to: '/admin/schools', icon: School, label: 'Schools', superAdminOnly: true },
  { to: '/admin/users', icon: Users, label: 'User Management' },
  { to: '/admin/students', icon: GraduationCap, label: 'All Students' },
];

const operationsLinks: NavItem[] = [
  { to: '/courses', icon: BookOpen, label: 'All Courses' },
  { to: '/admin/course-assignments', icon: Link2, label: 'Course Assignments' },
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

const systemLinks: NavItem[] = [
  { to: '/admin/beacons', icon: Bluetooth, label: 'BLE Beacon Manager' },
  { to: '/admin/device-verification', icon: Smartphone, label: 'Device Verification' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/messages', icon: ShieldAlert, label: 'Message Oversight' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/admin/settings', icon: Settings, label: 'Settings', superAdminOnly: true },
];

const lecturerLinks: NavItem[] = [
  { to: '/lecturer', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: BookOpen, label: 'Courses' },
  { to: '/classes', icon: Calendar, label: 'Classes' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/live', icon: Radio, label: 'Live Attendance' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/messages', icon: MessageSquare, label: 'Messages' },
];

function NavSection({ title, links, isSuperAdmin }: { title: string; links: NavItem[]; isSuperAdmin: boolean }) {
  const visibleLinks = links.filter((l) => !l.superAdminOnly || isSuperAdmin);
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const navigate = useNavigate();
  const location = window.location;

  if (visibleLinks.length === 0) return null;

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  return (
    <>
      <p className="px-3 pt-4 pb-1 text-[10px] font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest first:pt-2">
        {title}
      </p>
      {visibleLinks.map((link) => {
        const hasChildren = link.children && link.children.length > 0;
        const isExpanded = expandedItems.includes(link.label);
        const isChildActive = hasChildren && link.children?.some(child => location.pathname === child.to);

        return (
          <div key={link.label} className="space-y-1">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(link.label)}
                className={clsx(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
                  isChildActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5',
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
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                    isActive
                      ? 'bg-blue-600 text-white dark:bg-blue-500/10 dark:text-blue-400 shadow-md shadow-blue-600/10'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5',
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
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        isActive
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/5'
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

export function Sidebar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: unreadData, refetch: refetchUnread } = useApi<{ count: number }>('/notifications/unread-count');
  const unreadCount = unreadData?.count || 0;

  // Real-time unread count updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const handler = () => refetchUnread();
    s.on('message:new', handler);
    s.on('flag:new', handler);
    return () => { s.disconnect(); };
  }, [refetchUnread]);

  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Lecturer';

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass-sidebar flex flex-col z-40">
      <div className="p-5 flex items-center gap-3 border-b border-gray-200 dark:border-white/5">
        <img src="/logo.svg" alt="TCheck" className="w-10 h-10" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">TCheck</h1>
          <p className="text-[11px] font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">
            {roleLabel}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
        {isAdmin && (
          <>
            <NavSection title="Overview" links={overviewLinks} isSuperAdmin={!!isSuperAdmin} />
            <NavSection title="Administration" links={adminLinks} isSuperAdmin={!!isSuperAdmin} />
            <NavSection title="Operations" links={operationsLinks} isSuperAdmin={!!isSuperAdmin} />
            <NavSection title="General" links={systemLinks.map((l) => l.to === '/alerts' ? { ...l, badge: unreadCount } : l)} isSuperAdmin={!!isSuperAdmin} />
          </>
        )}
        {!isAdmin && lecturerLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/lecturer'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white dark:bg-blue-500/10 dark:text-blue-400 shadow-md shadow-blue-600/10'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5',
              )
            }
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-white/5 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition-colors"
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
  );
}

import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { GlobalSearchBar } from './GlobalSearchBar';

export function DashboardLayout() {
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') return <Navigate to="/login" replace />;

  const contentMargin = collapsed ? 'lg:ml-[76px]' : 'lg:ml-64';

  return (
    <div className="min-h-screen app-shell transition-[background-color,color] duration-200">
      <Sidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {/* Mobile-only menu trigger — floats over page content instead of living in a persistent
          topbar, since removing that bar (search moved into the sidebar as a modal, see below)
          was the fix for pages' own headers crowding right up against it. */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-20 p-2.5 rounded-xl glass-sidebar border border-[color:var(--sidebar-edge)] text-[color:var(--app-text)] dark:text-white shadow-sm cursor-pointer"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>
      <GlobalSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
      <main className={`${contentMargin} flex flex-col p-4 pt-16 sm:p-6 lg:pt-6 min-h-screen antialiased text-[color:var(--app-text)] dark:text-slate-100 transition-[margin] duration-200`}>
        <div className="flex-1">
          <Outlet />
        </div>
        <DashboardFooter />
      </main>
    </div>
  );
}

function DashboardFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto pt-6 pb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.75rem] text-slate-500 dark:text-slate-500">
      <span>&copy; {year} Tallycheck Ltd. All rights reserved.</span>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <span>TCheck Enterprise v1.2 (Moi Pilot)</span>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <a href="https://tallycheck.co.ke/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        Privacy Policy &#8599;
      </a>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <a href="https://tallycheck.co.ke/terms" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        Terms of Service &#8599;
      </a>
    </footer>
  );
}

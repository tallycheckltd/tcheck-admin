import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { GlobalSearchBar } from './GlobalSearchBar';

export function DashboardLayout() {
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen app-shell transition-[background-color,color] duration-200">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {/* Persistent header — mobile shows the hamburger + logo, desktop shows just the global
          search since the sidebar already carries branding there. Phase 2 had this mobile-only;
          Phase 4's global search needed a header that exists at every width. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-[color:var(--sidebar-edge)] glass-sidebar lg:ml-64">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden p-2 -ml-2 rounded-xl text-[color:var(--app-text)] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>
        <img src="/logo.svg" alt="Tcheck" className="lg:hidden w-7 h-7" />
        <span className="lg:hidden font-bold text-[color:var(--app-text)] dark:text-white">Tcheck</span>
        <div className="flex-1" />
        <GlobalSearchBar />
      </div>
      <main className="lg:ml-64 p-4 sm:p-6 min-h-screen antialiased text-[color:var(--app-text)] dark:text-slate-100">
        <Outlet />
      </main>
    </div>
  );
}

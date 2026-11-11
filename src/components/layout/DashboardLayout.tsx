import { LEGAL_URLS } from '../../lib/legalUrls';
import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { GlobalSearchBar } from './GlobalSearchBar';
import { PermissionNotice } from '../shared/PermissionNotice';
import { TermsAcceptancePage } from '../../pages/TermsAcceptancePage';

export function DashboardLayout() {
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  // Reported by the Sidebar: roles with only a handful of pages get a narrower sidebar.
  const [fewPages, setFewPages] = useState(false);

  // Backs the "/" chip on the sidebar's Search field — ignored while typing in any field
  // so it doesn't hijack a literal "/" character in, say, a school code or a message draft.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      setSearchOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
  // First login of an admin-created account, or the terms changed since it last accepted (QA plan Phase 21):
  // nothing else in the dashboard is reachable until the current terms are accepted.
  if (user.termsRequired) return <TermsAcceptancePage />;

  // Sidebar floats lg:left-3 with its own width, plus a matching gap before content starts
  // (12px offset + width + 12px gap) — keep these in step with Sidebar.tsx's desktopWidth
  // (64px rail / 212px few-pages / 232px default).
  const contentMargin = collapsed ? 'lg:ml-[88px]' : fewPages ? 'lg:ml-[236px]' : 'lg:ml-[256px]';

  return (
    <div className="min-h-screen app-shell transition-[background-color,color] duration-200">
      <Sidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        onOpenSearch={() => setSearchOpen(true)}
        onFewPagesChange={setFewPages}
      />
      {/* Mobile-only menu trigger — floats over page content instead of living in a persistent
          topbar, since removing that bar (search moved into the sidebar as a modal, see below)
          was the fix for pages' own headers crowding right up against it. */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="sidebar-surface lg:hidden fixed top-3 left-3 z-20 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200/70 dark:border-white/[0.07] text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors duration-[120ms] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        aria-label="Open navigation menu"
      >
        <Menu size={16} />
      </button>
      <GlobalSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
      <PermissionNotice />
      <main className={`${contentMargin} flex flex-col p-4 pt-14 sm:p-6 sm:pt-14 lg:pt-5 min-h-screen antialiased text-[color:var(--app-text)] dark:text-slate-100 transition-[margin] duration-200`}>
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
    <footer className="mt-auto pt-6 pb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-500">
      <span>&copy; {year} Tallycheck Ltd. All rights reserved.</span>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        Privacy Policy &#8599;
      </a>
      <span className="text-slate-300 dark:text-slate-700">|</span>
      <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        Terms of Service &#8599;
      </a>
    </footer>
  );
}

import { useEffect, useRef, useState } from 'react';
import { EXEC_ED_NAV_LABEL } from '../../hooks/useTerms';
import { createPortal } from 'react-dom';
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
  ShieldAlert, ShieldCheck, ChevronRight, ChevronLeft, X, LifeBuoy, PanelLeftClose, PanelLeftOpen, ScanEye, ScrollText, Search, Radar, Layers, Siren, CalendarClock, Battery, Network, UploadCloud,
  User as UserIcon, Plug, Wrench, DoorOpen, FileBarChart, Eye, MailCheck, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardStats, Ticket, Escalation, FacilityTicket, User } from '../../types';
import { ROLE_LABEL } from '../../lib/rbac';
import * as NAV from './navConfig';
import type { IconName, NavLinkDef } from './navConfig';
import { roleDef, ROLE_TABLE, homeRouteFor, type RoleName } from '../../shared/roles';

// P2: nav items live in navConfig.ts as plain data (icon names); this maps the names to components.
const ICONS: Record<IconName, React.ComponentType<{ size?: number }>> = { ShieldCheck, BarChart3, Battery, BookOpen, Calendar, CalendarClock, ClipboardList, DoorOpen, Eye, FileBarChart, FileText, GraduationCap, Layers, LayoutDashboard, LifeBuoy, Link2, MailCheck, Megaphone, MessageSquare, MessageSquareQuote, Network, Plug, Presentation, Radar, Radio, ScanEye, ScrollText, School, Settings, ShieldAlert, Siren, Smartphone, Sparkles, Star, Tags, UploadCloud, UserCheck, Users, Users2, Wrench };
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
  /** Active only on this exact path (not on pages below it). */
  end?: boolean;
  /** Overrides path-based highlighting (e.g. a link that carries a query string). */
  active?: boolean;
  /** Badge colour: brand for plain counts, amber / red for things that need attention. */
  tone?: BadgeTone;
}

type BadgeTone = 'count' | 'warn' | 'alert';

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
 * last. UAT F15/F20 — no Facilities or Messages here: the CEM's top-level Facilities and Messages
 * tabs already cover every programme. */
function buildCxmCohortLinks(cohortId: string): NavItem[] {
  const base = `/cem/cohorts/${cohortId}`;
  return [
    { to: '/cem', icon: ChevronLeft, label: 'Back to Programmes' },
    { to: base, icon: Users, label: 'Overview & Students' },
    { to: `${base}/checkins`, icon: UserCheck, label: 'Check-Ins' },
    { to: `${base}/manual-checkin`, icon: ClipboardList, label: 'Manual Check-in' },
    // UAT F17 — Broadcast replaced by the one Announcements page, this programme pre-picked.
    { to: `/announcements?cohortId=${cohortId}`, icon: Megaphone, label: 'Announcements' },
    { to: `${base}/materials`, icon: FileText, label: 'Materials' },
    // SBS (5 Nov) — who passed the attendance threshold; the CEM approves completion.
    { to: `${base}/completion`, icon: GraduationCap, label: 'Completion' },
    { to: `${base}/feedback`, icon: Star, label: 'Request Feedback' },
    { to: `${base}/birthdays`, icon: Sparkles, label: 'Birthdays' },
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

const execOperations = withIcons(NAV.execOperations);

const execGeneral = withIcons(NAV.execGeneral);

const hierarchyGeneral = withIcons(NAV.hierarchyGeneral);

/* ---- Registrar (Academic/Administration) — records-only, no operational modules ---- */
const registrarAdmin = withIcons(NAV.registrarAdmin);

const registrarGeneral = withIcons(NAV.registrarGeneral);

/* ---- ICT Admin — infrastructure only ---- */
const ictAdminLinks = withIcons(NAV.ictAdminLinks);

/** Routes that are only "active" on themselves, not on every page below them. */
const END_PATHS = new Set(['/admin', '/lecturer', '/platform', '/staff', '/cem']);

/** Same rule NavLink uses (prefix match on path segments, exact for END_PATHS / `end`). */
function isPathActive(link: Pick<NavItem, 'to' | 'end'>, pathname: string): boolean {
  const base = link.to.split('?')[0];
  if (link.end || END_PATHS.has(base)) return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function isLinkActive(link: NavItem, pathname: string): boolean {
  if (link.active !== undefined) return link.active;
  if (link.children?.length) return link.children.some((c) => isPathActive(c, pathname));
  return isPathActive(link, pathname);
}

function NavBadge({ count, tone = 'count', collapsed }: { count?: number; tone?: BadgeTone; collapsed: boolean }) {
  if (!count) return null;
  if (collapsed) {
    return (
      <span
        data-tone={tone}
        className="sb-dot hidden lg:block absolute top-1.5 right-1.5 ring-2 ring-[color:var(--sb-bg)]"
        aria-hidden="true"
      />
    );
  }
  return <span className="sb-badge" data-tone={tone}>{count > 99 ? '99+' : count}</span>;
}

// Sidebar page search: what the person typed in the box above the nav. Every list of links below
// is filtered through matchLinks.
const NavQuery = React.createContext('');

/** Links whose label (or a child's label, or parent + child together) contains every typed word. */
function matchLinks<T extends { label: string; children?: T[] }>(links: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return links;
  const hit = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const out: T[] = [];
  for (const l of links) {
    if (hit(l.label)) { out.push(l); continue; }
    const kids = l.children?.filter((c) => hit(`${l.label} ${c.label}`));
    if (kids?.length) out.push({ ...l, children: kids });
  }
  return out;
}

/* Shared row geometry: .sb-row in index.css (32px, 8px radius, 13px label, 16px muted icon). In the
   desktop icon rail a row becomes a centred 36px square with the same active indicator. */
const ROW_RAIL = 'lg:justify-center lg:px-0 lg:w-9 lg:h-9 lg:mx-auto';

function NavRow({ link, collapsed, onNavigate }: { link: NavItem; collapsed: boolean; onNavigate: () => void }) {
  const location = useLocation();
  const [open, setOpen] = useState<boolean | null>(null);
  const query = React.useContext(NavQuery);
  const hasChildren = !!link.children?.length;
  const active = isLinkActive(link, location.pathname);
  const Icon = link.icon;

  // A parent with children: an expand toggle (expanded rail = link to its first child instead,
  // since there's no room for a submenu).
  if (hasChildren && !collapsed) {
    const expanded = query.trim() !== '' || (open ?? active);
    const listId = `nav-sub-${link.to.replace(/\W+/g, '-')}`;
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-controls={listId}
          data-active={active && !expanded ? 'true' : undefined}
          className="sb-row sb-focus w-full cursor-pointer"
        >
          <span className="sb-icon"><Icon size={16} /></span>
          <span className="flex-1 text-left truncate" title={link.label}>{link.label}</span>
          <ChevronRight size={14} className={clsx('shrink-0 text-[color:var(--sb-faint)] transition-transform duration-150', expanded && 'rotate-90')} />
        </button>
        {expanded && (
          <div id={listId} className="sb-guide mt-0.5 mb-1 ml-[15px] pl-2.5 space-y-px">
            {link.children!.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                aria-current={isPathActive(child, location.pathname) ? 'page' : undefined}
                data-active={isPathActive(child, location.pathname) ? 'true' : undefined}
                className="sb-row sb-sub sb-focus"
              >
                <span className="truncate" title={child.label}>{child.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={hasChildren ? link.children![0].to : link.to}
      end={link.end || END_PATHS.has(link.to)}
      onClick={onNavigate}
      data-rail-label={collapsed ? link.label : undefined}
      aria-label={collapsed ? link.label : undefined}
      aria-current={active ? 'page' : undefined}
      data-active={active ? 'true' : undefined}
      className={clsx('sb-row sb-focus', collapsed && ROW_RAIL)}
    >
      <span className="sb-icon"><Icon size={16} /></span>
      <span className={clsx('flex-1 truncate', collapsed && 'lg:hidden')} title={collapsed ? undefined : link.label}>{link.label}</span>
      {link.badge ? (
        <>
          <span className={clsx(collapsed && 'lg:hidden', 'ml-auto flex')}><NavBadge count={link.badge} tone={link.tone} collapsed={false} /></span>
          {collapsed && <NavBadge count={link.badge} tone={link.tone} collapsed />}
        </>
      ) : null}
    </NavLink>
  );
}

/** The most urgent tone among some links' badges (for a folded section's dot). */
function topTone(links: NavItem[]): BadgeTone | null {
  const tones = links.filter((l) => l.badge).map((l) => l.tone ?? 'count');
  if (tones.includes('alert')) return 'alert';
  if (tones.includes('warn')) return 'warn';
  return tones.length ? 'count' : null;
}

/**
 * One titled section of the nav. Titled sections fold (the header is the toggle) so a long nav
 * like the School Admin's doesn't run down the whole screen; while searching every section is
 * open, and in the icon rail they're always open (headers become thin dividers).
 */
function NavGroup({
  title, links, collapsed, open, onToggle, onNavigate, first,
}: {
  title?: string; links: NavItem[]; collapsed: boolean; open: boolean; onToggle: () => void; onNavigate: () => void; first: boolean;
}) {
  const query = React.useContext(NavQuery);
  const visible = matchLinks(links, query);
  if (visible.length === 0) return null;
  const searching = query.trim() !== '';
  const expanded = !title || open || searching;
  const listId = title ? `nav-group-${title.toLowerCase().replace(/\W+/g, '-')}` : undefined;
  const hiddenBadges = expanded ? 0 : visible.reduce((n, l) => n + (l.badge ?? 0), 0);
  const hiddenTone = hiddenBadges ? topTone(visible) : null;

  return (
    <div className={clsx(!first && title && 'mt-2', !first && collapsed && 'lg:mt-0')}>
      {title && (
        <>
          {!first && collapsed && <div className="sb-hairline hidden lg:block mx-2 my-2 border-t" aria-hidden="true" />}
          <button
            type="button"
            onClick={onToggle}
            disabled={searching}
            aria-expanded={expanded}
            aria-controls={listId}
            title={!expanded && hiddenBadges ? `${title}: ${hiddenBadges} need${hiddenBadges === 1 ? 's' : ''} attention` : undefined}
            className={clsx('sb-section sb-focus cursor-pointer disabled:cursor-default', collapsed && 'lg:hidden')}
          >
            <span className="truncate">{title}</span>
            <ChevronRight size={12} className="sb-chev shrink-0" aria-hidden="true" />
            {!expanded && (
              <span className="ml-auto flex items-center gap-2 pl-2">
                {hiddenTone && <span className="sb-dot" data-tone={hiddenTone} aria-hidden="true" />}
                <span className="text-[11px] tabular-nums font-normal text-[color:var(--sb-faint)]">{visible.length}</span>
              </span>
            )}
          </button>
        </>
      )}
      {/* A folded group still shows its icons in the desktop rail. */}
      {(expanded || collapsed) && (
        <div id={listId} className={clsx('space-y-px', !expanded && 'hidden lg:block', collapsed && 'lg:space-y-0.5')}>
          {visible.map((link) => (
            <NavRow key={link.to + link.label} link={link} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Which titled groups are open, remembered per user in localStorage. A group with no saved choice
 * starts open only if it's "Overview" or holds the page you're on; the group holding the current
 * page is always open unless you folded it while on this page.
 */
function useNavGroups(userId: string | undefined, activeTitle: string | undefined, pathname: string) {
  const key = `tcheck:sidebarGroups:${userId ?? 'anon'}`;
  const read = (k: string): Record<string, boolean> => {
    try { return JSON.parse(localStorage.getItem(k) || '{}') as Record<string, boolean>; } catch { return {}; }
  };
  const [stored, setStored] = useState<{ key: string; groups: Record<string, boolean> }>(() => ({ key, groups: read(key) }));
  // Another user signed in on this browser: load their saved groups (adjust-state-on-change pattern).
  if (stored.key !== key) setStored({ key, groups: read(key) });
  const [foldedActiveAt, setFoldedActiveAt] = useState<string | null>(null);

  const isOpen = (title: string) => {
    if (title === activeTitle) return foldedActiveAt !== pathname;
    return stored.groups[title] ?? title === 'Overview';
  };
  const toggle = (title: string) => {
    const next = !isOpen(title);
    if (title === activeTitle) setFoldedActiveAt(next ? null : pathname);
    const groups = { ...stored.groups, [title]: next };
    setStored({ key, groups });
    try { localStorage.setItem(key, JSON.stringify(groups)); } catch { /* storage blocked */ }
  };
  return { isOpen, toggle };
}

/** Collapses Search/Theme/Logout behind one avatar trigger instead of three permanently-visible
 * rows — was the last thing in the sidebar feeling like "an old sidebar" (a flat list of account
 * actions with no chrome around them). Opens as a popover above the trigger since the trigger
 * itself lives at the very bottom of the screen. */
function ProfileMenu({
  user, roleAccent, subtitle, dark, onToggleTheme, onOpenSearch, onLogout, collapsed,
}: {
  user: User | null | undefined;
  roleAccent: string;
  /** Second line under the name (role, or email when the header already shows the role). */
  subtitle: string;
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

  const itemClass = 'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors nav-link-idle';
  const iconBadgeClass = 'flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 bg-black/[0.03] dark:bg-white/5';

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
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
            className={clsx(
              'absolute bottom-full left-0 z-50 isolate mb-2 rounded-xl border border-[color:var(--sb-border)] shadow-xl overflow-hidden p-1.5 space-y-0.5 origin-bottom-left',
              // As wide as the sidebar's footer row (it sits over the nav); a fixed width beside the rail.
              collapsed ? 'w-[216px] lg:w-60' : 'w-[calc(100%+32px)]',
            )}
            style={{ backgroundColor: dark ? '#0f172a' : '#ffffff' }}
          >
            <button onClick={() => { onOpenSearch(); setOpen(false); }} type="button" className={itemClass}>
              <span className={iconBadgeClass}><Search size={15} /></span>
              <span className="flex-1 text-left">Search</span>
              <kbd className="sb-kbd">
                /
              </kbd>
            </button>
            <button onClick={() => { navigate('/profile'); setOpen(false); }} type="button" className={itemClass}>
              <span className={iconBadgeClass}><UserIcon size={15} /></span>
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
                    <span className={iconBadgeClass}><Building2 size={15} /></span>
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
              <span className={iconBadgeClass}>{dark ? <Sun size={15} /> : <Moon size={15} />}</span>
              <span className="flex-1 text-left">{dark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <div className="my-1 border-t border-[color:var(--sidebar-edge)]" />
            <button
              onClick={() => { onLogout(); setOpen(false); }}
              type="button"
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-[13px] text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 bg-red-500/10">
                <LogOut size={15} />
              </span>
              <span className="flex-1 text-left">Logout</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-rail-label={collapsed ? `${user?.firstName} ${user?.lastName}` : undefined}
        aria-label={collapsed ? `Account menu for ${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() : `Account menu — ${user?.email ?? ''}`}
        title={collapsed ? undefined : user?.email}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'sb-focus flex items-center gap-2.5 w-full h-10 px-1.5 rounded-lg text-left transition-colors duration-[120ms] cursor-pointer',
          open ? 'bg-[color:var(--sb-hover)]' : 'hover:bg-[color:var(--sb-hover)]',
          collapsed && 'lg:justify-center lg:px-0 lg:w-9 lg:h-9 lg:mx-auto',
        )}
      >
        <span className="relative flex-shrink-0">
          <span className={clsx(`flex w-7 h-7 rounded-full bg-gradient-to-br ${roleAccent} items-center justify-center text-white text-[10.5px] font-semibold tracking-[0.02em]`)}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
          <span className="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[color:var(--sb-bg)]" aria-hidden="true" />
        </span>
        <span className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
          <span className="block text-[13px] leading-4 font-medium truncate text-[color:var(--sb-text-strong)]">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="block mt-0.5 text-[11.5px] leading-[14px] truncate text-[color:var(--sb-muted)]">{subtitle}</span>
        </span>
      </button>
    </div>
  );
}

/**
 * Sidebar tooltips. In the collapsed rail the page name pops out beside the icon the moment the
 * pointer (or keyboard focus) is on it (`data-rail-label`); icon-only buttons (collapse, theme) get
 * the same instant tooltip in either state (`data-tip`). One delegated listener on the <aside>; the
 * tip is portalled to <body> so the nav's scroll container and the aside's transform can't clip it.
 */
function useSidebarTooltip(collapsed: boolean) {
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const show = (target: EventTarget | null) => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const el = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-rail-label],[data-tip]');
    const label = el?.dataset.tip || (collapsed ? el?.dataset.railLabel : undefined);
    if (!el || !label) { setTip(null); return; }
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const handlers = {
    onMouseOver: (e: React.MouseEvent) => show(e.target),
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent) => show(e.target),
    onBlur: () => setTip(null),
    onClick: () => setTip(null),
    onScrollCapture: () => setTip(null),
  };
  const label = tip && createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11.5px] leading-4 font-medium text-white shadow-lg ring-1 ring-black/5 dark:bg-slate-700 dark:ring-white/10"
      style={{ top: tip.top, left: tip.left }}
    >
      {tip.label}
    </div>,
    document.body,
  );
  return { handlers, label };
}

/** ⌘K on Apple keyboards, Ctrl K elsewhere ("/" already opens the global search). */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function Sidebar({
  open, onClose, collapsed, onToggleCollapse, onOpenSearch,
}: {
  open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void; onOpenSearch: () => void;
}) {
  const rail = useSidebarTooltip(collapsed);
  const [navQuery, setNavQuery] = useState('');
  const navSearchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // After the filtered links render, note whether anything matched (for the "no pages match" line).
  const [navNoMatch, setNavNoMatch] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setNavNoMatch(navQuery.trim() !== '' && !navRef.current?.querySelector('a[href]')));
    return () => cancelAnimationFrame(id);
  }, [navQuery]);
  // ⌘K / Ctrl K jumps to the page search (expanding the rail first). "/" stays the global search.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      e.preventDefault();
      if (collapsed) { onToggleCollapse(); setTimeout(() => navSearchRef.current?.focus(), 50); }
      else navSearchRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [collapsed, onToggleCollapse]);
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  // Context-sensitive CEM nav: viewing one specific programme swaps the flat top-level nav for the
  // per-programme panel list scoped to that cohort (buildCxmCohortLinks above).
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

  // TALI — in the Overview group, under Dashboard. Shown only where /insights/access says so: TALI on for the school, staff TALI on, and a
  // TALI permission for this role (a School Admin also sees it while staff TALI is off, to turn it
  // back on). Never for Super Admin or students.
  const { data: taliAccess } = useApi<{ enabled: boolean; switches?: unknown }>(
    user?.schoolId && !isSuperAdmin && user.role !== 'STUDENT' ? '/insights/access' : null,
  );
  const taliLinks: NavItem[] = taliAccess?.enabled || taliAccess?.switches ? [{ to: '/tali', icon: Sparkles, label: 'TALI' }] : [];

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
    links.map((l) => l.to === '/admin/escalations' ? { ...l, badge: openEscalationsCount, tone: 'alert' as const } : l);

  const addFacilitiesBadge = (links: NavItem[]) =>
    links.map((l) => (l.to === '/admin/facilities' || l.to === '/cem/facilities') ? { ...l, badge: openFacilityTicketsCount, tone: 'warn' as const } : l);

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
    // Follow-ups (F2/F3) — only once the school switched the follow-up agent on (Settings > TALI agents).
    if (!(user?.school?.features as { taliAgents?: { followUp?: boolean } } | undefined)?.taliAgents?.followUp) hiddenNavLabels.add('Follow-ups');
    if (!user?.school?.features?.classChanges) hiddenNavLabels.add('Class changes');
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
  // SBS (5 Nov) — exec-ed wording on the labels people see (delegates, modules, sessions, faculty).
  const execEdWords = !!user?.school?.features?.execEdSuite;
  const say = <T extends { label: string }>(l: T): T => (execEdWords && EXEC_ED_NAV_LABEL[l.label] ? { ...l, label: EXEC_ED_NAV_LABEL[l.label] } : l);
  const filterBySchoolConfig = (links: NavItem[]): NavItem[] =>
    links
      .filter((l) => !hiddenNavLabels.has(l.label) && !roleHidden.has(l.to))
      .map((l) => (l.children ? { ...l, children: l.children.filter((c) => !roleHidden.has(c.to)).map(say) } : l))
      .map(say);

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

  // Every role's nav as sections: titled ones fold, a single untitled one is a flat list.
  const sections: { title?: string; links: NavItem[] }[] = [];
  if (isSuperAdmin) {
    sections.push(
      { title: 'Overview', links: superAdminOverview },
      { title: 'Administration', links: superAdminAdmin },
      { title: 'General', links: addFacilitiesBadge(addEscalationBadge(addTicketBadge(superAdminGeneral))) },
    );
  } else if (isAdmin) {
    sections.push(
      { title: 'Overview', links: [...hodOverview, ...taliLinks] },
      { title: 'Administration', links: filterBySchoolConfig(addPendingBadge(hodAdmin)) },
      { title: 'Operations', links: filterBySchoolConfig(addFacilitiesBadge(addEscalationBadge(hodOperations))) },
      { title: 'General', links: filterBySchoolConfig(addTicketBadge(hodGeneral)) },
    );
  } else if (isExecutive) {
    sections.push(
      { title: 'Overview', links: [...hierarchyOverview, ...taliLinks] },
      { title: 'Operations', links: filterBySchoolConfig(execOperations) },
      { title: 'General', links: execGeneral },
    );
  } else if (isHierarchyOps) {
    const deputy = user?.role === 'DEPUTY_HOD';
    sections.push(
      { title: 'Overview', links: [...hierarchyOverview, ...taliLinks] },
      { title: 'Administration', links: filterBySchoolConfig(deputy ? hierarchyAdmin.filter((l) => l.label === 'Users') : hierarchyAdmin) },
      {
        title: 'Operations',
        links: filterBySchoolConfig(addFacilitiesBadge(addEscalationBadge(
          deputy
            ? hierarchyOperations.filter((l) => l.label !== 'Fraud Detection' && l.label !== 'Escalations' && l.label !== 'Facilities')
            : hierarchyOperations,
        ))),
      },
      { title: 'General', links: filterBySchoolConfig(addTicketBadge(hierarchyGeneral)) },
    );
  } else if (isRegistrar) {
    sections.push(
      { title: 'Overview', links: [...hierarchyOverview, ...taliLinks] },
      { title: 'Administration', links: filterBySchoolConfig(registrarAdmin) },
      { title: 'General', links: filterBySchoolConfig(registrarGeneral) },
    );
  } else if (isIctAdmin) {
    sections.push({ links: addEscalationBadge(ictAdminLinks) });
  } else if (isLecturer) {
    sections.push({ links: addFacilitiesBadge(addEscalationBadge(filterByPermission(filterBySchoolConfig(lecturerNavLinks)))) });
  } else if (isCemManager) {
    sections.push({ links: addFacilitiesBadge(filterByPermission(filterBySchoolConfig(cemManagerNavLinks))) });
  } else if (isStaff) {
    sections.push({ links: filterByPermission(filterBySchoolConfig(staffNavLinks)) });
  } else if (isCxm && cxmCohortId) {
    // Every panel is its own route; the overview (`/cem/cohorts/:id`) is a prefix of the others so
    // it's exact-match, and Announcements carries `?cohortId=` so it's never lit by path alone.
    sections.push({
      links: buildCxmCohortLinks(cxmCohortId).map((l) => ({
        ...l,
        end: l.to === `/cem/cohorts/${cxmCohortId}` || l.to === '/cem',
        active: l.to.includes('?') ? false : undefined,
      })),
    });
  } else if (isCxm) {
    // Deliberately skips filterBySchoolConfig — its Terms/Programs rule (keyed on the label
    // "Training pipelines") must never touch a CEM's own "Programmes" link.
    sections.push({ links: addFacilitiesBadge(filterByPermission(cxmLinks)) });
  }
  for (const s of sections) s.links = s.links.filter((l) => !l.superAdminOnly || isSuperAdmin);

  // Few pages (say a Staff account's 3): a narrower card, so it reads in proportion to its content.
  const pageCount = sections.reduce((n, s) => n + s.links.reduce((m, l) => m + (l.children?.length || 1), 0), 0);
  const few = pageCount <= 6;
  const activeTitle = sections.find((s) => s.title && s.links.some((l) => isLinkActive(l, location.pathname)))?.title;
  const groups = useNavGroups(user?.id, activeTitle, location.pathname);

  // Header line two: the school this account works in; the role instead when there isn't one.
  const schoolName = user?.school?.name?.trim();
  const headerSub = schoolName || roleLabel;

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside {...rail.handlers}
        data-collapsed={collapsed ? 'true' : 'false'}
        data-density={few ? 'few' : 'full'}
        aria-label="Sidebar"
        className={clsx(
          // One continuous surface. Floats clear of the viewport edges on desktop (lg:) as a
          // rounded card; the mobile drawer (below lg:) stays a full-height, edge-to-edge overlay.
          'app-sidebar sb-surface fixed inset-y-0 left-0 h-screen flex flex-col z-40 border-l-0 border-y-0 lg:border transition-[transform,width] duration-200',
          'w-[264px] max-w-[85vw]',
          'lg:inset-auto lg:left-3 lg:top-3 lg:rounded-2xl',
          // Desktop: the card is only as tall as its content (capped at the viewport, then the
          // nav scrolls) — the profile sits right under the last group, not at the screen's foot.
          'lg:h-auto lg:max-h-[calc(100vh-1.5rem)] lg:max-w-none',
          collapsed ? 'lg:w-[60px]' : few ? 'lg:w-[208px]' : 'lg:w-[232px]',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
      {/* Header: logo + product + school, with the collapse toggle (desktop) / close (mobile) in the row. */}
      <div className={clsx('sb-hairline flex items-center gap-2.5 h-14 pl-4 pr-2.5 border-b shrink-0', collapsed && 'lg:flex-col lg:justify-center lg:gap-1.5 lg:h-auto lg:py-3 lg:px-0')}>
        <img src="/logo.svg" alt="" className="w-6 h-6 flex-shrink-0" />
        <div className={clsx('flex-1 min-w-0', collapsed && 'lg:hidden')}>
          <p className="text-[13px] leading-4 font-semibold tracking-[-0.01em] text-[color:var(--sb-text-strong)] truncate">Tcheck</p>
          <p className="mt-0.5 text-[11.5px] leading-[14px] text-[color:var(--sb-muted)] truncate" title={headerSub}>{headerSub}</p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="sb-icon-btn sb-focus hidden lg:inline-flex cursor-pointer"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="sb-icon-btn sb-focus lg:hidden cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X size={16} />
        </button>
      </div>

      <div className={clsx('px-3 pt-3 shrink-0', collapsed && 'lg:pt-2')}>
        {collapsed && (
          <button
            type="button"
            onClick={() => { onToggleCollapse(); setTimeout(() => navSearchRef.current?.focus(), 50); }}
            data-rail-label={`Search pages (${IS_MAC ? '⌘K' : 'Ctrl K'})`}
            aria-label="Search pages"
            className="sb-icon-btn sb-focus hidden lg:flex mx-auto !w-9 !h-9 rounded-lg cursor-pointer"
          >
            <Search size={16} />
          </button>
        )}
        <div className={clsx('relative', collapsed && 'lg:hidden')}>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--sb-faint)] pointer-events-none" />
          <input
            ref={navSearchRef}
            type="search"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setNavQuery(''); (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Enter') {
                const first = navRef.current?.querySelector<HTMLAnchorElement>('a[href]');
                if (first) { e.preventDefault(); first.click(); setNavQuery(''); }
              }
            }}
            placeholder="Search pages"
            aria-label="Search pages in the menu"
            aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
            className="sb-field w-full pl-8 pr-12 focus:outline-none"
          />
          {navQuery === '' && (
            <kbd className="sb-kbd absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:inline-flex" aria-hidden="true">
              {IS_MAC ? '⌘K' : 'Ctrl K'}
            </kbd>
          )}
        </div>
      </div>

      <NavQuery.Provider value={navQuery}>
      <nav ref={navRef} aria-label="Main" className={clsx('sidebar-nav-scroll flex-1 min-h-0 lg:flex-[0_1_auto] px-3 pt-2 pb-3 overflow-y-auto overflow-x-hidden', collapsed && 'lg:pt-1')}>
        {sections.map((s, i) => (
          <NavGroup
            key={s.title ?? `flat-${i}`}
            title={s.title}
            links={s.links}
            collapsed={collapsed}
            open={s.title ? groups.isOpen(s.title) : true}
            onToggle={() => s.title && groups.toggle(s.title)}
            onNavigate={onClose}
            first={i === 0}
          />
        ))}
        {navNoMatch && (
          <p className="px-3 py-5 text-[12.5px] text-center text-[color:var(--sb-muted)]">No pages match “{navQuery.trim()}”</p>
        )}
      </nav>
      </NavQuery.Provider>

      <div className={clsx('sb-hairline flex items-center gap-1 px-2 py-2 border-t shrink-0', collapsed && 'lg:px-0 lg:justify-center')}>
        <ProfileMenu
          user={user}
          roleAccent={roleAccent}
          subtitle={schoolName ? roleLabel : user?.email ?? ''}
          dark={dark}
          onToggleTheme={toggle}
          onOpenSearch={() => { onOpenSearch(); onClose(); }}
          onLogout={() => { logout(); navigate('/login'); }}
          collapsed={collapsed}
        />
        <button
          type="button"
          onClick={toggle}
          data-tip={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={clsx('sb-icon-btn sb-focus cursor-pointer', collapsed && 'lg:hidden')}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
      </aside>
      {rail.label}
    </>
  );
}

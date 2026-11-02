import { useCallback, useEffect, useState } from 'react';

/* Analytics — what the page shows is the viewer's choice: which sections, in what order, how wide,
   chart or table, and which headline numbers. The choice is kept per user in this browser
   (localStorage), so each admin keeps their own layout. Everything here is presentation only; the
   data still comes from the backend's /pilot-analytics routes. */

export type WidgetGroup = 'overview' | 'checkins' | 'signins' | 'phones' | 'support';
export type WidgetSize = 'half' | 'full';
export type WidgetView = 'chart' | 'table';

export interface WidgetDef {
  id: string;
  title: string;
  group: WidgetGroup;
  description: string;
  /** Default width; the viewer can change it. */
  size: WidgetSize;
  /** Has a chart that can also be read as a table. */
  chart?: boolean;
  superAdminOnly?: boolean;
}

export const GROUP_LABEL: Record<WidgetGroup, string> = {
  overview: 'Overview',
  checkins: 'Check-ins',
  signins: 'Sign-ins',
  phones: 'Students & phones',
  support: 'Support',
};

export const WIDGETS: WidgetDef[] = [
  { id: 'schools', title: 'All schools', group: 'overview', size: 'full', superAdminOnly: true, description: 'Headline numbers for every school. Click a school to see its details.' },
  { id: 'kpis', title: 'Headline numbers', group: 'overview', size: 'full', description: 'The numbers you picked, at a glance.' },
  { id: 'needs-help', title: 'Needs help now', group: 'overview', size: 'full', description: 'Students locked out after 5 wrong PINs, with Unlock and Reset.' },
  { id: 'funnel', title: 'Onboarding progress', group: 'overview', size: 'half', description: 'How far students have got with setting up the app.' },
  { id: 'checkin-outcomes', title: 'Check-in outcomes', group: 'checkins', size: 'half', chart: true, description: 'Per student per class: first try, after retrying, or gave up.' },
  { id: 'checkins-per-day', title: 'Check-ins per day', group: 'checkins', size: 'half', chart: true, description: 'Present, late and other check-ins each day.' },
  { id: 'checkin-failures', title: 'Why check-ins failed', group: 'checkins', size: 'full', description: 'The message students saw when a check-in did not go through.' },
  { id: 'rssi', title: 'Beacon signal at check-in', group: 'checkins', size: 'half', chart: true, description: 'Signal strength when students checked in, against the threshold.' },
  { id: 'classes', title: 'Classes', group: 'checkins', size: 'full', description: 'Every class in the period plus the next 2 days, with its check-in results.' },
  { id: 'signins-per-day', title: 'Sign-ins per day', group: 'signins', size: 'half', chart: true, description: 'Successful and failed sign-in attempts each day.' },
  { id: 'signin-failures', title: 'Why sign-ins failed', group: 'signins', size: 'half', chart: true, description: 'Failed sign-in attempts by reason.' },
  { id: 'audit', title: 'Sign-in audit log', group: 'signins', size: 'full', description: 'Every sign-in attempt and PIN change, newest first.' },
  { id: 'device-events', title: 'Phone security events', group: 'phones', size: 'half', description: 'Phone switches and blocked attempts.' },
  { id: 'phone-models', title: 'Phone models', group: 'phones', size: 'half', chart: true, description: 'Which phones students are using.' },
  { id: 'closed-accounts', title: 'Closed accounts', group: 'phones', size: 'half', description: 'Students who deleted their account or were deactivated.' },
  { id: 'tickets', title: 'Open support tickets', group: 'support', size: 'half', description: 'Tickets students raised that are not resolved yet.' },
  { id: 'escalations', title: 'Escalations', group: 'support', size: 'half', description: 'Check-in problems raised for a lecturer or admin to review.' },
];
export const widgetById = (id: string) => WIDGETS.find((w) => w.id === id);

export interface KpiDef { id: string; label: string; group: WidgetGroup }
export const KPIS: KpiDef[] = [
  { id: 'students', label: 'Students', group: 'overview' },
  { id: 'signedIn', label: 'Signed in', group: 'overview' },
  { id: 'signedInToday', label: 'Signed in today', group: 'overview' },
  { id: 'termsAccepted', label: 'Accepted the terms', group: 'overview' },
  { id: 'baselineCaptured', label: 'Baseline photo taken', group: 'overview' },
  { id: 'checkInsToday', label: 'Check-ins today', group: 'checkins' },
  { id: 'checkInsPeriod', label: 'Check-ins in period', group: 'checkins' },
  { id: 'checkOutRate', label: 'Check-out rate', group: 'checkins' },
  { id: 'checkInSuccessRate', label: 'Check-in success rate', group: 'checkins' },
  { id: 'firstTry', label: 'Got in first try', group: 'checkins' },
  { id: 'retried', label: 'Got in after retrying', group: 'checkins' },
  { id: 'gaveUp', label: 'Tried but gave up', group: 'checkins' },
  { id: 'failedAttemptsToday', label: 'Failed check-in attempts today', group: 'checkins' },
  { id: 'failedAttemptsPeriod', label: 'Failed check-in attempts in period', group: 'checkins' },
  { id: 'signInsToday', label: 'Sign-ins today (ok / failed)', group: 'signins' },
  { id: 'signInSuccessToday', label: 'Sign-in success today', group: 'signins' },
  { id: 'pinLockedNow', label: 'PIN-locked now', group: 'signins' },
  { id: 'pendingDeviceChanges', label: 'Pending phone changes', group: 'phones' },
  { id: 'closedAccounts', label: 'Closed accounts', group: 'phones' },
  { id: 'openTickets', label: 'Open tickets', group: 'support' },
];

export interface Preset { id: string; label: string; description: string; widgets: string[]; kpis: string[] }
const ALL_KPIS_DEFAULT = ['students', 'signedIn', 'checkInsToday', 'checkInsPeriod', 'checkOutRate', 'signInsToday', 'pinLockedNow', 'checkInSuccessRate', 'firstTry', 'retried', 'gaveUp', 'failedAttemptsToday'];
export const PRESETS: Preset[] = [
  {
    id: 'everything', label: 'Everything', description: 'Every section, in the standard order.',
    widgets: WIDGETS.map((w) => w.id), kpis: ALL_KPIS_DEFAULT,
  },
  {
    id: 'daily', label: 'Daily check', description: 'Who needs help, today\'s check-ins and sign-ins, open tickets.',
    widgets: ['schools', 'kpis', 'needs-help', 'checkin-outcomes', 'signins-per-day', 'checkin-failures', 'tickets'],
    kpis: ['checkInsToday', 'checkInSuccessRate', 'gaveUp', 'failedAttemptsToday', 'signInsToday', 'pinLockedNow', 'openTickets'],
  },
  {
    id: 'checkins', label: 'Check-in quality', description: 'Why check-ins fail, beacon signal, class by class.',
    widgets: ['schools', 'kpis', 'checkin-outcomes', 'checkins-per-day', 'checkin-failures', 'rssi', 'classes'],
    kpis: ['checkInsPeriod', 'checkInSuccessRate', 'firstTry', 'retried', 'gaveUp', 'failedAttemptsPeriod', 'checkOutRate'],
  },
  {
    id: 'onboarding', label: 'Onboarding', description: 'Sign-up progress, sign-in problems, phones in use.',
    widgets: ['schools', 'kpis', 'funnel', 'signins-per-day', 'signin-failures', 'phone-models', 'audit'],
    kpis: ['students', 'signedIn', 'signedInToday', 'termsAccepted', 'baselineCaptured', 'signInSuccessToday', 'pinLockedNow'],
  },
  {
    id: 'support', label: 'Support & security', description: 'Lockouts, phone events, closed accounts, tickets.',
    widgets: ['schools', 'kpis', 'needs-help', 'device-events', 'closed-accounts', 'tickets', 'escalations', 'audit'],
    kpis: ['pinLockedNow', 'pendingDeviceChanges', 'closedAccounts', 'openTickets', 'signInsToday'],
  },
];

export interface Layout {
  /** The preset last applied; 'custom' once the viewer changes anything by hand. */
  preset: string;
  /** Visible sections, in order. */
  widgets: string[];
  kpis: string[];
  days: number;
  sizes: Record<string, WidgetSize>;
  views: Record<string, WidgetView>;
  collapsed: string[];
}

export const DEFAULT_LAYOUT: Layout = {
  preset: 'everything',
  widgets: PRESETS[0].widgets,
  kpis: PRESETS[0].kpis,
  days: 7,
  sizes: {},
  views: {},
  collapsed: [],
};

const storageKey = (userId: string | undefined) => `tcheck.analytics.layout.v1:${userId ?? 'anon'}`;

function load(userId: string | undefined): Layout {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_LAYOUT;
    const v = JSON.parse(raw) as Partial<Layout>;
    const known = new Set(WIDGETS.map((w) => w.id));
    const knownKpi = new Set(KPIS.map((k) => k.id));
    return {
      ...DEFAULT_LAYOUT,
      ...v,
      // A section removed in a later version just drops out of a saved layout.
      widgets: (v.widgets ?? DEFAULT_LAYOUT.widgets).filter((id) => known.has(id)),
      kpis: (v.kpis ?? DEFAULT_LAYOUT.kpis).filter((id) => knownKpi.has(id)),
      days: [1, 7, 14, 30].includes(v.days ?? 7) ? (v.days as number) : 7,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/** The viewer's layout, saved on every change. */
export function useAnalyticsLayout(userId: string | undefined) {
  const [layout, setLayout] = useState<Layout>(() => load(userId));
  useEffect(() => { setLayout(load(userId)); }, [userId]);
  useEffect(() => {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(layout)); } catch { /* private mode: not remembered */ }
  }, [layout, userId]);

  const update = useCallback((fn: (l: Layout) => Layout, keepPreset = false) => {
    setLayout((l) => {
      const next = fn(l);
      return keepPreset ? next : { ...next, preset: 'custom' };
    });
  }, []);

  return {
    layout,
    setDays: (days: number) => update((l) => ({ ...l, days }), true),
    applyPreset: (id: string) => {
      const p = PRESETS.find((x) => x.id === id);
      if (p) setLayout((l) => ({ ...l, preset: p.id, widgets: p.widgets, kpis: p.kpis, collapsed: [] }));
    },
    toggleWidget: (id: string) => update((l) => ({ ...l, widgets: l.widgets.includes(id) ? l.widgets.filter((w) => w !== id) : [...l.widgets, id] })),
    moveWidget: (id: string, dir: -1 | 1) => update((l) => {
      const i = l.widgets.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.widgets.length) return l;
      const w = [...l.widgets];
      [w[i], w[j]] = [w[j], w[i]];
      return { ...l, widgets: w };
    }),
    setSize: (id: string, size: WidgetSize) => update((l) => ({ ...l, sizes: { ...l.sizes, [id]: size } })),
    setView: (id: string, view: WidgetView) => update((l) => ({ ...l, views: { ...l.views, [id]: view } }), true),
    toggleCollapsed: (id: string) => update((l) => ({ ...l, collapsed: l.collapsed.includes(id) ? l.collapsed.filter((c) => c !== id) : [...l.collapsed, id] }), true),
    toggleKpi: (id: string) => update((l) => ({ ...l, kpis: l.kpis.includes(id) ? l.kpis.filter((k) => k !== id) : [...l.kpis, id] })),
    reset: () => setLayout(DEFAULT_LAYOUT),
  };
}

/** Download rows as a CSV file (quoted; a leading = + - @ is neutralised for spreadsheets). */
export function downloadCsv(filename: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const csv = [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

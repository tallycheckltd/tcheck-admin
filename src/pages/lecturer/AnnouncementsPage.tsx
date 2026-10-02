import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Clock, AlertTriangle, Info, Link as LinkIcon, ChevronDown, Search, Inbox, Send } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import type { Broadcast, ComposeAudiences } from '../../types';
import { SystemAnnouncementsPage } from '../admin/SystemAnnouncementsPage';

const severityConfig: Record<Broadcast['severity'], { icon: React.ReactNode; bg: string; border: string; label: string; chip: string }> = {
  INFO: { icon: <Info size={16} className="text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-l-blue-500', label: 'Info', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  WARNING: { icon: <AlertTriangle size={16} className="text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-l-amber-500', label: 'Warning', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  CRITICAL: { icon: <AlertTriangle size={16} className="text-red-500" />, bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-l-red-500', label: 'Urgent', chip: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const when = (a: Broadcast) => new Date(a.publishedAt ?? a.createdAt);

function dayLabel(key: string) {
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (key === dayKey(today)) return 'Today';
  if (key === dayKey(yest)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
const audienceOf = (a: Broadcast) =>
  a.course ? `${a.course.name} (${a.course.code})`
    : a.cohort ? `${a.cohort.name} (${a.cohort.year})`
      : a.major ? a.major.name
        : a.orgUnit ? a.orgUnit.name
          : a.school ? a.school.name : 'All schools';

/**
 * UAT F17 / F12 (2026-09-29) — the one Announcements page. "Received" is everyone's feed: this month
 * grouped by day (Today, Yesterday, Mon 28 Sep…), earlier months folded into one collapsible group
 * each. "Send & manage" appears for anyone allowed to write (GET /broadcasts/audiences) — the same
 * composer as the School Admin's, limited to what that person may reach. `?cohortId=` (from the CEM
 * programme menu) opens the composer with that programme picked.
 */
export function AnnouncementsPage() {
  const [params] = useSearchParams();
  const presetCohortId = params.get('cohortId') ?? '';
  const { data: aud } = useApi<ComposeAudiences>('/broadcasts/audiences');
  const canCompose = !!aud?.canCompose;
  const [view, setView] = useState<'received' | 'send'>(presetCohortId ? 'send' : 'received');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone size={22} className="text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Announcements</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {canCompose ? 'Read what was sent to you, and send to the people you look after.' : 'Updates from your institution and courses.'}
            </p>
          </div>
        </div>
        {canCompose && (
          <div role="tablist" className="inline-flex rounded-xl border border-gray-200 dark:border-white/10 p-1 gap-1">
            {([['received', 'Received', Inbox], ['send', 'Send & manage', Send]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${view === key ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'send' && canCompose ? <SystemAnnouncementsPage embedded presetCohortId={presetCohortId} /> : <ReceivedFeed />}
    </div>
  );
}

function ReceivedFeed() {
  const { data: broadcasts, refetch } = useApi<Broadcast[]>('/broadcasts');
  const { mutate: markRead } = useMutation('post');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { days, months, unread } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = (broadcasts ?? []).filter((a) => !q || `${a.title} ${a.body} ${a.createdByName} ${audienceOf(a)}`.toLowerCase().includes(q));
    const thisMonth = monthKey(new Date());
    const dayMap = new Map<string, Broadcast[]>();
    const monthMap = new Map<string, Broadcast[]>();
    for (const a of rows) {
      const d = when(a);
      if (monthKey(d) === thisMonth) dayMap.set(dayKey(d), [...(dayMap.get(dayKey(d)) ?? []), a]);
      else monthMap.set(monthKey(d), [...(monthMap.get(monthKey(d)) ?? []), a]);
    }
    const byNewest = (x: [string, Broadcast[]], y: [string, Broadcast[]]) => (x[0] < y[0] ? 1 : -1);
    return { days: [...dayMap.entries()].sort(byNewest), months: [...monthMap.entries()].sort(byNewest), unread: rows.filter((a) => !a.isRead).length };
  }, [broadcasts, search]);

  const read = (a: Broadcast) => { if (!a.isRead) markRead(`/broadcasts/${a.id}/read`).then(() => refetch()); };
  const searching = !!search.trim();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
          />
        </div>
        {unread > 0 && <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-blue-500 text-white">{unread} unread</span>}
      </div>

      {days.map(([key, rows]) => (
        <section key={key}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            {dayLabel(key)} <span className="font-medium normal-case tracking-normal">· {rows.length}</span>
          </h2>
          <div className="space-y-3">{rows.map((a) => <Card key={a.id} a={a} onOpen={() => read(a)} />)}</div>
        </section>
      ))}

      {months.map(([key, rows]) => {
        const isOpen = open[key] ?? searching;
        const unreadHere = rows.filter((a) => !a.isRead).length;
        return (
          <section key={key} className="glass-card overflow-hidden">
            <button
              onClick={() => setOpen((p) => ({ ...p, [key]: !isOpen }))}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <span className="text-sm font-semibold text-slate-950 dark:text-white">
                {monthLabel(key)} <span className="font-normal text-slate-500">· {rows.length} announcement{rows.length === 1 ? '' : 's'}{unreadHere ? ` · ${unreadHere} unread` : ''}</span>
              </span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="space-y-3 p-4 pt-0">{rows.map((a) => <Card key={a.id} a={a} onOpen={() => read(a)} showDate />)}</div>}
          </section>
        );
      })}

      {broadcasts && days.length === 0 && months.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">{searching ? 'Nothing matches your search.' : 'No announcements yet.'}</p>
      )}
    </div>
  );
}

function Card({ a, onOpen, showDate = false }: { a: Broadcast; onOpen: () => void; showDate?: boolean }) {
  const cfg = severityConfig[a.severity];
  const t = when(a);
  return (
    <div className={`glass-card p-4 border-l-4 ${cfg.border} ${a.isRead ? 'opacity-75' : ''} cursor-pointer`} onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">{a.title}</p>
            {!a.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />}
            {a.severity !== 'INFO' && <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${cfg.chip}`}>{cfg.label}</span>}
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-gray-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">{audienceOf(a)}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{a.body}</p>
          {a.resourceUrl && (
            <a
              href={a.resourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium rounded-lg px-2.5 py-1.5 bg-blue-500 text-white hover:bg-blue-600"
            >
              <LinkIcon size={12} /> {a.resourceLabel || 'Open link'}
            </a>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {showDate ? t.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' : ''}
              {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {a.editedAt ? ' · edited' : ''}
            </span>
            <span>· {a.createdByName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Wrench, Clock, CheckCircle2, AlertTriangle, Search, Send, Siren,
  ThermometerSnowflake, Tv, Coffee, HelpCircle, MapPin,
} from 'lucide-react';
import type { FacilityTicket, FacilityTicketPreset } from '../../types';

const PRESET_META: Record<FacilityTicketPreset, { label: string; icon: typeof Wrench }> = {
  AC_TOO_COLD: { label: 'AC too cold', icon: ThermometerSnowflake },
  AV_ISSUE: { label: 'AV / projector issue', icon: Tv },
  CATERING: { label: 'Catering', icon: Coffee },
  OTHER: { label: 'Other', icon: HelpCircle },
};

const timeAgo = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/** Mirrors EscalationsPage's urgency() — a ticket's own status/slaBreachedAt/priority drive the
 * color, not a re-derived time window, since slaBreachedAt is the server's own permanent breach
 * flag (facilityTicketSla.service.ts) and priority is only ever set by a human via Escalate, not
 * something worth recomputing client-side. Priority checked before slaBreachedAt — a
 * staff-initiated escalation is a stronger, more current signal than an SLA timer that may have
 * only just ticked over. */
function urgency(t: FacilityTicket): { label: string; color: 'red' | 'yellow' | 'blue' | 'green' } {
  if (t.status === 'RESOLVED') return { label: 'Resolved', color: 'green' };
  if (t.priority === 'URGENT') return { label: 'Escalated', color: 'red' };
  if (t.status === 'ACKNOWLEDGED') return { label: 'Being handled', color: 'blue' };
  if (t.slaBreachedAt) return { label: 'SLA breached', color: 'red' };
  return { label: 'Open', color: 'yellow' };
}

export function FacilitiesQueuePage() {
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL'>('OPEN');
  const [search, setSearch] = useState('');
  // URL-driven, not local state — selecting a ticket now visibly changes the address bar
  // (?ticket=<id>), so it reads as real navigation (shareable/bookmarkable/back-button-able),
  // not just an inline state flip that's easy to miss happened at all.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('ticket') ?? '';
  const setSelectedId = (id: string) => setSearchParams(id ? { ticket: id } : {}, { replace: false });
  const [replyText, setReplyText] = useState('');

  const { data: tickets, refetch } = useApi<FacilityTicket[]>(
    statusFilter === 'ALL' ? '/facility-tickets' : `/facility-tickets?status=${statusFilter}`,
    { refetchIntervalMs: 20_000, refetchWhenVisible: true },
  );
  // Full detail (including the reply thread, which the list endpoint only summarizes via
  // `_count`) is fetched separately, same reasoning as the mobile clients' own detail calls.
  const { data: selected, error: detailError, refetch: refetchDetail } = useApi<FacilityTicket>(
    selectedId ? `/facility-tickets/${selectedId}` : null,
  );
  const { mutate: acknowledge, loading: acknowledging } = useMutation<FacilityTicket>('post');
  const { mutate: resolve, loading: resolving } = useMutation<FacilityTicket>('post');
  const { mutate: escalate, loading: escalating } = useMutation<FacilityTicket>('post');
  const { mutate: reply, loading: replying } = useMutation<FacilityTicket>('post');

  const filtered = useMemo(() => {
    const list = tickets || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((t) =>
      PRESET_META[t.presetType].label.toLowerCase().includes(q) ||
      (t.detail || '').toLowerCase().includes(q) ||
      (t.class?.title || '').toLowerCase().includes(q) ||
      `${t.createdBy?.firstName} ${t.createdBy?.lastName}`.toLowerCase().includes(q));
  }, [tickets, search]);

  const openCount = (tickets || []).filter((t) => t.status === 'OPEN').length;
  const breachedCount = (tickets || []).filter((t) => t.status !== 'RESOLVED' && t.slaBreachedAt).length;
  const resolvedCount = (tickets || []).filter((t) => t.status === 'RESOLVED').length;

  const handleAcknowledge = async (id: string) => {
    await acknowledge(`/facility-tickets/${id}/acknowledge`);
    refetch();
    refetchDetail();
  };

  const handleResolve = async (id: string) => {
    await resolve(`/facility-tickets/${id}/resolve`);
    refetch();
    refetchDetail();
  };

  const handleEscalate = async (id: string) => {
    await escalate(`/facility-tickets/${id}/escalate`);
    refetch();
    refetchDetail();
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    await reply(`/facility-tickets/${selected.id}/reply`, { message: replyText.trim() });
    setReplyText('');
    refetchDetail();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Facilities</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Room issues students raise mid-session — AC, AV, catering, and everything else.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Wrench size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">{openCount}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Open right now</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">{breachedCount}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">SLA breached (5m+)</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-950 dark:text-white">{resolvedCount}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Resolved (this view)</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-22rem)]">
        <div className="w-96 flex flex-col">
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search issue, class, student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-4">
            {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === s
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="glass-card flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map((t) => {
              const u = urgency(t);
              const meta = PRESET_META[t.presetType];
              const Icon = meta.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    selectedId === t.id
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-950 dark:text-white truncate flex-1 flex items-center gap-1.5">
                      <Icon size={14} className="flex-shrink-0 text-slate-500 dark:text-slate-400" /> {meta.label}
                    </p>
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-shrink-0">{timeAgo(t.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                    <MapPin size={11} className="flex-shrink-0" /> {t.class?.title || 'No class linked'}
                    {t.class?.room ? ` — ${t.class.room}` : ''}
                  </p>
                  {t.detail && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-1">{t.detail}</p>}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge color={u.color}>{u.label}</Badge>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Wrench size={32} className="text-slate-400 dark:text-gray-600 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400">No tickets{statusFilter !== 'ALL' ? ` (${statusFilter.toLowerCase()})` : ''}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 glass-card flex flex-col overflow-hidden">
          {selectedId && detailError ? (
            // Previously silent: a 403/404/500 on the detail fetch just left `selected` null,
            // which fell straight through to the generic "select a ticket" placeholder below —
            // indistinguishable from a click that did nothing at all.
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <AlertTriangle size={40} className="mx-auto mb-3 text-rose-400" />
                <p className="text-sm font-medium text-slate-950 dark:text-white">Couldn't load this ticket</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{detailError}</p>
                <button onClick={() => refetchDetail()} className="mt-3 text-sm text-blue-500 hover:text-blue-600 cursor-pointer">
                  Try again
                </button>
              </div>
            </div>
          ) : selected ? (
            <div className="p-6 flex flex-col h-full overflow-hidden">
              <div className="space-y-5 overflow-y-auto flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white flex-shrink-0">
                      {(() => { const Icon = PRESET_META[selected.presetType].icon; return <Icon size={22} />; })()}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-950 dark:text-white">
                        {PRESET_META[selected.presetType].label}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Raised by {selected.createdBy?.firstName} {selected.createdBy?.lastName}
                      </p>
                    </div>
                  </div>
                  <Badge color={urgency(selected).color}>{urgency(selected).label}</Badge>
                </div>

                <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Class</p>
                  <p className="text-sm text-slate-950 dark:text-white">
                    {selected.class?.title || 'No class linked'}{selected.class?.room ? ` — ${selected.class.room}` : ''}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> Raised {timeAgo(selected.createdAt)}
                  </p>
                </div>

                {selected.detail && (
                  <div className="rounded-xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 p-4 space-y-1.5">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">Detail from the student</p>
                    <p className="text-sm text-slate-950 dark:text-white">{selected.detail}</p>
                  </div>
                )}

                {selected.assignedTo && (
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Assigned to {selected.assignedTo.firstName} {selected.assignedTo.lastName}
                  </p>
                )}

                {selected.messages && selected.messages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Thread</p>
                    {selected.messages.map((m) => (
                      <div key={m.id} className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {m.sender.firstName} {m.sender.lastName} <span className="text-slate-400 dark:text-slate-500 font-normal">· {timeAgo(m.createdAt)}</span>
                        </p>
                        <p className="text-sm text-slate-950 dark:text-white mt-0.5">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-2 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply to the student..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }}
                    className="flex-1 px-3 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <Button variant="secondary" onClick={handleReply} disabled={replying || !replyText.trim()}>
                    <Send size={16} />
                  </Button>
                </div>
                {selected.status !== 'RESOLVED' && (
                  <div className="flex gap-2">
                    {selected.status === 'OPEN' && (
                      <Button onClick={() => handleAcknowledge(selected.id)} disabled={acknowledging} variant="secondary" className="flex-1">
                        Acknowledge
                      </Button>
                    )}
                    {selected.priority !== 'URGENT' && (
                      <Button onClick={() => handleEscalate(selected.id)} disabled={escalating} variant="danger" className="flex-1">
                        <Siren size={16} className="mr-1.5" /> Escalate
                      </Button>
                    )}
                    <Button onClick={() => handleResolve(selected.id)} disabled={resolving} className="flex-1">
                      <CheckCircle2 size={16} className="mr-1.5" /> Mark Resolved
                    </Button>
                  </div>
                )}
                {selected.status === 'RESOLVED' && (
                  <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 p-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-slate-950 dark:text-white">
                      Resolved {selected.resolvedAt && timeAgo(selected.resolvedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Wrench size={48} className="mx-auto mb-4 text-gray-200 dark:text-gray-700" />
                <p className="text-slate-600 text-sm">Select a ticket to see the full picture</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

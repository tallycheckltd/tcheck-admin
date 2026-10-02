import { useState, useEffect, useRef } from 'react';
import { PlatformAccessCard } from '../../components/support/PlatformAccessCard';
import { SupportHistory } from '../../components/support/SupportHistory';
import { Can } from '../../components/shared/Can';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LifeBuoy, Plus, Send, School as SchoolIcon, Search } from 'lucide-react';
import type { Ticket, School } from '../../types';

const STATUS_COLOR: Record<Ticket['status'], 'blue' | 'yellow' | 'green' | 'gray'> = {
  OPEN: 'blue',
  IN_PROGRESS: 'yellow',
  RESOLVED: 'green',
  CLOSED: 'gray',
};

const PRIORITY_COLOR: Record<Ticket['priority'], 'gray' | 'blue' | 'yellow' | 'red'> = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'yellow',
  URGENT: 'red',
};

const timeAgo = (dateStr: string) => {
  // eslint-disable-next-line react-hooks/purity -- relative time uses wall clock at render
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const TIMELINE_LABEL: Record<string, string> = {
  'supportTicket.acknowledged': 'Acknowledged', 'supportTicket.resolved': 'Resolved', 'supportTicket.closed': 'Closed',
  'supportTicket.reopened': 'Reopened', 'supportTicket.updated': 'Updated',
};
// UAT F7 — response-time targets for platform support.
const ACK_TARGET_H = 24;
const RESOLVE_TARGET_H = 5 * 24;
const dur = (ms: number) => { const h = ms / 3_600_000; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`; };

/** Time to acknowledge and to resolve against the targets — red when over. */
function ResponseTimes({ t }: { t: Ticket }) {
  const [now] = useState(() => Date.now());
  const created = new Date(t.createdAt).getTime();
  const ackMs = (t.acknowledgedAt ? new Date(t.acknowledgedAt).getTime() : now) - created;
  const resMs = (t.resolvedAt ? new Date(t.resolvedAt).getTime() : now) - created;
  const cls = (over: boolean) => (over ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-400');
  return (
    <p className="text-xs flex flex-wrap gap-x-4">
      <span className={cls(ackMs > ACK_TARGET_H * 3_600_000)}>{t.acknowledgedAt ? `Acknowledged in ${dur(ackMs)}` : `Waiting ${dur(ackMs)} for acknowledgement`} (target {ACK_TARGET_H} h)</span>
      <span className={cls(resMs > RESOLVE_TARGET_H * 3_600_000)}>{t.resolvedAt ? `Resolved in ${dur(resMs)}` : `Open ${dur(resMs)}`} (target {RESOLVE_TARGET_H / 24} days)</span>
    </p>
  );
}

export function SupportPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [schoolFilter, setSchoolFilter] = useState('');
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { data: tickets, refetch } = useApi<Ticket[]>(
    isSuperAdmin && schoolFilter ? `/tickets?schoolId=${schoolFilter}` : '/tickets'
  );
  const { mutate: createTicket } = useMutation<Ticket>('post');
  const { mutate: sendReply } = useMutation('post');
  const { mutate: patchTicket } = useMutation<Ticket>('patch');
  const socketRef = useRef<Socket | null>(null);

  const [search, setSearch] = useState('');
  // UAT F7 — classification filters (status, category, priority) beside the school filter.
  const [statusF, setStatusF] = useState<'ACTIVE' | Ticket['status'] | 'ALL'>('ACTIVE');
  const [categoryF, setCategoryF] = useState<'ALL' | 'GENERAL' | 'BEACON_HEALTH'>('ALL');
  const [priorityF, setPriorityF] = useState<'ALL' | Ticket['priority']>('ALL');
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', priority: 'NORMAL' as Ticket['priority'] });

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    try {
      const d = await api.get<Ticket>(`/tickets/${id}`);
      setDetail(d);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    socketRef.current = s;
    s.on('ticket:new', () => refetch());
    s.on('ticket:updated', () => { refetch(); if (selectedId) loadDetail(selectedId); });
    s.on('ticket:message', () => { if (selectedId) loadDetail(selectedId); });
    return () => { s.disconnect(); socketRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribing per selectedId change is intentional
  }, [selectedId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s || !selectedId) return;
    s.emit('join:ticket', selectedId);
    return () => { s.emit('leave:ticket', selectedId); };
  }, [selectedId]);

  const handleCreate = async () => {
    await createTicket('/tickets', form);
    setModal(false);
    setForm({ subject: '', message: '', priority: 'NORMAL' });
    refetch();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedId) return;
    await sendReply(`/tickets/${selectedId}/reply`, { message: replyText });
    setReplyText('');
    loadDetail(selectedId);
    refetch();
  };

  const handlePriority = async (priority: Ticket['priority']) => {
    if (!selectedId) return;
    await patchTicket(`/tickets/${selectedId}`, { priority });
    loadDetail(selectedId);
    refetch();
  };

  /** UAT F7 — Acknowledge / Resolve (note required) / Close / Reopen; each is recorded. */
  const act = async (action: 'acknowledge' | 'resolve' | 'close' | 'reopen') => {
    if (!selectedId) return;
    setActionError('');
    try {
      await api.post(`/tickets/${selectedId}/${action}`, action === 'resolve' ? { note: resolveNote.trim() } : {});
      setResolving(false); setResolveNote('');
      loadDetail(selectedId);
      refetch();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Could not update the ticket'); }
  };

  const filtered = (tickets || []).filter((t) => {
    if (statusF === 'ACTIVE' ? t.status === 'RESOLVED' || t.status === 'CLOSED' : statusF !== 'ALL' && t.status !== statusF) return false;
    if (categoryF !== 'ALL' && (t.category ?? 'GENERAL') !== categoryF) return false;
    if (priorityF !== 'ALL' && t.priority !== priorityF) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return t.subject.toLowerCase().includes(q) || (t.school?.name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Support</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isSuperAdmin ? 'Tickets raised by schools across the platform' : 'Raise an issue with the Tcheck team'}
          </p>
        </div>
        {!isSuperAdmin && (
          <Can perm="MANAGE_TICKETS" newForLecturer>
            <Button onClick={() => setModal(true)}><Plus size={16} className="mr-1" /> New Ticket</Button>
          </Can>
        )}
      </div>

      {user?.role === 'SCHOOL_ADMIN' && <PlatformAccessCard />}

      <div className="flex gap-6 h-[calc(100vh-16rem)]">
        <div className="w-96 flex flex-col">
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          {isSuperAdmin && (
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full mb-4 rounded-xl px-3 py-2 text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
            >
              <option value="">All institutions</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
            {([['ACTIVE', 'Open & in progress'], ['ALL', 'All'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setStatusF(k)} className={`px-2.5 py-1 rounded-full border cursor-pointer ${statusF === k ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-300'}`}>{l}</button>
            ))}
            <select value={categoryF} onChange={(e) => setCategoryF(e.target.value as typeof categoryF)} aria-label="Category" className="rounded-full px-2 py-1 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
              <option value="ALL">Every category</option><option value="GENERAL">General</option><option value="BEACON_HEALTH">Beacon health</option>
            </select>
            <select value={priorityF} onChange={(e) => setPriorityF(e.target.value as typeof priorityF)} aria-label="Priority" className="rounded-full px-2 py-1 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
              <option value="ALL">Any priority</option>{(['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>

          <div className="glass-card flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => loadDetail(t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${
                  selectedId === t.id
                    ? 'bg-blue-500/10 border border-blue-500/20'
                    : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-950 dark:text-white truncate flex-1">{t.subject}</p>
                  <span className="text-xs text-slate-600 dark:text-slate-400 flex-shrink-0">{timeAgo(t.updatedAt)}</span>
                </div>
                {isSuperAdmin && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <SchoolIcon size={11} /> {t.school?.name}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge color={STATUS_COLOR[t.status]}>{t.status.replace('_', ' ')}</Badge>
                  <Badge color={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
                  <span className="text-xs text-slate-600 dark:text-slate-400">{t._count?.messages ?? 0} msg</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <LifeBuoy size={32} className="text-slate-400 dark:text-gray-600 mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400">No tickets yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 glass-card flex flex-col overflow-hidden">
          {detail ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">{detail.subject}</p>
                    {/* P12: system-raised tickets carry their facts in the body (beacon, room, battery, classes at risk). */}
                    {detail.body && <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap mt-1 font-sans" data-testid="ticket-body">{detail.body}</pre>}
                    {isSuperAdmin && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {detail.school?.name} &middot; {detail.createdBy ? `raised by ${detail.createdBy.firstName} ${detail.createdBy.lastName}` : 'raised by the beacon-health sweep'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge color={STATUS_COLOR[detail.status]}>{detail.status.replace('_', ' ')}</Badge>
                    <Badge color={PRIORITY_COLOR[detail.priority]}>{detail.priority}</Badge>
                  </div>
                </div>
                <ResponseTimes t={detail} />
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.status === 'OPEN' && <Button size="sm" onClick={() => void act('acknowledge')}>Acknowledge</Button>}
                      {(detail.status === 'OPEN' || detail.status === 'IN_PROGRESS') && <Button size="sm" variant="secondary" onClick={() => setResolving((v) => !v)}>Resolve…</Button>}
                      {detail.status !== 'CLOSED' && <Button size="sm" variant="secondary" onClick={() => void act('close')}>Close</Button>}
                      {(detail.status === 'RESOLVED' || detail.status === 'CLOSED') && <Button size="sm" variant="secondary" onClick={() => void act('reopen')}>Reopen</Button>}
                      <select value={detail.priority} onChange={(e) => void handlePriority(e.target.value as Ticket['priority'])} aria-label="Priority"
                        className="ml-auto rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                        {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()} priority</option>)}
                      </select>
                    </div>
                    {resolving && (
                      <div className="flex gap-2">
                        <input value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="How was it resolved?" className="flex-1 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        <Button size="sm" disabled={!resolveNote.trim()} onClick={() => void act('resolve')}>Mark resolved</Button>
                      </div>
                    )}
                    {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
                  </div>
                )}
                {detail.resolutionNote && <p className="text-xs text-emerald-700 dark:text-emerald-400">Resolution: {detail.resolutionNote}</p>}
                {!!detail.timeline?.length && (
                  <ol className="border-l border-gray-200 dark:border-white/10 pl-3 space-y-1 max-h-32 overflow-y-auto">
                    {detail.timeline.map((e, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{TIMELINE_LABEL[e.action] ?? e.action}</span>
                        {e.actor ? ` · ${e.actor.firstName} ${e.actor.lastName}` : ''} · {new Date(e.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        {e.reason ? ` — ${e.reason}` : ''}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {detail.messages?.map((m) => {
                  const fromSchool = m.sender?.role !== 'SUPER_ADMIN'; // the institution's side of the thread
                  return (
                    <div key={m.id} className={`flex ${fromSchool ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-sm">
                        <p className={`text-xs mb-1 ${fromSchool ? 'text-left' : 'text-right'} text-slate-600 dark:text-slate-400`}>
                          {m.sender?.firstName} {m.sender?.lastName}
                        </p>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                          fromSchool
                            ? 'bg-gray-100 dark:bg-white/5 text-slate-950 dark:text-white rounded-bl-md'
                            : 'bg-blue-500/10 text-slate-950 dark:text-white rounded-br-md'
                        }`}>
                          {m.content}
                        </div>
                        <p className={`text-xs mt-1 ${fromSchool ? 'text-left' : 'text-right'} text-slate-600 dark:text-slate-400`}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <Can perm="MANAGE_TICKETS" newForLecturer>
              <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }}
                  placeholder="Type a reply..."
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  onClick={handleReply}
                  className="p-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </div>
              </Can>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <LifeBuoy size={48} className="mx-auto mb-4 text-gray-200 dark:text-gray-700" />
                <p className="text-slate-600 text-sm">Select a ticket to view the thread</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UAT F7 — history by institution → school → term. */}
      <SupportHistory />

      <Modal open={modal} onClose={() => setModal(false)} title="Raise a Support Ticket">
        <div className="space-y-4">
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Sensors not registering check-ins" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe the issue..."
              rows={5}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Ticket['priority'] })}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
            >
              {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={!form.subject.trim() || !form.message.trim()}>
            Submit Ticket
          </Button>
        </div>
      </Modal>
    </div>
  );
}

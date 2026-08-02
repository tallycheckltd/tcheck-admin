import { useState, useEffect, useRef } from 'react';
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
import type { Ticket } from '../../types';

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

export function SupportPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: tickets, refetch } = useApi<Ticket[]>('/tickets');
  const { mutate: createTicket } = useMutation<Ticket>('post');
  const { mutate: sendReply } = useMutation('post');
  const { mutate: patchTicket } = useMutation<Ticket>('patch');
  const socketRef = useRef<Socket | null>(null);

  const [search, setSearch] = useState('');
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

  const handleStatusChange = async (status: Ticket['status']) => {
    if (!selectedId) return;
    await patchTicket(`/tickets/${selectedId}`, { status });
    loadDetail(selectedId);
    refetch();
  };

  const filtered = (tickets || []).filter((t) => {
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
          <Button onClick={() => setModal(true)}><Plus size={16} className="mr-1" /> New Ticket</Button>
        )}
      </div>

      <div className="flex gap-6 h-[calc(100vh-16rem)]">
        <div className="w-96 flex flex-col">
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
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
                    {isSuperAdmin && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {detail.school?.name} &middot; raised by {detail.createdBy?.firstName} {detail.createdBy?.lastName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge color={STATUS_COLOR[detail.status]}>{detail.status.replace('_', ' ')}</Badge>
                    <Badge color={PRIORITY_COLOR[detail.priority]}>{detail.priority}</Badge>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400">Status</label>
                    <select
                      value={detail.status}
                      onChange={(e) => handleStatusChange(e.target.value as Ticket['status'])}
                      className="rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                    >
                      {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {detail.messages?.map((m) => {
                  const fromSchool = m.sender?.role === 'SUB_ADMIN';
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

      <Modal open={modal} onClose={() => setModal(false)} title="Raise a Support Ticket">
        <div className="space-y-4">
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Beacons not registering check-ins" />
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

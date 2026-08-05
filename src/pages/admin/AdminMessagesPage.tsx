import { useState, useEffect, useRef, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi, useMutation } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Search, MessageSquare, Eye, Flag, CheckCircle, XCircle,
  Users, ChevronRight, AlertTriangle, Clock, Shield, Megaphone,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { AdminConversation, AdminConversationDetail, MessageFlag, Broadcast } from '../../types';

type Tab = 'conversations' | 'flags';

export function AdminMessagesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('conversations');
  const [search, setSearch] = useState('');
  const { data: conversations, refetch: refetchConvos } = useApi<AdminConversation[]>('/messages/admin/conversations');
  const { data: flags, refetch: refetchFlags } = useApi<MessageFlag[]>('/messages/flags');
  const { data: broadcasts } = useApi<Broadcast[]>('/broadcasts');
  const socketRef = useRef<Socket | null>(null);

  // Conversation detail
  const [selectedConvoId, setSelectedConvoId] = useState('');
  const [convoDetail, setConvoDetail] = useState<AdminConversationDetail | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resolve flag modal
  const [resolveModal, setResolveModal] = useState(false);
  const [resolvingFlag, setResolvingFlag] = useState<MessageFlag | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const { mutate: resolveFlag } = useMutation('patch');
  const { mutate: toggleAnon } = useMutation('patch');

  // Initialize socket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = createSocket(token);
    socketRef.current = s;

    // Real-time: new flag created by lecturer
    s.on('flag:new', () => {
      refetchFlags();
      refetchConvos();
    });

    // Real-time: flag resolved
    s.on('flag:resolved', () => {
      refetchFlags();
      refetchConvos();
    });

    // Real-time: new message in any conversation
    s.on('message:new', () => {
      refetchConvos();
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [refetchFlags, refetchConvos]);

  const loadConversation = async (id: string) => {
    setSelectedConvoId(id);
    try {
      const detail = await api.get<AdminConversationDetail>(`/messages/admin/conversations/${id}`);
      setConvoDetail(detail);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convoDetail]);

  // Refresh open conversation when new messages arrive
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !selectedConvoId) return;

    const handler = () => {
      api.get<AdminConversationDetail>(`/messages/admin/conversations/${selectedConvoId}`).then(setConvoDetail);
    };
    s.on('message:new', handler);
    return () => { s.off('message:new', handler); };
  }, [selectedConvoId]);

  const handleResolve = async (status: 'RESOLVED' | 'DISMISSED') => {
    if (!resolvingFlag) return;
    await resolveFlag(`/messages/flags/${resolvingFlag.id}`, { status, resolvedNote: resolveNote || undefined });
    setResolveModal(false);
    setResolvingFlag(null);
    setResolveNote('');
    refetchFlags();
  };

  const handleToggleAnon = async (e: MouseEvent, conv: AdminConversation) => {
    e.stopPropagation();
    await toggleAnon(`/messages/admin/conversations/${conv.id}/anonymous-toggle`, { isAnonymousEnabled: !conv.isAnonymousEnabled });
    refetchConvos();
  };

  const openResolveModal = (flag: MessageFlag) => {
    setResolvingFlag(flag);
    setResolveNote('');
    setResolveModal(true);
  };

  // Filter conversations
  const filteredConversations = conversations?.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (c.kind !== 'DIRECT') {
      const roomName = c.room?.title || c.room?.name || '';
      return roomName.toLowerCase().includes(q);
    }
    const u1 = c.user1 ? `${c.user1.firstName} ${c.user1.lastName}`.toLowerCase() : '';
    const u2 = c.user2 ? `${c.user2.firstName} ${c.user2.lastName}`.toLowerCase() : '';
    return u1.includes(q) || u2.includes(q);
  });

  const pendingFlags = flags?.filter((f) => f.status === 'PENDING') || [];
  const resolvedFlags = flags?.filter((f) => f.status !== 'PENDING') || [];

  const roleColor = (role?: string) => {
    switch (role) {
      case 'LECTURER': return 'blue';
      case 'STUDENT': return 'gray';
      case 'SUPER_ADMIN': return 'purple';
      case 'SUB_ADMIN': return 'purple';
      default: return 'gray';
    }
  };

  const roleLabel = (role?: string) => {
    switch (role) {
      case 'LECTURER': return 'Lecturer';
      case 'STUDENT': return 'Student';
      case 'SUPER_ADMIN': return 'Admin';
      case 'SUB_ADMIN': return 'Admin';
      default: return role || '';
    }
  };

  const roomKindLabel = (kind?: string) => {
    switch (kind) {
      case 'CLASS': return 'Session Chat (archived)';
      case 'COURSE': return 'Course Chat';
      case 'SCHOOL': return 'Campus Chat';
      default: return 'Chat';
    }
  };

  const conversationLabel = (conv?: MessageFlag['conversation']) => {
    if (!conv) return 'a conversation';
    if (conv.kind && conv.kind !== 'DIRECT') {
      return `${roomKindLabel(conv.kind)} — ${conv.room?.title || conv.room?.name || 'room'}`;
    }
    if (conv.user1 && conv.user2) return `${conv.user1.firstName} & ${conv.user2.firstName}`;
    return 'a conversation';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Message Oversight</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Monitor conversations and resolve escalations</p>
        </div>
        {pendingFlags.length > 0 && (
          <button
            onClick={() => setTab('flags')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors cursor-pointer"
          >
            <AlertTriangle size={16} />
            {pendingFlags.length} pending escalation{pendingFlags.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('conversations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            tab === 'conversations'
              ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm'
              : 'text-slate-600 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <MessageSquare size={16} /> Conversations
          <span className="text-xs text-slate-600 dark:text-slate-400">{conversations?.length || 0}</span>
        </button>
        <button
          onClick={() => setTab('flags')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            tab === 'flags'
              ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm'
              : 'text-slate-600 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Flag size={16} /> Escalations
          {pendingFlags.length > 0 && (
            <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">{pendingFlags.length}</span>
          )}
        </button>
      </div>

      {/* Conversations Tab */}
      {tab === 'conversations' && (
        <div className="flex gap-6 h-[calc(100vh-16rem)]">
          {/* Conversation list */}
          <div className="w-96 flex flex-col">
            {broadcasts && broadcasts.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {broadcasts.slice(0, 3).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => navigate('/admin/system-announcements')}
                    className="w-full text-left px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Megaphone size={14} className="text-blue-500 flex-shrink-0" />
                      <p className="text-sm font-medium text-slate-950 dark:text-white truncate">{b.title}</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">{b.body}</p>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 px-1">
              Other Private Chats
            </p>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="glass-card flex-1 overflow-y-auto p-2 space-y-1">
              {filteredConversations?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${
                    selectedConvoId === c.id
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {c.kind === 'DIRECT' && c.user1 && c.user2 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-950 dark:text-white truncate">
                              {c.user1.firstName} {c.user1.lastName}
                            </p>
                            <Badge color={roleColor(c.user1.role) as 'blue' | 'gray' | 'purple'}>{roleLabel(c.user1.role)}</Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <ChevronRight size={10} className="text-slate-600 dark:text-slate-400" />
                            <span className="text-xs text-slate-600">
                              {c.user2.firstName} {c.user2.lastName}
                            </span>
                            <Badge color={roleColor(c.user2.role) as 'blue' | 'gray' | 'purple'}>{roleLabel(c.user2.role)}</Badge>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-950 dark:text-white truncate">
                            {c.room?.title || c.room?.name || 'Room'}
                          </p>
                          <Badge color="purple">{roomKindLabel(c.kind)}</Badge>
                          {(c.kind === 'COURSE' || c.kind === 'SCHOOL') && (
                            <button
                              onClick={(e) => handleToggleAnon(e, c)}
                              title="Toggle anonymous posting for this room"
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                                c.isAnonymousEnabled
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300'
                              }`}
                            >
                              Anon: {c.isAnonymousEnabled ? 'On' : 'Off'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{timeAgo(c.updatedAt)}</span>
                      {c.hasPendingFlags && (
                        <span className="w-2 h-2 rounded-full bg-orange-500" title="Has pending flags" />
                      )}
                    </div>
                  </div>
                  {c.lastMessage && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1.5">{c.lastMessage.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{c.messageCount} messages</span>
                  </div>
                </button>
              ))}
              {(!filteredConversations || filteredConversations.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users size={32} className="text-slate-400 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">No conversations found</p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation detail (read-only) */}
          <div className="flex-1 glass-card flex flex-col overflow-hidden">
            {convoDetail ? (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    {convoDetail.conversation.kind === 'DIRECT' && convoDetail.conversation.user1 && convoDetail.conversation.user2 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-500">{convoDetail.conversation.user1.firstName[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-950 dark:text-white">
                              {convoDetail.conversation.user1.firstName} {convoDetail.conversation.user1.lastName}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{roleLabel(convoDetail.conversation.user1.role)}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 dark:text-slate-600" />
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-purple-500">{convoDetail.conversation.user2.firstName[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-950 dark:text-white">
                              {convoDetail.conversation.user2.firstName} {convoDetail.conversation.user2.lastName}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{roleLabel(convoDetail.conversation.user2.role)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge color="purple">{roomKindLabel(convoDetail.conversation.kind)}</Badge>
                        <p className="text-sm font-medium text-slate-950 dark:text-white">
                          {convoDetail.conversation.room?.title || convoDetail.conversation.room?.name}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5">
                      <Eye size={14} className="text-slate-600 dark:text-slate-400" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Read-only</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {convoDetail.messages.map((m) => {
                    const isDirect = convoDetail!.conversation.kind === 'DIRECT';
                    const isUser1 = isDirect && m.senderId === convoDetail!.conversation.user1?.id;
                    return (
                      <div key={m.id} className={`flex ${!isDirect ? 'justify-start' : isUser1 ? 'justify-start' : 'justify-end'}`}>
                        <div className="max-w-sm">
                          <p className={`text-xs mb-1 ${!isDirect || isUser1 ? 'text-left' : 'text-right'} text-slate-600 dark:text-slate-400 flex items-center gap-1.5`}>
                            {m.sender?.firstName} {m.sender?.lastName}
                            {m.isAnonymous && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                Posted anonymously
                              </span>
                            )}
                          </p>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                            !isDirect || isUser1
                              ? 'bg-gray-100 dark:bg-white/5 text-slate-950 dark:text-white rounded-bl-md'
                              : 'bg-blue-500/10 text-slate-950 dark:text-white rounded-br-md'
                          }`}>
                            {m.content}
                            {m.flags && m.flags.length > 0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-orange-200/30">
                                <span className="text-xs text-orange-500 flex items-center gap-1">
                                  <Flag size={10} /> Flagged
                                </span>
                              </div>
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${!isDirect || isUser1 ? 'text-left' : 'text-right'} text-slate-600 dark:text-slate-400`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            {new Date(m.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Shield size={48} className="mx-auto mb-4 text-gray-200 dark:text-gray-700" />
                  <p className="text-slate-600 text-sm">Select a conversation to review</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">Messages are shown in read-only mode</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flags / Escalations Tab */}
      {tab === 'flags' && (
        <div className="space-y-6">
          {/* Pending escalations */}
          {pendingFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2 mb-3">
                <AlertTriangle size={16} /> Pending Escalations ({pendingFlags.length})
              </h3>
              <div className="space-y-3">
                {pendingFlags.map((flag) => (
                  <div key={flag.id} className="glass-card p-5 border-l-4 border-l-orange-500">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge color="yellow">Pending</Badge>
                          <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Clock size={12} /> {timeAgo(flag.createdAt)}
                          </span>
                        </div>

                        <p className="text-sm text-slate-950 dark:text-white mb-2">
                          <span className="font-medium">{flag.flaggedBy?.firstName} {flag.flaggedBy?.lastName}</span>
                          <span className="text-slate-600 dark:text-slate-400"> reported </span>
                          <span className="font-medium">{conversationLabel(flag.conversation)}</span>
                        </p>

                        <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl px-4 py-3 mb-3">
                          <p className="text-sm text-orange-800 dark:text-orange-300">
                            <span className="font-medium">Reason: </span>{flag.reason}
                          </p>
                        </div>

                        {flag.message && (
                          <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Flagged message:</p>
                            <p className="text-sm text-slate-800 dark:text-gray-300 italic">"{flag.message.content}"</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => flag.conversationId && loadConversation(flag.conversationId).then(() => setTab('conversations'))}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer"
                        >
                          <Eye size={14} /> View Chat
                        </button>
                        <button
                          onClick={() => openResolveModal(flag)}
                          className="flex items-center gap-1.5 text-xs font-medium text-green-500 hover:text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors cursor-pointer"
                        >
                          <CheckCircle size={14} /> Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved flags */}
          {resolvedFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2 mb-3">
                <CheckCircle size={16} /> Resolved ({resolvedFlags.length})
              </h3>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm gradient-table">
                  <thead>
                    <tr>
                      <th>Reported By</th>
                      <th>Between</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Resolved By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800 dark:text-gray-300">
                    {resolvedFlags.map((flag) => (
                      <tr key={flag.id}>
                        <td className="font-medium text-slate-950 dark:text-white">
                          {flag.flaggedBy?.firstName} {flag.flaggedBy?.lastName}
                        </td>
                        <td>
                          {conversationLabel(flag.conversation)}
                        </td>
                        <td className="max-w-xs truncate">{flag.reason}</td>
                        <td>
                          <Badge color={flag.status === 'RESOLVED' ? 'green' : 'gray'}>
                            {flag.status}
                          </Badge>
                        </td>
                        <td>{flag.resolvedBy ? `${flag.resolvedBy.firstName} ${flag.resolvedBy.lastName}` : '-'}</td>
                        <td className="text-slate-600 dark:text-slate-400">{new Date(flag.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pendingFlags.length === 0 && resolvedFlags.length === 0 && (
            <div className="glass-card flex flex-col items-center justify-center py-16">
              <Flag size={48} className="text-gray-200 dark:text-gray-700 mb-4" />
              <p className="text-slate-600 text-sm">No escalations yet</p>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">When lecturers flag conversations, they will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Resolve Modal */}
      <Modal
        open={resolveModal}
        onClose={() => { setResolveModal(false); setResolvingFlag(null); }}
        title="Resolve Escalation"
      >
        <div className="space-y-4">
          {resolvingFlag && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Reported reason:</p>
              <p className="text-sm text-slate-950 dark:text-white">{resolvingFlag.reason}</p>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300">Resolution note (optional)</label>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Add a note about the action taken..."
              rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={() => handleResolve('RESOLVED')} className="flex-1">
              <CheckCircle size={16} className="mr-1" /> Mark Resolved
            </Button>
            <Button variant="secondary" onClick={() => handleResolve('DISMISSED')} className="flex-1">
              <XCircle size={16} className="mr-1" /> Dismiss
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

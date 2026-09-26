import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../lib/socket';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { MessageSquare, Search, Flag, Reply, User as UserIcon, MessagesSquare, Users2, Bell, BellOff, X } from 'lucide-react';
import { api } from '../../lib/api';
import { RoomChatPanel } from '../../components/chat/RoomChatPanel';
import { ChatComposer } from '../../components/chat/ChatComposer';
import type { Conversation, Message, ContactGroup } from '../../types';

type PageMode = 'direct' | 'rooms';

export function MessagesPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<PageMode>('direct');
  const { data: conversations, refetch: refetchConvos } = useApi<Conversation[]>('/messages/conversations');
  const [selected, setSelected] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const selectedRef = useRef<string>('');

  // Reached from the CEM sidebar's per-programme nav (`/messages?cohortId=...`) — narrows the
  // executives contact list to just that one programme (message.service.ts's getContacts) instead
  // of pooling across every cohort this CEM is assigned to.
  const [searchParams] = useSearchParams();
  const cohortId = searchParams.get('cohortId') || undefined;

  // Contacts loaded automatically
  const [contacts, setContacts] = useState<ContactGroup[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [pendingRecipient, setPendingRecipient] = useState<{ id: string; name: string } | null>(null);
  const [flagModal, setFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(!!cohortId);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const isLecturer = user?.role === 'LECTURER';
  const isCxm = user?.role === 'CLIENT_EXPERIENCE_MANAGER';

  // Keep selectedRef in sync
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = createSocket(token);
    socketRef.current = s;

    // Listen for new messages on user channel
    s.on('message:new', (msg: Message) => {
      // If message is in the currently open conversation, add it to messages
      if (msg.conversationId === selectedRef.current && msg.senderId !== user?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      // Always refresh conversation list for updated previews and unread counts
      refetchConvos();
    });

    // Listen for read receipts
    s.on('message:read', (data: { conversationId: string; readBy: string }) => {
      if (data.readBy !== user?.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.conversationId === data.conversationId && m.senderId === user?.id
              ? { ...m, read: true }
              : m,
          ),
        );
      }
    });

    // Listen for typing indicators
    s.on('typing', (data: { userId: string; conversationId: string }) => {
      if (data.conversationId === selectedRef.current && data.userId !== user?.id) {
        setTypingUser(data.userId);
        // Clear typing indicator after 3 seconds
        setTimeout(() => setTypingUser(null), 3000);
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, refetchConvos]);

  // Join/leave conversation room when selection changes
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    if (selected) {
      s.emit('join:conversation', selected);
    }

    return () => {
      if (selected) {
        // Leave previous conversation room (socket.io handles this on disconnect too)
        setTypingUser(null);
      }
    };
  }, [selected]);

  // Auto-load contacts on mount (and whenever the ?cohortId scope changes)
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const groups = await api.get<ContactGroup[]>(cohortId ? `/messages/contacts?cohortId=${encodeURIComponent(cohortId)}` : '/messages/contacts');
        setContacts(groups);
      } catch { /* ignore */ }
    };
    loadContacts();
  }, [cohortId]);

  // Deduplicate contacts and exclude users who already have conversations
  const existingConvoUserIds = new Set(conversations?.map((c) => c.otherUser.id) || []);
  const filteredContacts = contacts
    .map((g) => ({
      ...g,
      contacts: g.contacts.filter((c) => {
        if (existingConvoUserIds.has(c.id)) return false;
        if (!contactSearch) return true;
        const name = `${c.firstName} ${c.lastName}`.toLowerCase();
        return name.includes(contactSearch.toLowerCase());
      }),
    }))
    .filter((g) => g.contacts.length > 0);

  const toggleMute = async (conversationId: string, currentlyMuted: boolean) => {
    if (currentlyMuted) {
      await api.delete(`/messages/conversations/${conversationId}/mute`);
    } else {
      await api.post(`/messages/conversations/${conversationId}/mute`, {});
    }
    refetchConvos();
  };

  const handleFlag = async () => {
    if (!flagReason.trim() || !selected) return;
    setFlagging(true);
    try {
      await api.post('/messages/flag', {
        conversationId: selected,
        reason: flagReason,
      });
      setFlagModal(false);
      setFlagReason('');
    } catch { /* ignore */ }
    setFlagging(false);
  };

  const loadMessages = async (id: string) => {
    setSelected(id);
    setPendingRecipient(null);
    const msgs = await api.get<Message[]>(`/messages/conversations/${id}`);
    setMessages(msgs);
    refetchConvos();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectContact = (contactId: string, contactName: string) => {
    // Check if conversation already exists with this contact
    const existing = conversations?.find(
      (c) => c.otherUser.id === contactId,
    );
    if (existing) {
      loadMessages(existing.id);
    } else {
      // Set pending recipient for new conversation
      setSelected('');
      setMessages([]);
      setPendingRecipient({ id: contactId, name: contactName });
    }
    setShowContacts(false);
  };

  const send = async () => {
    if (!text.trim()) return;
    const replyToId = replyingTo?.id;

    if (pendingRecipient) {
      // Start new conversation
      const result = await api.post<Message & { conversationId: string }>('/messages/send', {
        recipientId: pendingRecipient.id,
        content: text,
        replyToId,
      });
      setText('');
      setReplyingTo(null);
      setPendingRecipient(null);
      setSelected(result.conversationId);
      refetchConvos();
      loadMessages(result.conversationId);
    } else if (selected) {
      await api.post('/messages/send', { conversationId: selected, content: text, replyToId });
      setText('');
      setReplyingTo(null);
      // Message will arrive via socket, but also load immediately for sender
      const msgs = await api.get<Message[]>(`/messages/conversations/${selected}`);
      setMessages(msgs);
    }
  };

  // Emit typing indicator
  const handleTyping = useCallback(() => {
    if (selected && socketRef.current) {
      socketRef.current.emit('typing', { conversationId: selected });
    }
  }, [selected]);

  const chatTitle = pendingRecipient
    ? pendingRecipient.name
    : conversations?.find((c) => c.id === selected)?.otherUser
      ? `${conversations.find((c) => c.id === selected)!.otherUser.firstName} ${conversations.find((c) => c.id === selected)!.otherUser.lastName}`
      : '';

  // With `cohortId` set, the (single) contacts group getContacts() returns is already named after
  // that cohort (message.service.ts) — reuse it here rather than a second fetch just for a label.
  const scopedCohortName = cohortId ? contacts[0]?.courseName : undefined;

  return (
    <div className="space-y-4">
      {cohortId && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm">
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            Messages for {scopedCohortName ?? 'this programme'}
          </span>
          <Link to="/messages" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
            <X size={14} /> View all programmes
          </Link>
        </div>
      )}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setMode('direct')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            mode === 'direct'
              ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm'
              : 'text-slate-600 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <MessagesSquare size={16} className="inline mr-1.5 -mt-0.5" /> Direct Messages
        </button>
        <button
          onClick={() => setMode('rooms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            mode === 'rooms'
              ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm'
              : 'text-slate-600 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Users2 size={16} className="inline mr-1.5 -mt-0.5" /> Course & Campus Rooms
        </button>
      </div>

      {mode === 'rooms' ? (
        <RoomChatPanel />
      ) : (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <GlassCard className="w-80 flex flex-col overflow-hidden">
        {/* Tab toggle */}
        <div className="flex mb-3 border-b border-gray-200 dark:border-white/10">
          <button
            onClick={() => setShowContacts(false)}
            className={`flex-1 text-sm font-medium py-2 border-b-2 transition-colors cursor-pointer ${
              !showContacts
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setShowContacts(true)}
            className={`flex-1 text-sm font-medium py-2 border-b-2 transition-colors cursor-pointer ${
              showContacts
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isLecturer ? 'My Students' : isCxm ? 'My Executives' : 'My Lecturers'}
          </button>
        </div>

        {!showContacts ? (
          /* Conversations list */
          <div className="flex-1 overflow-y-auto space-y-1">
            {conversations?.map((c) => (
              <button
                key={c.id}
                onClick={() => loadMessages(c.id)}
                className={`w-full text-left px-3 py-3 rounded-xl transition-all cursor-pointer ${
                  selected === c.id ? 'bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-950 dark:text-white flex items-center gap-1.5">
                    {c.otherUser.firstName} {c.otherUser.lastName}
                    {c.isMuted && <BellOff size={12} className="text-slate-400 flex-shrink-0" />}
                  </p>
                  {c.unreadCount > 0 && <Badge color="blue">{c.unreadCount}</Badge>}
                </div>
                {c.lastMessage && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">{c.lastMessage.content}</p>
                )}
              </button>
            ))}
            {(!conversations || conversations.length === 0) && (
              <p className="text-center text-slate-600 dark:text-slate-400 py-8 text-sm">No conversations yet</p>
            )}
          </div>
        ) : (
          /* Contacts list */
          <div className="flex-1 overflow-y-auto">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl pl-9 pr-4 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="space-y-3">
              {filteredContacts.map((group) => (
                <div key={group.courseId}>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 px-2">
                    {group.courseName}
                  </p>
                  <div className="space-y-0.5">
                    {group.contacts.map((c) => (
                      <button
                        key={`${group.courseId}-${c.id}`}
                        onClick={() => selectContact(c.id, `${c.firstName} ${c.lastName}`)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <UserIcon size={14} className="text-blue-500" />
                        </div>
                        <span className="text-sm text-slate-950 dark:text-white truncate">
                          {c.firstName} {c.lastName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredContacts.length === 0 && (
                <p className="text-center text-slate-600 dark:text-slate-400 py-4 text-sm">
                  {contactSearch ? 'No matching contacts' : 'No new contacts to message'}
                </p>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="flex-1 flex flex-col overflow-hidden">
        {selected || pendingRecipient ? (
          <>
            {chatTitle && (
              <div className="pb-3 mb-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{chatTitle}</p>
                  {pendingRecipient && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">New conversation</p>
                  )}
                  {typingUser && !pendingRecipient && (
                    <p className="text-xs text-blue-500 mt-0.5 animate-pulse">Typing...</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selected && !pendingRecipient && (() => {
                    const conv = conversations?.find((c) => c.id === selected);
                    if (!conv) return null;
                    return (
                      <button
                        onClick={() => toggleMute(selected, conv.isMuted)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title={conv.isMuted ? 'Unmute this chat' : 'Mute this chat — stop notifications for new messages'}
                      >
                        {conv.isMuted ? <><BellOff size={14} /> Muted</> : <><Bell size={14} /> Mute</>}
                      </button>
                    );
                  })()}
                  {isLecturer && selected && !pendingRecipient && (
                    <button
                      onClick={() => setFlagModal(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors cursor-pointer"
                      title="Report this conversation to admin"
                    >
                      <Flag size={14} /> Escalate
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {messages.map((m) => {
                const isMine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex group ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {!isMine && (
                      <button
                        onClick={() => setReplyingTo(m)}
                        className="self-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-500 cursor-pointer"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                    )}
                    <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                      isMine
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-white/10 text-slate-950 dark:text-white rounded-bl-md'
                    }`}>
                      {m.replyTo && (
                        <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                          isMine ? 'border-blue-200 bg-white/10 text-blue-100' : 'border-blue-500 bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                        }`}>
                          <p className="font-bold">{m.replyTo.senderName}</p>
                          <p className="truncate">{m.replyTo.content}</p>
                        </div>
                      )}
                      {m.content}
                      <p className={`text-xs mt-1 ${isMine ? 'text-blue-200' : 'text-slate-600 dark:text-slate-400'}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isMine && (
                      <button
                        onClick={() => setReplyingTo(m)}
                        className="self-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-500 cursor-pointer"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              {pendingRecipient && messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-12">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Send a message to start the conversation</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-white/10">
              <ChatComposer
                value={text}
                onChange={setText}
                onSend={send}
                onTyping={handleTyping}
                replyingTo={replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderId === user?.id ? 'yourself' : chatTitle, content: replyingTo.content } : null}
                onCancelReply={() => setReplyingTo(null)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-slate-400 dark:text-gray-600" />
              <p className="text-slate-600">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Flag / Escalation Modal */}
      <Modal open={flagModal} onClose={() => { setFlagModal(false); setFlagReason(''); }} title="Escalate to Admin">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Report this conversation to the admin. Please describe the issue so the admin can review it.
          </p>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-800 dark:text-gray-300">Reason</label>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="e.g. Student not attending classes, inappropriate messages..."
              rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>
          <Button onClick={handleFlag} disabled={!flagReason.trim() || flagging} className="w-full">
            {flagging ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </Modal>

    </div>
      )}
    </div>
  );
}

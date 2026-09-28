import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../ui/GlassCard';
import { api } from '../../lib/api';
import { MessageSquare, Building2, Users, Reply, Bell, BellOff } from 'lucide-react';
import { ChatComposer } from './ChatComposer';
import type { RoomTargets, RoomMessagesResponse, RoomMessage } from '../../types';

type SelectedRoom = { kind: 'course'; id: string; title: string } | { kind: 'school'; id: string; title: string };

/**
 * Course/Campus room chat — mirrors the mobile app's ChatListView/RoomChatView pattern (room list
 * on one side, thread on the other) so lecturers and admins can participate in the same rooms
 * students see, not just moderate them after the fact (that's AdminMessagesPage's job).
 */
export function RoomChatPanel() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<RoomTargets | null>(null);
  const [selected, setSelected] = useState<SelectedRoom | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [isAnonymousEnabled, setIsAnonymousEnabled] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [text, setText] = useState('');
  const [roomConversationId, setRoomConversationId] = useState<string | null>(null);
  const [roomMuted, setRoomMuted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get<RoomTargets>('/messages/rooms').then(setTargets).catch(() => {});
  }, []);

  const loadRoom = async (room: SelectedRoom) => {
    setSelected(room);
    setIsAnonymous(false);
    const path = room.kind === 'course' ? `/messages/room/course/${room.id}` : `/messages/room/school/${room.id}`;
    const response = await api.get<RoomMessagesResponse>(path);
    setMessages(response.messages);
    setIsAnonymousEnabled(response.isAnonymousEnabled);
    setRoomConversationId(response.conversationId);
    setRoomMuted(response.isMuted);
  };

  const toggleRoomMute = async () => {
    if (!roomConversationId) return;
    if (roomMuted) {
      await api.delete(`/messages/conversations/${roomConversationId}/mute`);
    } else {
      await api.post(`/messages/conversations/${roomConversationId}/mute`, {});
    }
    setRoomMuted(!roomMuted);
  };

  // Light polling while a room is open — matches the mobile app's room-refresh cadence rather than
  // wiring a second socket channel just for this panel.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => loadRoom(selected), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.kind, selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [replyingTo, setReplyingTo] = useState<RoomMessage | null>(null);

  const send = async () => {
    if (!text.trim() || !selected) return;
    const replyToId = replyingTo?.id;
    const body =
      selected.kind === 'course'
        ? { courseId: selected.id, content: text, isAnonymous, replyToId }
        : { schoolId: selected.id, content: text, isAnonymous, replyToId };
    await api.post('/messages/send', body);
    setText('');
    setReplyingTo(null);
    await loadRoom(selected);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <GlassCard className="w-80 flex flex-col overflow-hidden">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Rooms</p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {targets?.schoolId && (
            <button
              onClick={() => loadRoom({ kind: 'school', id: targets.schoolId!, title: 'Campus Chat' })}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                selected?.kind === 'school' ? 'bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <Building2 size={15} className="text-blue-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-950 dark:text-white">Campus Chat</span>
            </button>
          )}
          {targets?.courses.map((c) => (
            <button
              key={c.id}
              onClick={() => loadRoom({ kind: 'course', id: c.id, title: `${c.code} Chat` })}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                selected?.kind === 'course' && selected.id === c.id ? 'bg-blue-500/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <Users size={15} className="text-purple-500 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-950 dark:text-white truncate">{c.code} Chat</span>
            </button>
          ))}
          {targets && !targets.schoolId && targets.courses.length === 0 && (
            <p className="text-center text-slate-600 dark:text-slate-400 py-8 text-sm">No rooms available</p>
          )}
        </div>
      </GlassCard>

      <GlassCard className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="pb-3 mb-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{selected.title}</p>
              <button
                onClick={toggleRoomMute}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title={roomMuted ? 'Unmute this room' : 'Mute this room — stop notifications for new messages'}
              >
                {roomMuted ? <><BellOff size={14} /> Muted</> : <><Bell size={14} /> Mute</>}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex group ${m.isMine ? 'justify-end' : 'justify-start'}`}>
                  {!m.isMine && (
                    <button
                      onClick={() => setReplyingTo(m)}
                      className="self-center mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-500 cursor-pointer"
                      title="Reply"
                    >
                      <Reply size={14} />
                    </button>
                  )}
                  <div className="max-w-xs">
                    {/* Bold, higher-contrast sender name — a thin gray caption was hard to tell apart
                        from the next person's in a room with several senders posting one after another. */}
                    <p className={`text-xs mb-1 font-bold ${m.isMine ? 'text-right' : 'text-left'} text-slate-800 dark:text-slate-200`}>
                      {m.isMine ? 'You' : m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : 'Anonymous'}
                    </p>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${
                      m.isMine
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-white/10 text-slate-950 dark:text-white rounded-bl-md'
                    }`}>
                      {m.replyTo && (
                        <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                          m.isMine ? 'border-blue-200 bg-white/10 text-blue-100' : 'border-blue-500 bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                        }`}>
                          <p className="font-bold">{m.replyTo.senderName}</p>
                          <p className="truncate">{m.replyTo.content}</p>
                        </div>
                      )}
                      {m.content}
                    </div>
                  </div>
                  {m.isMine && (
                    <button
                      onClick={() => setReplyingTo(m)}
                      className="self-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-500 cursor-pointer"
                      title="Reply"
                    >
                      <Reply size={14} />
                    </button>
                  )}
                </div>
              ))}
              {messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-12">
                  <p className="text-sm text-slate-600 dark:text-slate-400">No messages yet — say hello</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-white/10">
              <ChatComposer
                value={text}
                onChange={setText}
                onSend={send}
                replyingTo={replyingTo ? { id: replyingTo.id, senderName: replyingTo.isMine ? 'yourself' : (replyingTo.sender ? `${replyingTo.sender.firstName} ${replyingTo.sender.lastName}` : 'Anonymous'), content: replyingTo.content } : null}
                onCancelReply={() => setReplyingTo(null)}
                extra={
                  isAnonymousEnabled ? (
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 px-1 cursor-pointer">
                      <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded border-gray-300 dark:border-white/20" />
                      Post anonymously
                    </label>
                  ) : undefined
                }
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-4 text-slate-400 dark:text-gray-600" />
              <p className="text-slate-600">{user ? 'Select a room to start chatting' : 'Loading…'}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

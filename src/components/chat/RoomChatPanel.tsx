import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../ui/GlassCard';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { Send, MessageSquare, Building2, Users } from 'lucide-react';
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

  const send = async () => {
    if (!text.trim() || !selected) return;
    const body =
      selected.kind === 'course'
        ? { courseId: selected.id, content: text, isAnonymous }
        : { schoolId: selected.id, content: text, isAnonymous };
    await api.post('/messages/send', body);
    setText('');
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
            <div className="pb-3 mb-3 border-b border-gray-200 dark:border-white/10">
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{selected.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-xs">
                    <p className={`text-xs mb-1 ${m.isMine ? 'text-right' : 'text-left'} text-slate-600 dark:text-slate-400`}>
                      {m.isMine ? 'You' : m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : 'Anonymous'}
                    </p>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${
                      m.isMine
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-white/10 text-slate-950 dark:text-white rounded-bl-md'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-12">
                  <p className="text-sm text-slate-600 dark:text-slate-400">No messages yet — say hello</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-white/10 space-y-2">
              {isAnonymousEnabled && (
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 px-1 cursor-pointer">
                  <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded border-gray-300 dark:border-white/20" />
                  Post anonymously
                </label>
              )}
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <Button onClick={send}><Send size={16} /></Button>
              </div>
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

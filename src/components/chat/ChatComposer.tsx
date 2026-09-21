import { useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '../ui/Button';

export interface ReplyPreview {
  id: string;
  senderName: string;
  content: string;
}

/**
 * The message-compose box, shared by direct-message and room chat (MessagesPage, RoomChatPanel).
 * Both used to render this as a single-line `<Input>` (an `<input>`, not a `<textarea>`) — fine
 * for a short message, but a long one just scrolled sideways inside the box instead of wrapping,
 * which reads as the whole composer "sliding" to follow the cursor as you type. An auto-growing
 * textarea (capped, then internally scrollable) keeps the box — and the page around it — put.
 * Enter sends; Shift+Enter inserts a newline, same convention as every other chat app.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onTyping,
  replyingTo,
  onCancelReply,
  placeholder = 'Type a message...',
  extra,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onTyping?: () => void;
  replyingTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  placeholder?: string;
  extra?: React.ReactNode;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to a max height, then let the textarea itself scroll — never the page.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="space-y-2">
      {replyingTo && (
        <div className="flex items-start gap-2 rounded-xl bg-gray-100 dark:bg-white/5 border-l-4 border-blue-500 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Replying to {replyingTo.senderName}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{replyingTo.content}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer flex-shrink-0"
            title="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {extra}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 max-h-32 overflow-y-auto leading-normal"
        />
        <Button onClick={onSend} className="flex-shrink-0"><Send size={16} /></Button>
      </div>
    </div>
  );
}

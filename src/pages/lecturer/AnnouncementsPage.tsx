import { Megaphone, Clock, AlertTriangle, Info, Link as LinkIcon } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import type { Broadcast } from '../../types';

const severityConfig: Record<Broadcast['severity'], { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  INFO: { icon: <Info size={16} className="text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-l-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  WARNING: { icon: <AlertTriangle size={16} className="text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-l-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  CRITICAL: { icon: <AlertTriangle size={16} className="text-red-500" />, bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-l-red-500', text: 'text-red-700 dark:text-red-400' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Read-only announcements feed — lecturers receive, they don't compose (that's the admin page). */
export function AnnouncementsPage() {
  const { data: broadcasts, refetch } = useApi<Broadcast[]>('/broadcasts');
  const { mutate: markRead } = useMutation('post');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone size={22} className="text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Announcements</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Updates from your school and courses.</p>
        </div>
      </div>

      <div className="space-y-3">
        {broadcasts?.map((a) => {
          const cfg = severityConfig[a.severity];
          return (
            <div
              key={a.id}
              className={`glass-card p-4 border-l-4 ${cfg.border} ${a.isRead ? 'opacity-70' : ''}`}
              onClick={() => { if (!a.isRead) { markRead(`/broadcasts/${a.id}/read`).then(() => refetch()); } }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{a.title}</p>
                    {!a.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{a.body}</p>
                  {a.resourceUrl && (
                    <a
                      href={a.resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-500 hover:text-blue-600"
                    >
                      <LinkIcon size={12} /> {a.resourceLabel || a.resourceUrl}
                    </a>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(a.createdAt)}</span>
                    <span>· {a.createdByName}</span>
                    <span>· {a.course ? `${a.course.name} (${a.course.code})` : a.major ? `${a.major.name} (faculty)` : a.school ? a.school.name : 'All Schools'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {broadcasts?.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}

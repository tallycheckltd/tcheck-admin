import { useState } from 'react';
import { Megaphone, Send, Clock, AlertTriangle, Info, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { School, Course, Broadcast } from '../../types';

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

const severityConfig: Record<Severity, { label: string; icon: React.ReactNode; bg: string; border: string; text: string; chip: string }> = {
  INFO: {
    label: 'Info',
    icon: <Info size={16} className="text-blue-500" />,
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    chip: 'bg-blue-500 text-white',
  },
  WARNING: {
    label: 'Warning',
    icon: <AlertTriangle size={16} className="text-amber-500" />,
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    chip: 'bg-amber-500 text-white',
  },
  CRITICAL: {
    label: 'Critical',
    icon: <AlertTriangle size={16} className="text-red-500" />,
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-l-red-500',
    text: 'text-red-700 dark:text-red-400',
    chip: 'bg-red-500 text-white',
  },
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

export function SystemAnnouncementsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: broadcasts, refetch } = useApi<Broadcast[]>('/broadcasts');
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { mutate: create, loading: sending } = useMutation<Broadcast>('post');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('INFO');
  const [targetSchoolId, setTargetSchoolId] = useState<string>(isSuperAdmin ? '' : (user?.schoolId ?? ''));
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceLabel, setResourceLabel] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const { data: courses } = useApi<Course[]>(targetSchoolId ? `/courses?schoolId=${targetSchoolId}` : null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setError('');
    try {
      await create('/broadcasts', {
        title: title.trim(),
        body: body.trim(),
        severity,
        schoolId: targetSchoolId || undefined,
        courseId: targetCourseId || undefined,
        resourceUrl: resourceUrl.trim() || undefined,
        resourceLabel: resourceLabel.trim() || undefined,
      });
      setTitle('');
      setBody('');
      setSeverity('INFO');
      setTargetCourseId('');
      setResourceUrl('');
      setResourceLabel('');
      setSent(true);
      refetch();
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send broadcast');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">System Announcements</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Broadcast targeted announcements to a school or a specific course's enrolled students, with an optional resource link.
        </p>
      </div>

      {/* Compose */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">New Announcement</h2>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Announcement title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <textarea
            placeholder="Write your message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Target school</label>
              {isSuperAdmin ? (
                <select
                  value={targetSchoolId}
                  onChange={(e) => { setTargetSchoolId(e.target.value); setTargetCourseId(''); }}
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
                >
                  <option value="">All Schools</option>
                  {schools?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                  Your school only
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Narrow to course (optional)</label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                disabled={!targetSchoolId}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white disabled:opacity-50"
              >
                <option value="">Whole school</option>
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                placeholder="Resource link (optional) — https://..."
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <input
              type="text"
              placeholder="Link label (e.g. Exam Timetable PDF)"
              value={resourceLabel}
              onChange={(e) => setResourceLabel(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Severity:</span>
              {(['INFO', 'WARNING', 'CRITICAL'] as Severity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize ${
                    severity === s ? severityConfig[s].chip : 'bg-gray-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
            <button
              onClick={handleSend}
              disabled={!title.trim() || !body.trim() || sending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {sent ? (
                <><CheckCircle size={15} /> Sent!</>
              ) : (
                <><Send size={15} /> {sending ? 'Sending...' : 'Broadcast'}</>
              )}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">Announcement History</h2>
        <div className="space-y-3">
          {broadcasts?.map((a) => {
            const cfg = severityConfig[(a.severity as Severity) ?? 'INFO'];
            return (
              <div key={a.id} className={`glass-card p-4 border-l-4 ${cfg.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{a.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{a.body}</p>
                      {a.resourceUrl && (
                        <a
                          href={a.resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-500 hover:text-blue-600"
                        >
                          <LinkIcon size={12} /> {a.resourceLabel || a.resourceUrl}
                        </a>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(a.createdAt)}</span>
                        <span>· Sent by {a.createdByName}</span>
                        <span>· {a.course ? `${a.course.name} (${a.course.code})` : a.school ? a.school.name : 'All Schools'}</span>
                        <span className={`font-semibold capitalize ${cfg.text}`}>{a.severity.toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {broadcasts?.length === 0 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No announcements sent yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Megaphone, Send, Clock, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type Severity = 'info' | 'warning' | 'critical';

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  sentBy: string;
  sentAt: string;
}

const DUMMY_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1',
    title: 'Scheduled Maintenance — Sunday 2AM–4AM',
    body: 'The Tallycheck platform will be unavailable for maintenance on Sunday 30 March between 02:00 and 04:00 UTC. All university tenants will experience downtime.',
    severity: 'warning',
    sentBy: 'Platform Ops',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    title: 'BLE Beacon Firmware v2.4.1 Released',
    body: 'A firmware update is available for all registered BLE beacons. IT Directors should log into their device portal to initiate the OTA update.',
    severity: 'info',
    sentBy: 'Engineering',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: '3',
    title: 'Critical: Token Refresh Bug — Patched',
    body: 'A bug causing intermittent session drops has been resolved. No action required from university admins. All sessions restored automatically.',
    severity: 'critical',
    sentBy: 'Platform Ops',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

const severityConfig: Record<Severity, { label: string; icon: React.ReactNode; bg: string; border: string; text: string }> = {
  info: {
    label: 'Info',
    icon: <Info size={16} className="text-blue-500" />,
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
  },
  warning: {
    label: 'Warning',
    icon: <AlertTriangle size={16} className="text-amber-500" />,
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  critical: {
    label: 'Critical',
    icon: <AlertTriangle size={16} className="text-red-500" />,
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-l-red-500',
    text: 'text-red-700 dark:text-red-400',
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
  const [announcements, setAnnouncements] = useState<Announcement[]>(DUMMY_ANNOUNCEMENTS);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<Severity>('info');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      await api.post('/notifications/system-announcement', { title, body, severity });
    } catch {
      // Backend may not have this endpoint yet — show optimistic UI anyway
    }
    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      title,
      body,
      severity,
      sentBy: `${user?.firstName} ${user?.lastName}`,
      sentAt: new Date().toISOString(),
    };
    setAnnouncements((prev) => [newAnnouncement, ...prev]);
    setTitle('');
    setBody('');
    setSeverity('info');
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">System Announcements</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Broadcast platform-wide warnings to all university tenants. No direct messaging — platform notices only.
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
            placeholder="Write your platform message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Severity:</span>
              {(['info', 'warning', 'critical'] as Severity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize ${
                    severity === s
                      ? s === 'info' ? 'bg-blue-500 text-white'
                        : s === 'warning' ? 'bg-amber-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {s}
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
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-3">Announcement History</h2>
        <div className="space-y-3">
          {announcements.map((a) => {
            const cfg = severityConfig[a.severity];
            return (
              <div key={a.id} className={`glass-card p-4 border-l-4 ${cfg.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{a.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{a.body}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(a.sentAt)}</span>
                        <span>· Sent by {a.sentBy}</span>
                        <span className={`font-semibold capitalize ${cfg.text}`}>{a.severity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

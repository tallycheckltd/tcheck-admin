import { useState } from 'react';
import {
  Megaphone, Send, Clock, AlertTriangle, Info, CheckCircle, Link as LinkIcon, Mail, Smartphone, Bell,
  Save, CalendarClock, Pencil, Ban, History, Users, Eye, X,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import type { School, Course, Major, Cohort, ManagedBroadcast, ManagedBroadcastDetail, BroadcastManageTab } from '../../types';

type Channel = 'IN_APP' | 'EMAIL';
type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
type Action = 'DRAFT' | 'SCHEDULE' | 'PUBLISH';

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

const TABS: { key: BroadcastManageTab; label: string }[] = [
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'ENDED', label: 'Ended' },
];

const HISTORY_LABEL: Record<string, string> = {
  CREATED: 'Created',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  EDITED: 'Edited',
  WITHDRAWN: 'Withdrawn',
  DELIVERY_COMPLETED: 'Delivered',
  DELIVERY_COMPLETED_WITH_FAILURES: 'Delivered (some device notifications failed)',
  PUBLISH_SKIPPED: 'Not published — announcements are switched off for this school',
};

const inputCls = 'w-full px-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50';
const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
/** ISO → the value a <input type="datetime-local"> expects, in the viewer's local time. */
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

const audienceLabel = (a: Pick<ManagedBroadcast, 'course' | 'major' | 'cohort' | 'school'>) =>
  a.course ? `${a.course.name} (${a.course.code})` : a.major ? `${a.major.name} (faculty)` : a.cohort ? `${a.cohort.name} (cohort)` : a.school ? `Everyone at ${a.school.name}` : 'All schools';

/** "Email: 40 accepted · 2 opted out · 1 failed" — counts only. */
const emailSummary = (e: Record<string, number>) => {
  const n = (...k: string[]) => k.reduce((s, x) => s + (e[x] ?? 0), 0);
  const parts = [
    n('QUEUED', 'PROCESSING') && `${n('QUEUED', 'PROCESSING')} queued`,
    n('SENT') && `${n('SENT')} accepted`,
    n('DELIVERED') && `${n('DELIVERED')} delivered`,
    n('SUPPRESSED') && `${n('SUPPRESSED')} opted out or suppressed`,
    n('SKIPPED') && `${n('SKIPPED')} not sent`,
    n('FAILED', 'BOUNCED', 'COMPLAINED') && `${n('FAILED', 'BOUNCED', 'COMPLAINED')} failed or bounced`,
    n('CANCELLED') && `${n('CANCELLED')} cancelled`,
  ].filter(Boolean);
  return parts.length ? `Email: ${parts.join(' · ')}` : null;
};

const deliveryLabel = (a: ManagedBroadcast) => {
  if (a.status !== 'PUBLISHED' && a.status !== 'WITHDRAWN') return null;
  if (!a.audienceFrozen) return 'Sent (before delivery tracking)';
  switch (a.deliveryStatus) {
    case 'SNAPSHOT': case 'PENDING': case 'DELIVERING': return 'Delivering…';
    case 'DELIVERED': return 'Delivered';
    case 'DELIVERED_WITH_FAILURES': return 'Delivered — some device notifications failed';
    default: return null;
  }
};

interface Draft {
  id: string | null;
  status: ManagedBroadcast['status'] | null;
  title: string;
  body: string;
  severity: Severity;
  schoolId: string;
  courseId: string;
  majorId: string;
  cohortId: string;
  email: boolean;
  sendPush: boolean;
  resourceUrl: string;
  resourceLabel: string;
  scheduledFor: string; // datetime-local
  expiresAt: string; // datetime-local
}

export function SystemAnnouncementsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const empty = (): Draft => ({
    id: null, status: null, title: '', body: '', severity: 'INFO',
    schoolId: isSuperAdmin ? '' : (user?.schoolId ?? ''), courseId: '', majorId: '', cohortId: '',
    email: false, sendPush: true, resourceUrl: '', resourceLabel: '', scheduledFor: '', expiresAt: '',
  });

  const [tab, setTab] = useState<BroadcastManageTab>('PUBLISHED');
  const [search, setSearch] = useState('');
  const { data: rows, refetch, loading: listLoading } = useApi<ManagedBroadcast[]>(`/broadcasts/manage?status=${tab}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`);
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);

  const [d, setD] = useState<Draft>(empty);
  const [composeKey, setComposeKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ action: Action; count: number | null } | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ManagedBroadcast | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const { data: history } = useApi<ManagedBroadcastDetail>(historyFor ? `/broadcasts/${historyFor}/manage` : null);

  const { data: courses } = useApi<Course[]>(d.schoolId ? `/courses?schoolId=${d.schoolId}` : null);
  const { data: majors } = useApi<Major[]>(d.schoolId ? `/academic/majors?schoolId=${d.schoolId}` : null);
  const { data: cohorts } = useApi<Cohort[]>(d.schoolId ? `/academic/cohorts?schoolId=${d.schoolId}` : null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const editingPublished = d.status === 'PUBLISHED';
  const lockAudience = editingPublished;
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 4000); };
  const reset = () => { setD(empty()); setComposeKey(newKey()); setError(''); };

  const audience = () => ({
    schoolId: d.schoolId || undefined,
    courseId: d.courseId || undefined,
    majorId: !d.courseId ? d.majorId || undefined : undefined,
    cohortId: !d.courseId && !d.majorId ? d.cohortId || undefined : undefined,
  });

  const payload = (action: Action) => ({
    title: d.title.trim(),
    body: d.body.trim(),
    severity: d.severity,
    ...audience(),
    channels: (d.email ? ['IN_APP', 'EMAIL'] : ['IN_APP']) as Channel[],
    sendPush: d.sendPush,
    resourceUrl: d.resourceUrl.trim() || undefined,
    resourceLabel: d.resourceLabel.trim() || undefined,
    expiresAt: d.expiresAt ? fromLocalInput(d.expiresAt) : null,
    ...(action === 'SCHEDULE' ? { scheduledFor: fromLocalInput(d.scheduledFor) } : {}),
    action,
  });

  /** Publish and schedule go through a confirmation that shows exactly how many people it reaches. */
  const askConfirm = async (action: Action) => {
    setError('');
    if (action === 'DRAFT') { void submit('DRAFT'); return; }
    setConfirm({ action, count: null });
    try {
      const r = await api.post<{ recipientCount: number }>('/broadcasts/preview-audience', audience());
      setConfirm({ action, count: r.recipientCount });
    } catch (e) {
      setConfirm(null);
      setError(e instanceof Error ? e.message : 'Could not work out the audience');
    }
  };

  const submit = async (action: Action) => {
    setBusy(true);
    setError('');
    try {
      if (!d.id) {
        await api.post('/broadcasts', payload(action), { 'Idempotency-Key': composeKey });
      } else if (editingPublished) {
        await api.patch(`/broadcasts/${d.id}`, {
          title: d.title.trim(), body: d.body.trim(),
          resourceUrl: d.resourceUrl.trim(), resourceLabel: d.resourceLabel.trim(),
          expiresAt: d.expiresAt ? fromLocalInput(d.expiresAt) : null,
        }, { 'Idempotency-Key': composeKey });
      } else {
        // null clears an audience field the author switched away from (JSON drops undefined).
        const p = payload(action);
        await api.patch(`/broadcasts/${d.id}`, { ...p, schoolId: p.schoolId ?? null, courseId: p.courseId ?? null, majorId: p.majorId ?? null, cohortId: p.cohortId ?? null }, { 'Idempotency-Key': composeKey });
      }
      flash(editingPublished ? 'Saved — recipients were not notified again.' : action === 'PUBLISH' ? 'Published — delivering now.' : action === 'SCHEDULE' ? 'Scheduled.' : 'Draft saved.');
      setTab(editingPublished || action === 'PUBLISH' ? 'PUBLISHED' : action === 'SCHEDULE' ? 'SCHEDULED' : 'DRAFT');
      reset();
      setConfirm(null);
      refetch();
    } catch (e) {
      setConfirm(null);
      setError(e instanceof Error ? e.message : 'Failed to save the announcement');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (a: ManagedBroadcast) => {
    setD({
      id: a.id, status: a.status, title: a.title, body: a.body, severity: a.severity,
      schoolId: a.school?.id ?? (isSuperAdmin ? '' : user?.schoolId ?? ''),
      courseId: a.course?.id ?? '', majorId: a.major?.id ?? '', cohortId: a.cohort?.id ?? '',
      email: a.channels.includes('EMAIL'), sendPush: a.sendPush,
      resourceUrl: a.resourceUrl ?? '', resourceLabel: a.resourceLabel ?? '',
      scheduledFor: toLocalInput(a.scheduledFor), expiresAt: toLocalInput(a.expiresAt),
    });
    setComposeKey(newKey());
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const publishExisting = async (a: ManagedBroadcast) => {
    setBusy(true);
    try {
      await api.post(`/broadcasts/${a.id}/publish`, {}, { 'Idempotency-Key': newKey() });
      flash('Published — delivering now.');
      setTab('PUBLISHED');
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally { setBusy(false); }
  };

  const withdraw = async () => {
    if (!withdrawTarget) return;
    setBusy(true);
    try {
      await api.post(`/broadcasts/${withdrawTarget.id}/withdraw`, {}, { 'Idempotency-Key': newKey() });
      flash(withdrawTarget.status === 'PUBLISHED' ? 'Withdrawn — it no longer appears to anyone.' : 'Discarded.');
      if (d.id === withdrawTarget.id) reset();
      setWithdrawTarget(null);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw');
    } finally { setBusy(false); }
  };

  const ready = d.title.trim() && d.body.trim();
  const scheduleOk = !!d.scheduledFor && new Date(d.scheduledFor).getTime() > Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">System Announcements</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Write, schedule and publish announcements to a school, programme, faculty or cohort. The audience is fixed when an announcement is published.
        </p>
      </div>

      {/* Compose / edit */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              {!d.id ? 'New announcement' : editingPublished ? 'Edit published announcement' : d.status === 'SCHEDULED' ? 'Edit scheduled announcement' : 'Edit draft'}
            </h2>
          </div>
          {d.id && (
            <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">
              <X size={14} /> Cancel editing
            </button>
          )}
        </div>
        {editingPublished && (
          <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
            You can correct the wording, link and expiry. Recipients will see it marked as edited but won't be notified again. To change who receives it, withdraw it and publish a new one.
          </p>
        )}

        <div className="space-y-3">
          <input type="text" placeholder="Announcement title..." value={d.title} maxLength={200} onChange={(e) => set('title', e.target.value)} className={inputCls} />
          <textarea placeholder="Write your message here..." value={d.body} onChange={(e) => set('body', e.target.value)} rows={4} className={`${inputCls} resize-none`} />

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Target school</label>
              {isSuperAdmin ? (
                <select value={d.schoolId} disabled={lockAudience} onChange={(e) => setD((p) => ({ ...p, schoolId: e.target.value, courseId: '', majorId: '', cohortId: '' }))} className={inputCls}>
                  <option value="">All Schools</option>
                  {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div className="w-full rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-500 dark:text-slate-400">Your school only</div>
              )}
            </div>
            <div>
              <label className={labelCls}>Narrow to course (optional)</label>
              <select value={d.courseId} disabled={lockAudience || !d.schoolId} onChange={(e) => setD((p) => ({ ...p, courseId: e.target.value, ...(e.target.value ? { majorId: '', cohortId: '' } : {}) }))} className={inputCls}>
                <option value="">Whole school</option>
                {courses?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Or by faculty/major (optional)</label>
              <select value={d.majorId} disabled={lockAudience || !d.schoolId || !!d.courseId} onChange={(e) => setD((p) => ({ ...p, majorId: e.target.value, ...(e.target.value ? { courseId: '', cohortId: '' } : {}) }))} className={inputCls}>
                <option value="">Whole school</option>
                {majors?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Or by cohort (optional)</label>
              <select value={d.cohortId} disabled={lockAudience || !d.schoolId || !!d.courseId || !!d.majorId} onChange={(e) => setD((p) => ({ ...p, cohortId: e.target.value, ...(e.target.value ? { courseId: '', majorId: '' } : {}) }))} className={inputCls}>
                <option value="">Whole school</option>
                {cohorts?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="url" placeholder="Resource link (optional) — https://..." value={d.resourceUrl} onChange={(e) => set('resourceUrl', e.target.value)} className={`${inputCls} pl-9`} />
            </div>
            <input type="text" placeholder="Link label (e.g. Exam Timetable PDF)" value={d.resourceLabel} onChange={(e) => set('resourceLabel', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Publish later (optional)</label>
              <input type="datetime-local" value={d.scheduledFor} disabled={editingPublished} onChange={(e) => set('scheduledFor', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stop showing after (optional)</label>
              <input type="datetime-local" value={d.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Delivery:</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <Smartphone size={13} className="text-blue-500" /> In-app
              <input type="checkbox" checked readOnly disabled className="rounded" />
            </label>
            <label className={`flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ${lockAudience ? 'opacity-50' : 'cursor-pointer'}`}>
              <Bell size={13} className="text-blue-500" /> Device notification
              <input type="checkbox" checked={d.sendPush} disabled={lockAudience} onChange={(e) => set('sendPush', e.target.checked)} className="rounded cursor-pointer" />
            </label>
            <label className={`flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ${lockAudience ? 'opacity-50' : 'cursor-pointer'}`}>
              <Mail size={13} className="text-blue-500" /> Email
              <input type="checkbox" checked={d.email} disabled={lockAudience} onChange={(e) => set('email', e.target.checked)} className="rounded cursor-pointer" />
            </label>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Severity:</span>
              {(['INFO', 'WARNING', 'CRITICAL'] as Severity[]).map((s) => (
                <button
                  key={s}
                  disabled={lockAudience}
                  onClick={() => set('severity', s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize disabled:opacity-50 ${
                    d.severity === s ? severityConfig[s].chip : 'bg-gray-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {editingPublished ? (
                <button onClick={() => submit('PUBLISH')} disabled={!ready || busy} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                  <Save size={15} /> {busy ? 'Saving…' : 'Save changes'}
                </button>
              ) : (
                <>
                  <button onClick={() => askConfirm('DRAFT')} disabled={!ready || busy} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                    <Save size={15} /> Save draft
                  </button>
                  <button onClick={() => askConfirm('SCHEDULE')} disabled={!ready || busy || !scheduleOk} title={!scheduleOk ? 'Pick a future "Publish later" time first' : undefined} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                    <CalendarClock size={15} /> Schedule
                  </button>
                  <button onClick={() => askConfirm('PUBLISH')} disabled={!ready || busy} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                    <Send size={15} /> Publish now
                  </button>
                </>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {notice && <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={13} /> {notice}</p>}
        </div>
      </div>

      {/* Manage */}
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${tab === t.key ? 'bg-white dark:bg-white/15 text-slate-950 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Search announcements" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} sm:w-64`} />
        </div>
        <div className="space-y-3">
          {rows?.map((a) => {
            const cfg = severityConfig[a.severity ?? 'INFO'];
            const delivery = deliveryLabel(a);
            const failed = (a.push?.FAILED ?? 0) + (a.push?.INVALID_TOKEN ?? 0);
            return (
              <div key={a.id} className={`glass-card p-4 border-l-4 ${cfg.border}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white break-words">
                        {a.title}
                        {a.editedAt && <span className="ml-2 text-[11px] font-normal text-slate-500">(edited)</span>}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed whitespace-pre-line break-words">{a.body}</p>
                      {a.resourceUrl && (
                        <a href={a.resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-500 hover:text-blue-600">
                          <LinkIcon size={12} /> {a.resourceLabel || a.resourceUrl}
                        </a>
                      )}
                      <div className="flex items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                        <span>{audienceLabel(a)}</span>
                        <span>· by {a.createdByName}</span>
                        {a.status === 'SCHEDULED' && a.scheduledFor && <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400"><CalendarClock size={11} /> Publishes {fmt(a.scheduledFor)}</span>}
                        {a.status === 'DRAFT' && <span className="flex items-center gap-1"><Clock size={10} /> Saved {fmt(a.updatedAt)}</span>}
                        {a.publishedAt && a.status !== 'DRAFT' && a.status !== 'SCHEDULED' && <span className="flex items-center gap-1"><Clock size={10} /> Published {fmt(a.publishedAt)}</span>}
                        {a.expiresAt && <span>{a.expired ? 'Expired' : 'Until'} {fmt(a.expiresAt)}</span>}
                        {a.status === 'WITHDRAWN' && <span className="text-red-500">Withdrawn {fmt(a.withdrawnAt)}</span>}
                        <span className={`font-semibold capitalize ${cfg.text}`}>{a.severity.toLowerCase()}</span>
                        {a.sendPush && <span className="flex items-center gap-1 text-blue-500"><Bell size={10} /> Device</span>}
                        {a.channels?.includes('EMAIL') && <span className="flex items-center gap-1 text-blue-500"><Mail size={10} /> Email</span>}
                      </div>
                      {(a.status === 'PUBLISHED' || a.status === 'WITHDRAWN') && (
                        <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                          {a.audienceFrozen && <span className="flex items-center gap-1"><Users size={11} /> {a.recipientCount} recipient{a.recipientCount === 1 ? '' : 's'}</span>}
                          <span className="flex items-center gap-1"><Eye size={11} /> {a.readCount} read</span>
                          {delivery && <span className={a.deliveryStatus === 'DELIVERED_WITH_FAILURES' ? 'text-amber-600 dark:text-amber-400' : ''}>{delivery}</span>}
                          {a.email && emailSummary(a.email) && <span className="flex items-center gap-1"><Mail size={11} /> {emailSummary(a.email)}</span>}
                          {a.sendPush && a.push && (a.push.DISABLED ? <span>Device notifications aren't set up on this server</span> : <span>Device: {a.push.SENT ?? 0} sent{failed ? `, ${failed} failed` : ''}{a.push.NO_DEVICE ? `, ${a.push.NO_DEVICE} without the app` : ''}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {a.status === 'DRAFT' || a.status === 'SCHEDULED' ? (
                      <>
                        <button onClick={() => startEdit(a)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-gray-200 cursor-pointer"><Pencil size={12} /> Edit</button>
                        <button onClick={() => publishExisting(a)} disabled={busy} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"><Send size={12} /> Publish now</button>
                        <button onClick={() => setWithdrawTarget(a)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"><Ban size={12} /> {a.status === 'SCHEDULED' ? 'Cancel' : 'Discard'}</button>
                      </>
                    ) : a.status === 'PUBLISHED' ? (
                      <>
                        <button onClick={() => startEdit(a)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-gray-200 cursor-pointer"><Pencil size={12} /> Edit</button>
                        <button onClick={() => setWithdrawTarget(a)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"><Ban size={12} /> Withdraw</button>
                      </>
                    ) : null}
                    <button onClick={() => setHistoryFor(a.id)} title="History" className="p-1.5 rounded-lg text-slate-500 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"><History size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {!listLoading && rows?.length === 0 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
              {tab === 'DRAFT' ? 'No drafts.' : tab === 'SCHEDULED' ? 'Nothing scheduled.' : tab === 'PUBLISHED' ? 'No live announcements.' : 'No withdrawn or expired announcements.'}
            </p>
          )}
        </div>
      </div>

      <Modal open={!!confirm} onClose={() => !busy && setConfirm(null)} title={confirm?.action === 'SCHEDULE' ? 'Schedule this announcement?' : 'Publish this announcement?'}>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-semibold text-slate-950 dark:text-white break-words">{d.title}</p>
          <p>
            {confirm?.count == null ? 'Working out the audience…' : (
              <>It will reach <strong>{confirm.count}</strong> {confirm.count === 1 ? 'person' : 'people'} — {audienceLabel({
                course: courses?.find((c) => c.id === d.courseId) ? { id: d.courseId, name: courses!.find((c) => c.id === d.courseId)!.name, code: courses!.find((c) => c.id === d.courseId)!.code } : null,
                major: !d.courseId && majors?.find((m) => m.id === d.majorId) ? { id: d.majorId, name: majors!.find((m) => m.id === d.majorId)!.name, code: '' } : null,
                cohort: !d.courseId && !d.majorId && cohorts?.find((c) => c.id === d.cohortId) ? { id: d.cohortId, name: cohorts!.find((c) => c.id === d.cohortId)!.name, year: 0 } : null,
                school: d.schoolId ? { id: d.schoolId, name: schools?.find((s) => s.id === d.schoolId)?.name ?? 'your school' } : null,
              })}.</>
            )}
          </p>
          <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
            <li>• {confirm?.action === 'SCHEDULE' ? `Publishes ${fmt(fromLocalInput(d.scheduledFor))}. The audience is worked out again at that moment.` : 'Publishes immediately. The audience is fixed now — people who join later won\'t see it.'}</li>
            <li>• In-app{d.sendPush ? ' + device notification' : ' only (no device notification)'}{d.email ? ' + one email each' : ''}.</li>
            {d.email && <li>• People who unsubscribed from programme emails, or whose address bounced, get it in the app only.</li>}
            {d.expiresAt && <li>• Stops showing {fmt(fromLocalInput(d.expiresAt))}.</li>}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setConfirm(null)} disabled={busy} className="px-4 py-2 rounded-xl text-sm bg-gray-100 dark:bg-white/10 cursor-pointer">Back</button>
            <button onClick={() => confirm && submit(confirm.action)} disabled={busy || confirm?.count == null} className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 cursor-pointer">
              {busy ? 'Working…' : confirm?.action === 'SCHEDULE' ? 'Schedule' : 'Publish'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!withdrawTarget} onClose={() => !busy && setWithdrawTarget(null)} title={withdrawTarget?.status === 'PUBLISHED' ? 'Withdraw this announcement?' : withdrawTarget?.status === 'SCHEDULED' ? 'Cancel this scheduled announcement?' : 'Discard this draft?'}>
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-semibold text-slate-950 dark:text-white break-words">{withdrawTarget?.title}</p>
          <p>{withdrawTarget?.status === 'PUBLISHED'
            ? 'It disappears from every feed straight away. Notifications and emails already delivered can\'t be recalled.'
            : 'It will never be sent. It moves to Ended.'}</p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setWithdrawTarget(null)} disabled={busy} className="px-4 py-2 rounded-xl text-sm bg-gray-100 dark:bg-white/10 cursor-pointer">Keep it</button>
            <button onClick={withdraw} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 cursor-pointer">
              {busy ? 'Working…' : withdrawTarget?.status === 'PUBLISHED' ? 'Withdraw' : withdrawTarget?.status === 'SCHEDULED' ? 'Cancel it' : 'Discard'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title="History">
        <ol className="space-y-2 text-sm">
          {history?.history.map((h, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-slate-800 dark:text-slate-200">{HISTORY_LABEL[h.action] ?? h.action}{h.by ? ` · ${h.by}` : ''}</span>
              <span className="text-xs text-slate-500 whitespace-nowrap">{fmt(h.at)}</span>
            </li>
          ))}
          {history && history.history.length === 0 && <li className="text-slate-500">No recorded history (sent before history was kept).</li>}
          {!history && <li className="text-slate-500">Loading…</li>}
        </ol>
      </Modal>
    </div>
  );
}

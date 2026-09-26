import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Loader2, Lock, RefreshCw, UploadCloud, XCircle } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { api } from '../../lib/api';
import type { Course, MoodleConnectionState, MoodleOverview, MoodleSyncIssue, MoodleSyncRun } from '../../types';

/**
 * SBS Phase 7 — Moodle integration centre. Everything here comes from
 * GET /integrations/connections/:id/moodle; the token never reaches the browser.
 * Rules shown to the admin match the server: enrolments flow Moodle → TCheck and are only ever
 * added; attendance write-back is opt-in, writes P/L only and never overwrites a Moodle mark.
 */

const STATE: Record<MoodleConnectionState, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral'; hint: string }> = {
  NOT_CONFIGURED: { label: 'Not configured', tone: 'neutral', hint: 'Add the Moodle address and a web-service token to connect.' },
  NEVER_SYNCED: { label: 'Connected — not synchronised yet', tone: 'neutral', hint: 'Run a roster sync to link courses and delegates.' },
  SYNCING: { label: 'Synchronisation in progress', tone: 'neutral', hint: 'This page updates as it runs.' },
  CONNECTED: { label: 'Connected', tone: 'ok', hint: 'The last roster sync completed without issues.' },
  COMPLETED_WITH_ISSUES: { label: 'Completed with issues', tone: 'warn', hint: 'Some records need review before they can be synchronised.' },
  AUTH_FAILED: { label: 'Authentication failed', tone: 'bad', hint: 'Moodle rejected the token. Issue a new token and reconnect.' },
  UNAVAILABLE: { label: 'Moodle unavailable', tone: 'bad', hint: 'Moodle could not be reached. TCheck keeps working; the next sync will retry.' },
  FAILED: { label: 'Last sync failed', tone: 'bad', hint: 'See the run history for the reason.' },
};
const RUN_STATUS: Record<MoodleSyncRun['status'], string> = { RUNNING: 'Running', COMPLETED: 'Completed', COMPLETED_WITH_ISSUES: 'Completed with issues', FAILED: 'Failed' };
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const host = (url: string) => { try { return new URL(url).host; } catch { return url; } };

function StateLine({ state }: { state: MoodleConnectionState }) {
  const s = STATE[state];
  const Icon = s.tone === 'ok' ? CheckCircle2 : s.tone === 'warn' ? AlertTriangle : s.tone === 'bad' ? XCircle : state === 'SYNCING' ? Loader2 : RefreshCw;
  return (
    <div className="flex items-start gap-2">
      <Icon size={18} aria-hidden className={clsx('mt-0.5 shrink-0', state === 'SYNCING' && 'animate-spin', s.tone === 'ok' ? 'text-emerald-600' : s.tone === 'warn' ? 'text-amber-600' : s.tone === 'bad' ? 'text-red-600' : 'text-slate-500')} />
      <div>
        <p className="text-base font-semibold text-slate-950 dark:text-white">{s.label}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{s.hint}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function runSummary(r: MoodleSyncRun): string {
  const c = r.counts ?? {};
  if (r.status === 'FAILED') return r.errorMessage ?? 'Failed';
  if (r.kind === 'ROSTER') {
    return `${c.coursesMatched ?? 0} of ${c.coursesInMoodle ?? 0} courses linked · ${c.delegatesMatched ?? 0} of ${c.delegatesExamined ?? 0} delegates matched · ${c.enrolmentsCreated ?? 0} enrolments added${c.delegatesNeedReview ? ` · ${c.delegatesNeedReview} need review` : ''}${c.failed ? ` · ${c.failed} failed` : ''}`;
  }
  return `${c.written ?? 0} marks written · ${c.skippedAlreadyMarked ?? 0} already marked in Moodle${c.skippedNotLinked ? ` · ${c.skippedNotLinked} not linked` : ''}${c.sessionsNeedReview ? ` · ${c.sessionsNeedReview} sessions need review` : ''}${c.failed ? ` · ${c.failed} failed` : ''}`;
}

function progressText(r: MoodleSyncRun): string {
  const c = r.counts ?? {};
  if (r.kind === 'ROSTER' && c.coursesMatched) return `Synchronising enrolments — ${c.coursesProcessed ?? 0} of ${c.coursesMatched} courses`;
  if (r.kind === 'ATTENDANCE_EXPORT' && c.written !== undefined) return `Writing attendance — ${c.written} written so far`;
  return 'Synchronisation in progress';
}

function Confirm({ title, body, action, onCancel, onConfirm, busy }: { title: string; body: React.ReactNode; action: string; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="moodle-confirm" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xl">
        <h3 id="moodle-confirm" className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">{body}</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} autoFocus className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer">{busy ? 'Starting…' : action}</button>
        </div>
      </div>
    </div>
  );
}

function LinkDelegate({ connectionId, issue, onDone }: { connectionId: string; issue: MoodleSyncIssue; onDone: () => void }) {
  const [q, setQ] = useState(issue.email ?? '');
  const [results, setResults] = useState<{ id: string; firstName: string; lastName: string; email: string; studentId?: string | null }[]>([]);
  const [err, setErr] = useState('');
  const search = async () => {
    setErr('');
    try { setResults(await api.get(`/users?role=STUDENT&search=${encodeURIComponent(q.trim())}`)); } catch (e) { setErr(e instanceof Error ? e.message : 'Search failed'); }
  };
  const link = async (userId: string) => {
    setErr('');
    try { await api.post(`/integrations/connections/${connectionId}/moodle/link-user`, { moodleUserId: issue.moodleUserId, userId }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not link'); }
  };
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input aria-label="Search TCheck delegates" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10" />
        <button type="button" onClick={() => void search()} disabled={q.trim().length < 2} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-white/10 cursor-pointer disabled:opacity-50">Search</button>
      </div>
      {results.slice(0, 8).map((u) => (
        <div key={u.id} className="flex items-center justify-between text-sm">
          <span>{u.firstName} {u.lastName} <span className="text-slate-500">{u.email}{u.studentId ? ` · ${u.studentId}` : ''}</span></span>
          <button type="button" onClick={() => void link(u.id)} className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer">Link</button>
        </div>
      ))}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

function LinkCourse({ connectionId, issue, courses, onDone }: { connectionId: string; issue: MoodleSyncIssue; courses: Course[]; onDone: () => void }) {
  const [courseId, setCourseId] = useState('');
  const [err, setErr] = useState('');
  const link = async () => {
    setErr('');
    try { await api.post(`/integrations/connections/${connectionId}/map-course`, { externalId: String(issue.moodleCourseId), courseId }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not link'); }
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2 items-center">
      <select aria-label="TCheck course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10">
        <option value="">Choose the matching TCheck course…</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
      </select>
      <button type="button" onClick={() => void link()} disabled={!courseId} className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer disabled:opacity-50">Link</button>
      {err && <p role="alert" className="text-sm text-red-600 w-full">{err}</p>}
    </div>
  );
}

const ISSUE_LABEL: Record<string, string> = {
  COURSE_UNMATCHED: 'Course not linked', COURSE_AMBIGUOUS: 'Course matches more than one', COURSE_FETCH_FAILED: 'Course could not be read',
  DELEGATE_UNMATCHED: 'Delegate not matched', DELEGATE_AMBIGUOUS: 'Delegate needs a decision',
  SESSION_UNMATCHED: 'No Moodle session found', SESSION_AMBIGUOUS: 'Several Moodle sessions match', SESSION_FETCH_FAILED: 'Moodle session unreadable',
  DELEGATE_NOT_LINKED: 'Delegates not linked', STATUS_MISSING: 'Moodle statuses missing', WRITE_FAILED: 'Mark not accepted',
};

function Review({ title, review, connectionId, courses, onChanged }: { title: string; review: MoodleOverview['roster']['review']; connectionId: string; courses: Course[]; onChanged: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'delegates' | 'courses'>('all');
  if (!review || review.issues.length === 0) return null;
  const items = review.issues.filter((i) => filter === 'all' || (filter === 'delegates' ? i.type.startsWith('DELEGATE') : i.type.startsWith('COURSE')));
  return (
    <section aria-labelledby={`${title}-review`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 id={`${title}-review`} className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title} — requires attention ({review.total})</h3>
        <div className="flex gap-1 text-xs" role="group" aria-label="Filter">
          {(['all', 'delegates', 'courses'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={clsx('px-2 py-1 rounded-md cursor-pointer', filter === f ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300')}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-white/10">
        {items.slice(0, 60).map((i, idx) => (
          <li key={idx} className="py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ISSUE_LABEL[i.type] ?? i.type}{i.name ? ` — ${i.name}` : i.courseCode ? ` — ${i.courseCode}` : ''}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{i.message}{i.email ? ` · ${i.email}` : ''}{i.classTitle ? ` · ${i.classTitle}` : ''}{i.date ? ` · ${i.date}` : ''}</p>
              </div>
              {(i.type.startsWith('DELEGATE_UN') || i.type === 'DELEGATE_AMBIGUOUS' || i.type === 'COURSE_UNMATCHED' || i.type === 'COURSE_AMBIGUOUS') && (
                <button type="button" onClick={() => setOpen(open === idx ? null : idx)} className="text-sm font-medium text-blue-600 dark:text-blue-400 shrink-0 cursor-pointer" aria-expanded={open === idx}>Resolve</button>
              )}
            </div>
            {open === idx && i.moodleUserId && i.type.startsWith('DELEGATE') && <LinkDelegate connectionId={connectionId} issue={i} onDone={() => { setOpen(null); onChanged(); }} />}
            {open === idx && i.moodleCourseId && i.type.startsWith('COURSE') && <LinkCourse connectionId={connectionId} issue={i} courses={courses} onDone={() => { setOpen(null); onChanged(); }} />}
          </li>
        ))}
      </ul>
      {review.total > review.issues.length && <p className="text-xs text-slate-500">Showing the first {review.issues.length} of {review.total}. Resolve these and sync again to see the rest.</p>}
      <p className="text-xs text-slate-500">Linking a delegate or course takes effect on the next sync.</p>
    </section>
  );
}

export function MoodleCentre({ connectionId, courses }: { connectionId: string; courses: Course[] }) {
  const { data: o, refetch, error } = useApi<MoodleOverview>(`/integrations/connections/${connectionId}/moodle`);
  const { mutate: post, loading: starting } = useMutation('post');
  const { mutate: patch, loading: saving } = useMutation('patch');
  const [confirm, setConfirm] = useState<'roster' | 'attendance' | 'writeback-on' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activityDraft, setActivityDraft] = useState<Record<string, string>>({});

  // Follow a running sync until it finishes — the only polling here, and only while it runs.
  useEffect(() => {
    if (!o?.running) return;
    const t = window.setInterval(() => void refetch({ silent: true }), 3000);
    return () => window.clearInterval(t);
  }, [o?.running, refetch]);

  const courseList = useMemo(() => courses.slice().sort((a, b) => a.code.localeCompare(b.code)), [courses]);
  if (error) return <p role="alert" className="text-sm text-red-600">The Moodle integration status could not be loaded. {error}</p>;
  if (!o) return <p className="text-sm text-slate-500">Loading Moodle integration…</p>;

  const start = async (kind: 'roster' | 'attendance') => {
    setMsg(null);
    try {
      await post(`/integrations/connections/${connectionId}/${kind === 'roster' ? 'sync-roster' : 'export-attendance'}`, {});
      setMsg({ ok: true, text: kind === 'roster' ? 'Roster sync started.' : 'Attendance write-back started.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not start the synchronisation' });
    }
    setConfirm(null);
    await refetch({ silent: true });
  };
  const saveSettings = async (body: Record<string, unknown>, ok: string) => {
    setMsg(null);
    try { await patch(`/integrations/connections/${connectionId}/moodle/settings`, body); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' }); }
    setConfirm(null);
    await refetch({ silent: true });
  };

  const lastRoster = o.roster.lastSuccessful;
  return (
    <section aria-labelledby="moodle-centre" className="glass-card p-6 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p id="moodle-centre" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Moodle · {host(o.baseUrl)}</p>
          <StateLine state={o.state} />
          {o.running && <p className="text-sm text-slate-700 dark:text-slate-300" aria-live="polite">{progressText(o.running)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirm('roster')} disabled={!!o.running || !o.isActive} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer">
            <RefreshCw size={15} aria-hidden /> Sync roster now
          </button>
          {o.attendanceWriteBack && (
            <button type="button" onClick={() => setConfirm('attendance')} disabled={!!o.running} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-white/10 text-slate-800 dark:text-slate-200 disabled:opacity-50 cursor-pointer">
              <UploadCloud size={15} aria-hidden /> Write attendance now
            </button>
          )}
        </div>
      </div>
      {msg && <p role="status" className={clsx('text-sm', msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>{msg.text}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <Stat label="Linked courses" value={o.totals.mappedCourses} />
        <Stat label="Linked delegates" value={o.totals.linkedDelegates} />
        <Stat label="Enrolments in linked courses" value={o.totals.enrolmentsInMappedCourses} />
        <Stat label="Attendance marks written" value={o.totals.attendanceMarksWritten} />
      </div>

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm">
        <div><dt className="text-slate-500 dark:text-slate-400">Last successful roster sync</dt><dd className="text-slate-900 dark:text-slate-100">{when(lastRoster?.finishedAt)}{lastRoster ? ` · ${runSummary(lastRoster)}` : ''}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Last attempted</dt><dd className="text-slate-900 dark:text-slate-100">{o.roster.lastAttempted ? `${when(o.roster.lastAttempted.startedAt)} · ${RUN_STATUS[o.roster.lastAttempted.status]}` : '—'}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Schedule</dt><dd className="text-slate-900 dark:text-slate-100">Roster every 6 hours{o.attendanceWriteBack ? ' · attendance daily' : ''}, plus manual syncs</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Direction</dt><dd className="text-slate-900 dark:text-slate-100">Enrolments Moodle → TCheck (added only, never removed){o.attendanceWriteBack ? ' · attendance TCheck → Moodle' : ''}</dd></div>
      </dl>

      <Review title="Roster" review={o.roster.review} connectionId={connectionId} courses={courseList} onChanged={() => void refetch({ silent: true })} />
      <Review title="Attendance write-back" review={o.attendance.review} connectionId={connectionId} courses={courseList} onChanged={() => void refetch({ silent: true })} />

      <section aria-labelledby="writeback" className="space-y-3">
        <h3 id="writeback" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Attendance write-back</h3>
        <label className="flex items-start gap-3 text-sm text-slate-800 dark:text-slate-200">
          <input type="checkbox" checked={o.attendanceWriteBack} disabled={saving}
            onChange={(e) => (e.target.checked ? setConfirm('writeback-on') : void saveSettings({ attendanceWriteBack: false }, 'Attendance write-back turned off.'))}
            className="mt-0.5 rounded border-gray-300 dark:border-white/20" />
          <span>Write TCheck attendance to Moodle's attendance activity<span className="block text-xs text-slate-500 dark:text-slate-400">Present → P, late → L, for delivered sessions only. Absences are never written and a mark a teacher already made in Moodle is never changed. TCheck remains the attendance record.</span></span>
        </label>
        {o.attendanceActivities.length === 0 ? (
          <p className="text-sm text-slate-500">Link at least one course (roster sync) to choose its Moodle attendance activity.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/10"><th className="py-2 pr-4 font-medium">Course</th><th className="py-2 pr-4 font-medium">Moodle attendance activity id</th><th className="py-2 font-medium"><span className="sr-only">Save</span></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {o.attendanceActivities.map((a) => {
                const draft = activityDraft[a.courseId] ?? (a.attendanceId ? String(a.attendanceId) : '');
                const parsed = draft.trim() === '' ? null : Number(draft);
                const valid = parsed === null || (Number.isInteger(parsed) && parsed > 0);
                return (
                  <tr key={a.courseId}>
                    <td className="py-2 pr-4"><span className="font-medium text-slate-900 dark:text-slate-100">{a.code}</span> <span className="text-slate-500">{a.name}</span></td>
                    <td className="py-2 pr-4">
                      <input aria-label={`Moodle attendance activity id for ${a.code}`} inputMode="numeric" value={draft} onChange={(e) => setActivityDraft((d) => ({ ...d, [a.courseId]: e.target.value }))}
                        placeholder="Not set" className={clsx('w-32 rounded-lg px-2 py-1 text-sm bg-white dark:bg-white/5 border', valid ? 'border-gray-200 dark:border-white/10' : 'border-red-400')} />
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" disabled={!valid || saving || parsed === a.attendanceId} onClick={() => void saveSettings({ activities: [{ courseId: a.courseId, attendanceId: parsed }] }, `Saved for ${a.code}.`)} className="text-sm font-medium text-blue-600 dark:text-blue-400 disabled:opacity-40 cursor-pointer">Save</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="history" className="space-y-2">
        <h3 id="history" className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Synchronisation history</h3>
        {o.history.length === 0 ? <p className="text-sm text-slate-500">No synchronisations yet.</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-white/10">
            {o.history.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <p className="text-slate-900 dark:text-slate-100"><span className="font-medium">{r.kind === 'ROSTER' ? 'Roster' : 'Attendance write-back'}</span> · {RUN_STATUS[r.status]} · {when(r.startedAt)} · {r.trigger === 'MANUAL' ? `by ${r.initiatedBy ?? 'an administrator'}` : 'scheduled'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{r.status === 'RUNNING' ? progressText(r) : runSummary(r)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Lock size={11} aria-hidden /> The Moodle token is stored encrypted and never shown. Feedback and grades are never sent to Moodle.</p>

      {confirm === 'roster' && (
        <Confirm title="Sync roster from Moodle?" action="Start sync" busy={starting} onCancel={() => setConfirm(null)} onConfirm={() => void start('roster')}
          body={<><p>TCheck will read this school's Moodle courses and enrolments, link courses whose code matches, and add TCheck enrolments for delegates it can match with certainty.</p><p>Nothing is removed in TCheck or Moodle. Anyone it can't match is listed for review.</p><p className="text-slate-500">Last successful sync: {when(lastRoster?.finishedAt)}</p></>} />
      )}
      {confirm === 'attendance' && (
        <Confirm title="Write attendance to Moodle?" action="Start" busy={starting} onCancel={() => setConfirm(null)} onConfirm={() => void start('attendance')}
          body={<><p>Present and late marks from delivered sessions in the last 14 days will be written to each course's Moodle attendance activity.</p><p>Marks already in Moodle are left unchanged; nothing is written twice.</p></>} />
      )}
      {confirm === 'writeback-on' && (
        <Confirm title="Turn on attendance write-back?" action="Turn on" busy={saving} onCancel={() => setConfirm(null)} onConfirm={() => void saveSettings({ attendanceWriteBack: true }, 'Attendance write-back turned on.')}
          body={<><p>Once a course has its Moodle attendance activity set, TCheck will write present (P) and late (L) marks daily.</p><p>Absences are never written and teachers' existing Moodle marks are never changed.</p></>} />
      )}
    </section>
  );
}

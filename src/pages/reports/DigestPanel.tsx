import { useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Eye, Mail, Pause, Play, Plus, Send, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

/**
 * Leadership digest (2026-11-26) — Reports → Leadership digest. The School Admin signs leaders up
 * (weekly or monthly, a local hour), previews any leader's digest as that leader, sends themselves
 * a test and removes sign-ups. A leader sees their own: when it comes, a preview, pause/resume.
 * Server: /reports/digest*.
 */

type Freq = 'WEEKLY' | 'MONTHLY';
interface Sub { id: string; userId: string; frequency: Freq; weekday: number | null; hour: number; paused: boolean; nextRunAt: string | null; lastSentAt: string | null; lastError: string | null; person: { name: string; role: string; email: string } | null }
export interface DigestState { on: boolean; canManage?: boolean; mine?: Sub | null; subscriptions?: Sub[]; eligible?: { id: string; name: string; role: string }[] }
type Tone = 'good' | 'bad' | 'neutral';
interface Digest { firstName: string; schoolName: string; frequency: Freq; periodWords: string; scope: string; tiles: { label: string; value: string; sub?: string; tone?: Tone }[]; attention: string[]; sections: { key: string; title: string; rows: { label: string; value: string; note?: string; tone?: Tone }[] }[] }
const toneCls = (t?: Tone) => (t === 'good' ? 'text-green-700 dark:text-green-400' : t === 'bad' ? 'text-red-600 dark:text-red-400' : strong);

const card = 'rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-elevated)] shadow-[var(--app-shadow)] dark:bg-white/[0.04] dark:border-white/10';
const input = 'w-full rounded-xl border px-3 py-2 text-sm bg-[var(--app-elevated-solid)] border-[var(--app-border)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-blue-500/35 dark:bg-white/5 dark:border-white/10';
const muted = 'text-[var(--app-text-muted)]';
const strong = 'text-[var(--app-text)]';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 5);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const when = (s: string) => new Date(s).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const schedule = (s: Pick<Sub, 'frequency' | 'weekday' | 'hour'>) => (s.frequency === 'WEEKLY' ? `Every ${DAYS[(s.weekday ?? 1) - 1]} at ${hh(s.hour)}` : `Monthly, on the 1st at ${hh(s.hour)}`);

export function DigestPanel({ onBack }: { onBack: () => void }) {
  const { data, refetch } = useApi<DigestState>('/reports/digest');
  const [preview, setPreview] = useState<{ who: string; userId?: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Sub | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); if (ok) setMsg(ok); await refetch(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  if (!data?.on) return null;
  const mine = data.mine ?? null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className={clsx('inline-flex items-center gap-1.5 text-sm cursor-pointer hover:text-[var(--app-text)]', muted)}><ArrowLeft size={15} /> All reports</button>
      <div>
        <h2 className={clsx('text-xl font-semibold', strong)}>Leadership digest</h2>
        <p className={clsx('text-sm max-w-3xl', muted)}>A weekly or monthly email of the numbers that matter, so leaders don't need to log in: attendance and where it's falling, students who need someone, follow-up results and retention against the agreed baseline. Each person sees only their own area. Numbers only; no student is ever named.</p>
      </div>

      {mine && (
        <section className={clsx(card, 'p-4 flex flex-col sm:flex-row sm:items-center gap-3')} aria-label="Your digest">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-300"><Mail size={17} /></span>
          <div className="min-w-0 flex-1">
            <p className={clsx('text-sm font-medium', strong)}>{mine.paused ? 'Your digest is paused' : 'You get the leadership digest'}</p>
            <p className={clsx('text-xs', muted)}>{schedule(mine)}{!mine.paused && mine.nextRunAt ? ` · next ${when(mine.nextRunAt)}` : ''}{mine.lastSentAt ? ` · last sent ${when(mine.lastSentAt)}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setPreview({ who: 'Your digest' })}><Eye size={13} className="mr-1" />Preview</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(() => api.post('/reports/digest/me', { paused: !mine.paused }), mine.paused ? 'Resumed.' : 'Paused. Nothing will be sent until you resume.')}>
              {mine.paused ? <><Play size={13} className="mr-1" />Resume</> : <><Pause size={13} className="mr-1" />Pause</>}
            </Button>
          </div>
        </section>
      )}

      {data.canManage && (
        <section className="space-y-3" aria-label="Who gets it">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className={clsx('font-semibold', strong)}>Who gets it</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(async () => { const r = await api.post<{ to: string | null }>('/reports/digest/test', {}); setMsg(`Test sent to ${r.to ?? 'your address'}.`); }, '')}><Send size={13} className="mr-1" />Send me a test</Button>
              <Button size="sm" variant="secondary" onClick={() => setPreview({ who: 'Your digest' })}><Eye size={13} className="mr-1" />Preview mine</Button>
              <Button size="sm" onClick={() => setAdding(true)} disabled={!data.eligible?.length}><Plus size={13} className="mr-1" />Add a leader</Button>
            </div>
          </div>
          {!data.subscriptions?.length ? (
            <div className={clsx(card, 'p-8 text-center')}>
              <Mail size={26} className={clsx('mx-auto mb-2 opacity-40', muted)} />
              <p className={clsx('text-sm', strong)}>Nobody gets the digest yet</p>
              <p className={clsx('text-xs mt-1', muted)}>Add your VC, DVCs, Registrars, Deans or HODs. Each gets their own area's numbers.</p>
            </div>
          ) : (
            <ul className={clsx(card, 'divide-y divide-[var(--app-border-soft)] dark:divide-white/5')}>
              {data.subscriptions.map((s) => (
                <li key={s.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={clsx('text-sm font-medium', strong)}>{s.person?.name ?? 'Former account'} <span className={clsx('font-normal', muted)}>· {s.person?.role ?? ''}</span></p>
                    <p className={clsx('text-xs inline-flex items-center gap-1', s.paused ? muted : 'text-blue-600 dark:text-blue-300')}><CalendarClock size={12} />{schedule(s)}{s.paused ? ' · paused' : s.nextRunAt ? ` · next ${when(s.nextRunAt)}` : ''}</p>
                    {s.lastSentAt && <p className={clsx('text-xs', muted)}>Last sent {when(s.lastSentAt)}</p>}
                    {s.lastError && <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{s.lastError}</p>}
                    {confirmRemove === s.id && <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">They will stop getting the digest. You can add them again later.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setPreview({ who: `${s.person?.name ?? 'Their'} digest`, userId: s.userId })}><Eye size={13} className="mr-1" />Preview</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(s)}><CalendarClock size={13} className="mr-1" />Change</Button>
                    {confirmRemove === s.id
                      ? <Button size="sm" variant="danger" disabled={busy} onClick={() => { setConfirmRemove(null); void act(() => api.delete(`/reports/digest/${s.id}`), 'Removed.'); }}>Remove</Button>
                      : <Button size="sm" variant="ghost" aria-label={`Remove ${s.person?.name ?? 'this person'}`} onClick={() => setConfirmRemove(s.id)}><Trash2 size={14} /></Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {msg && <p role="status" className={clsx('text-sm', muted)}>{msg}</p>}

      {preview && <PreviewDialog title={preview.who} userId={preview.userId} onClose={() => setPreview(null)} />}
      {adding && data.eligible && <ScheduleDialog title="Add a leader" people={data.eligible} onClose={() => setAdding(false)} onSave={(b) => act(async () => { await api.post('/reports/digest', b); setAdding(false); }, 'Added. They will get their first digest at the next send time.')} />}
      {editing && <ScheduleDialog title={`Change ${editing.person?.name ?? 'schedule'}`} start={editing} onClose={() => setEditing(null)} onSave={(b) => act(async () => { await api.patch(`/reports/digest/${editing.id}`, { frequency: b.frequency, weekday: b.weekday, hour: b.hour }); setEditing(null); }, 'Saved.')} />}
    </div>
  );
}

function ScheduleDialog({ title, people, start, onClose, onSave }: { title: string; people?: { id: string; name: string; role: string }[]; start?: Sub; onClose: () => void; onSave: (b: { userId: string; frequency: Freq; weekday: number | null; hour: number }) => Promise<void> }) {
  const [userId, setUserId] = useState(people?.[0]?.id ?? start?.userId ?? '');
  const [frequency, setFrequency] = useState<Freq>(start?.frequency ?? 'MONTHLY');
  const [weekday, setWeekday] = useState(start?.weekday ?? 1);
  const [hour, setHour] = useState(start?.hour ?? 7);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3 text-sm">
        {people && (
          <label className="block"><span className={clsx('block text-xs font-medium mb-1', muted)}>Leader</span>
            <select className={input} value={userId} onChange={(e) => setUserId(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</select>
          </label>
        )}
        <label className="block"><span className={clsx('block text-xs font-medium mb-1', muted)}>How often</span>
          <select className={input} value={frequency} onChange={(e) => setFrequency(e.target.value as Freq)}><option value="MONTHLY">Every month (on the 1st, covering last month)</option><option value="WEEKLY">Every week (covering the last 7 days)</option></select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {frequency === 'WEEKLY' && <label className="block"><span className={clsx('block text-xs font-medium mb-1', muted)}>Day</span><select className={input} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>}
          <label className="block"><span className={clsx('block text-xs font-medium mb-1', muted)}>Time</span><select className={input} value={hour} onChange={(e) => setHour(Number(e.target.value))}>{HOURS.map((h) => <option key={h} value={h}>{hh(h)}</option>)}</select></label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !userId} onClick={async () => { setBusy(true); try { await onSave({ userId, frequency, weekday: frequency === 'WEEKLY' ? weekday : null, hour }); } finally { setBusy(false); } }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewDialog({ title, userId, onClose }: { title: string; userId?: string; onClose: () => void }) {
  const { data: d, error, loading } = useApi<Digest>(`/reports/digest/preview${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`);
  return (
    <Modal open onClose={onClose} title={`${title}: preview`}>
      {loading && !d ? <p className={clsx('text-sm', muted)}>Building the digest…</p> : error ? <p className="text-sm text-red-600">{error}</p> : d && <DigestView d={d} />}
    </Modal>
  );
}

/** The digest as the email shows it. */
export function DigestView({ d }: { d: Digest }) {
  const word = d.frequency === 'WEEKLY' ? 'week' : 'month';
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className={clsx('text-xs', muted)}>{d.schoolName}{d.periodWords ? ` · ${d.periodWords}` : ''}</p>
        <p className={clsx('mt-1', muted)}>Hi {d.firstName}, here is {d.scope} at a glance.</p>
      </div>
      {d.tiles.length > 0 && (
        <div className={clsx('grid gap-2', d.tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {d.tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-black/[0.03] dark:bg-white/5 px-3 py-2.5">
              <p className={clsx('text-[10px] uppercase tracking-wide', muted)}>{t.label}</p>
              <p className={clsx('text-xl font-bold tabular-nums mt-0.5', toneCls(t.tone))}>{t.value}</p>
              {t.sub && <p className={clsx('text-[11px]', muted)}>{t.sub}</p>}
            </div>
          ))}
        </div>
      )}
      {d.attention.length ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 inline-flex items-center gap-1"><AlertTriangle size={13} />Needs your attention</p>
          <ul className="mt-1.5 space-y-1.5">{d.attention.map((a) => <li key={a} className="flex gap-2 text-amber-950 dark:text-amber-100"><span className="text-amber-600">●</span><span>{a}</span></li>)}</ul>
        </div>
      ) : (
        <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-3.5 py-3 text-green-800 dark:text-green-300 inline-flex items-center gap-1.5 w-full"><CheckCircle2 size={14} /><span><strong>All clear.</strong> Nothing needs your attention this {word}.</span></p>
      )}
      {d.sections.map((s) => (
        <section key={s.key}>
          <p className={clsx('text-[11px] font-bold uppercase tracking-wide pb-1.5 border-b border-[var(--app-border-soft)] dark:border-white/10', muted)}>{s.title}</p>
          <dl className="divide-y divide-[var(--app-border-soft)] dark:divide-white/5">
            {s.rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-2">
                <dt><span className={strong}>{r.label}</span>{r.note && <span className={clsx('block text-[11px]', muted)}>{r.note}</span>}</dt>
                <dd className={clsx('font-semibold tabular-nums whitespace-nowrap', toneCls(r.tone))}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className={clsx('text-[11px] pt-1', muted)}>Numbers only: no student or lecturer is named. Every number comes from the report of the same name, limited to what this person's account can see.</p>
    </div>
  );
}

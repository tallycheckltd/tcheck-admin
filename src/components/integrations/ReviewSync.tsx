import { useState } from 'react';
import { RefreshCw, CheckCheck, EyeOff, Link2, Settings2 } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

type Kind = 'TERM' | 'ORG_UNIT' | 'PROGRAMME' | 'COHORT' | 'COURSE' | 'LECTURER' | 'STUDENT';
type Meaning = 'DIVISION' | 'FACULTY' | 'DEPARTMENT' | 'SUB_DEPARTMENT' | 'PROGRAMME' | 'IGNORE';
interface Item { id: string; kind: Kind; externalId: string; status: 'NEW' | 'MATCHED' | 'CHANGED' | 'UNMATCHED' | 'REMOVED'; payload: Record<string, unknown>; diff?: Record<string, [unknown, unknown]> | null; message?: string | null }
interface Review {
  pending: number;
  groups: { kind: Kind; items: Item[] }[];
  mapping: { orgLevelsByDepth?: Meaning[]; autoAcceptStudents?: boolean } | null;
  lastRun: { status: string; startedAt: string; counts: Record<string, number>; issues: { part: string; message: string }[]; errorMessage?: string | null } | null;
}

const KIND_LABEL: Record<Kind, string> = { TERM: 'Terms', ORG_UNIT: 'Org units', PROGRAMME: 'Programmes', COHORT: 'Cohorts', COURSE: 'Courses', LECTURER: 'Lecturers', STUDENT: 'Students' };
const STATUS_COLOR: Record<Item['status'], 'blue' | 'green' | 'yellow' | 'red' | 'gray'> = { NEW: 'blue', MATCHED: 'green', CHANGED: 'yellow', UNMATCHED: 'red', REMOVED: 'gray' };
const STATUS_LABEL: Record<Item['status'], string> = { NEW: 'New', MATCHED: 'Matched', CHANGED: 'Changed', UNMATCHED: 'Unmatched', REMOVED: 'Removed in LMS' };
const MEANINGS: Meaning[] = ['DIVISION', 'FACULTY', 'DEPARTMENT', 'SUB_DEPARTMENT', 'PROGRAMME', 'IGNORE'];
const MEANING_LABEL: Record<Meaning, string> = { DIVISION: 'Division', FACULTY: 'Faculty / School', DEPARTMENT: 'Department', SUB_DEPARTMENT: 'Sub-department', PROGRAMME: 'Programme', IGNORE: 'Ignore' };
const selectCls = 'text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5';

/** Where the "map to existing" dropdown finds this school's records of each kind. */
const TARGETS: Record<Kind, { path: string; label: (x: Record<string, string>) => string }> = {
  TERM: { path: '/terms', label: (x) => x.name },
  ORG_UNIT: { path: '/org-units', label: (x) => `${x.name} (${x.level?.toLowerCase().replace('_', '-')})` },
  PROGRAMME: { path: '/academic/majors', label: (x) => `${x.name} · ${x.code}` },
  COHORT: { path: '/academic/cohorts', label: (x) => x.name },
  COURSE: { path: '/courses', label: (x) => `${x.name} · ${x.code}` },
  LECTURER: { path: '/users?role=LECTURER', label: (x) => `${x.firstName} ${x.lastName} · ${x.email}` },
  STUDENT: { path: '/users?role=STUDENT', label: (x) => `${x.firstName} ${x.lastName}${x.studentId ? ` · ${x.studentId}` : ''}` },
};

function MapTarget({ kind, label, value, onChange }: { kind: Kind; label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data } = useApi<Record<string, string>[]>(open ? TARGETS[kind].path : null);
  if (!open) return <button type="button" className="text-xs text-blue-600 cursor-pointer" onClick={() => setOpen(true)}>Map to existing…</button>;
  return (
    <select aria-label={`Existing record for ${label}`} value={value} onChange={(e) => onChange(e.target.value)} className={`${selectCls} max-w-[220px]`}>
      <option value="">{data ? 'Choose…' : 'Loading…'}</option>
      {(data ?? []).map((x) => <option key={x.id} value={x.id}>{TARGETS[kind].label(x)}</option>)}
    </select>
  );
}

const describe = (it: Item) => {
  const p = it.payload as Record<string, string | null>;
  if (it.kind === 'LECTURER' || it.kind === 'STUDENT') return `${p.firstName ?? ''} ${p.lastName ?? ''}${p.email ? ` · ${p.email}` : ''}`.trim() || it.externalId;
  if (it.kind === 'TERM') return `${p.name} (${p.startDate} → ${p.endDate})`;
  if (it.kind === 'COURSE') return `${p.name} · ${p.code}`;
  return p.name ?? it.externalId;
};

/**
 * P7 (A6.3) — School Admin → Integrations → Review sync. Map once (what each level of the LMS tree
 * means), pull into staging, then approve all / a group / a row, map an unmatched row to an existing
 * record, or ignore noise (always). Removed-in-LMS rows only flag; nothing is deleted.
 */
export function ReviewSync({ connectionId, providerLabel }: { connectionId: string; providerLabel: string }) {
  const { data, refetch } = useApi<Review>(`/integrations/connections/${connectionId}/review`);
  const { mutate: post, loading } = useMutation('post');
  const { mutate: put } = useMutation('put');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mapTo, setMapTo] = useState<Record<string, string>>({});
  const [editMapping, setEditMapping] = useState(false);
  const depths = data?.mapping?.orgLevelsByDepth ?? ['FACULTY', 'DEPARTMENT', 'PROGRAMME'];
  const [draft, setDraft] = useState<{ depths: Meaning[]; auto: boolean } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: (r: any) => string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: ok(r) }); refetch(); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' }); refetch(); }
  };
  const base = `/integrations/connections/${connectionId}`;
  const stage = () => run(() => post(`${base}/stage`, {}), (r) => `Pulled from ${providerLabel}: ${r.counts.NEW} new, ${r.counts.MATCHED} matched, ${r.counts.CHANGED} changed, ${r.counts.UNMATCHED} unmatched, ${r.counts.REMOVED} removed${r.counts.autoAccepted ? `, ${r.counts.autoAccepted} students auto-accepted` : ''}. Nothing changes until you approve.`);
  const approve = (body: object) => run(() => post(`${base}/review/approve`, body), (r) => `${r.approved} approved${r.failed ? `, ${r.failed} need attention (see the rows)` : ''}.`);
  const saveMapping = () => run(async () => { await put(`${base}/mapping`, { orgLevelsByDepth: draft!.depths, autoAcceptStudents: draft!.auto }); setEditMapping(false); }, () => 'Mapping saved — it applies from the next pull.');

  return (
    <div className="glass-card p-5 space-y-4" data-testid="review-sync">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white flex items-center gap-2">
          {providerLabel} — Review sync {!!data?.pending && <Badge color="yellow">{data.pending} to review</Badge>}
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setDraft({ depths: [...depths], auto: !!data?.mapping?.autoAcceptStudents }); setEditMapping((v) => !v); }}><Settings2 size={13} className="mr-1" /> Mapping</Button>
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => void stage()}><RefreshCw size={13} className="mr-1" /> Pull from {providerLabel}</Button>
          {!!data?.pending && <Button size="sm" disabled={loading} onClick={() => void approve({ all: true })}><CheckCheck size={13} className="mr-1" /> Approve all</Button>}
        </div>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">Everything is pulled into this review first. Nothing in Tcheck changes until you approve; lecturers get an invite only when approved; something removed from {providerLabel} is only flagged here, never deleted.</p>
      {!data?.mapping && <p className="text-xs text-amber-600">Set the mapping once before the first pull.</p>}

      {editMapping && draft && (
        <div className="rounded-xl border border-gray-100 dark:border-white/5 p-3 space-y-2" data-testid="mapping-form">
          <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">What each level of the {providerLabel} tree means here</p>
          {draft.depths.map((m, i) => (
            <label key={i} className="flex items-center gap-2 text-xs text-slate-600">
              Level {i + 1}
              <select aria-label={`Level ${i + 1} means`} value={m} onChange={(e) => setDraft({ ...draft, depths: draft.depths.map((x, j) => (j === i ? (e.target.value as Meaning) : x)) })} className={selectCls}>
                {MEANINGS.map((k) => <option key={k} value={k}>{MEANING_LABEL[k]}</option>)}
              </select>
              {i === draft.depths.length - 1 && draft.depths.length > 1 && <button type="button" className="text-red-500 cursor-pointer" onClick={() => setDraft({ ...draft, depths: draft.depths.slice(0, -1) })}>remove</button>}
            </label>
          ))}
          {draft.depths.length < 6 && <button type="button" className="text-xs text-blue-600 cursor-pointer" onClick={() => setDraft({ ...draft, depths: [...draft.depths, 'IGNORE'] })}>+ another level</button>}
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-gray-300">
            <input type="checkbox" checked={draft.auto} onChange={(e) => setDraft({ ...draft, auto: e.target.checked })} /> Auto-accept new students in mapped cohorts
          </label>
          <Button size="sm" onClick={() => void saveMapping()}>Save mapping</Button>
        </div>
      )}

      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}
      {data?.lastRun?.issues?.length ? <p className="text-xs text-amber-600">Last pull could not read: {data.lastRun.issues.map((i) => `${i.part} (${i.message})`).join('; ')}</p> : null}

      {data?.groups.map((g) => (
        <div key={g.kind} className="space-y-1.5" data-testid={`review-group-${g.kind}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{KIND_LABEL[g.kind]} · {g.items.length}</p>
            <button type="button" className="text-xs text-blue-600 cursor-pointer" onClick={() => void approve({ kind: g.kind })}>Approve group</button>
          </div>
          {g.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 flex-wrap bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2 text-sm">
              <Badge color={STATUS_COLOR[it.status]}>{STATUS_LABEL[it.status]}</Badge>
              <span className="text-slate-900 dark:text-white">{describe(it)}</span>
              {it.diff && <span className="text-[11px] text-slate-500">{Object.entries(it.diff).map(([k, [a, b]]) => `${k}: ${String(a)} → ${String(b)}`).join(' · ')}</span>}
              {it.message && <span className="text-[11px] text-amber-600">{it.message}</span>}
              <span className="ml-auto flex items-center gap-2">
                {it.status !== 'UNMATCHED' && <button type="button" className="text-xs text-emerald-600 cursor-pointer" onClick={() => void approve({ itemIds: [it.id] })}>{it.status === 'REMOVED' ? 'Acknowledge' : 'Approve'}</button>}
                {it.status !== 'REMOVED' && (
                  <>
                    <MapTarget kind={it.kind} label={describe(it)} value={mapTo[it.id] ?? ''} onChange={(v) => setMapTo({ ...mapTo, [it.id]: v })} />
                    <button type="button" disabled={!mapTo[it.id]} className="text-xs text-blue-600 disabled:opacity-40 cursor-pointer inline-flex items-center gap-0.5" onClick={() => void run(() => post(`${base}/review/${it.id}/map`, { targetId: mapTo[it.id] }), () => 'Mapped to the existing record.')}><Link2 size={11} /> Map</button>
                  </>
                )}
                <button type="button" className="text-xs text-slate-500 cursor-pointer inline-flex items-center gap-0.5" onClick={() => void run(() => post(`${base}/review/${it.id}/ignore`, { always: true }), () => 'Ignored — it will not be pulled again.')}><EyeOff size={11} /> Ignore always</button>
              </span>
            </div>
          ))}
        </div>
      ))}
      {data && !data.pending && <p className="text-xs text-slate-500">Nothing to review{data.lastRun ? ` — last pull ${new Date(data.lastRun.startedAt).toLocaleString()} (${data.lastRun.status.toLowerCase().replace(/_/g, ' ')})` : ''}.</p>}
    </div>
  );
}

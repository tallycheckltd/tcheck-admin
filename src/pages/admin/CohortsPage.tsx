import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Plus, Pencil, Trash2, Users, Users2, History, MapPin, ArrowRightLeft } from 'lucide-react';
import type { AuditEvent, Campus, Cohort, CohortMember, CohortMemberStatus, CohortMode, CohortStatus, LastChanged, Major, School, User } from '../../types';
import { AuditTimeline, LastChangedLine } from '../../components/academics/LastChangedLine';

const MODE_LABEL: Record<CohortMode, string> = { FULL_TIME: 'Full time', PART_TIME: 'Part time', EVENING: 'Evening', WEEKEND: 'Weekend', DISTANCE: 'Distance', EXECUTIVE: 'Executive' };
const STATUS_LABEL: Record<CohortStatus, string> = { PLANNED: 'Planned', ACTIVE: 'Active', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const STATUS_COLOR: Record<CohortStatus, 'blue' | 'green' | 'gray' | 'red'> = { PLANNED: 'blue', ACTIVE: 'green', COMPLETED: 'gray', CANCELLED: 'red' };
const MEMBER_LABEL: Record<CohortMemberStatus, string> = { ACTIVE: 'Active', DEFERRED: 'Deferred', COMPLETED: 'Completed', WITHDRAWN: 'Withdrawn' };
const selectCls = 'w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

const emptyForm = {
  name: '', year: new Date().getFullYear(), assignedCemId: '', majorId: '', campusId: '',
  startDate: '', endDate: '', mode: '' as CohortMode | '', status: 'ACTIVE' as CohortStatus, clientOrganisation: '',
};

/**
 * P5 (A4) — the "Cohorts / Intakes" tab of Academics. Moved out of the Super-Admin-only area: a
 * School Admin creates intakes, links them to a programme and campus, assigns the CEM (exec tenants),
 * manages members (defer / withdraw) and reads each cohort's timeline.
 */
export function CohortsPage({ school }: { school?: School | null }) {
  const schoolId = school?.id;
  const q = schoolId ? `?schoolId=${schoolId}` : '';
  const { data: cohorts, refetch } = useApi<Cohort[]>(schoolId ? `/academic/cohorts${q}` : null);
  const { data: majors } = useApi<Major[]>(schoolId ? `/academic/majors${q}` : null);
  const { data: campuses, refetch: refetchCampuses } = useApi<Campus[]>(schoolId ? `/academic/campuses${q}` : null);
  const execEdSuiteOn = !!school?.features?.execEdSuite;
  const cohortMovesOn = !!school?.features?.cohortMoves;
  const { data: cems } = useApi<User[]>(execEdSuiteOn ? `/users?schoolId=${schoolId}&role=CLIENT_EXPERIENCE_MANAGER&status=APPROVED` : null);
  const ids = (cohorts ?? []).map((c) => c.id).join(',');
  const { data: last, refetch: refetchLast } = useApi<Record<string, LastChanged>>(ids ? `/academic/last-changed?entityType=Cohort&ids=${ids}&schoolId=${schoolId}` : null);
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: remove } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Cohort | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [membersOf, setMembersOf] = useState<Cohort | null>(null);
  const [syndicatesOf, setSyndicatesOf] = useState<Cohort | null>(null);
  const [moveFrom, setMoveFrom] = useState<Cohort | null>(null);
  const [timelineOf, setTimelineOf] = useState<Cohort | null>(null);
  const [campusName, setCampusName] = useState('');

  const reload = () => { refetch(); refetchLast(); };
  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true); };
  const openEdit = (c: Cohort) => {
    setEditing(c);
    setForm({
      name: c.name, year: c.year, assignedCemId: c.assignedCemId ?? '', majorId: c.majorId ?? '', campusId: c.campusId ?? '',
      startDate: day(c.startDate), endDate: day(c.endDate), mode: c.mode ?? '', status: c.status ?? 'ACTIVE', clientOrganisation: c.clientOrganisation ?? '',
    });
    setError('');
    setModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    const payload = {
      name: form.name.trim(), year: form.year, majorId: form.majorId || null, campusId: form.campusId || null,
      startDate: form.startDate || null, endDate: form.endDate || null, mode: form.mode || null, status: form.status,
      clientOrganisation: form.clientOrganisation.trim() || null,
      ...(execEdSuiteOn ? { assignedCemId: form.assignedCemId || null } : {}),
    };
    try {
      if (editing) await update(`/academic/cohorts/${editing.id}`, payload);
      else await create('/academic/cohorts', { ...payload, schoolId });
      setModal(false);
      reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the cohort'); }
  };

  const handleDelete = async (c: Cohort) => {
    if (!confirm(`Delete the cohort "${c.name}"? Its membership list goes with it.`)) return;
    await remove(`/academic/cohorts/${c.id}`);
    reload();
  };

  const addCampus = async () => {
    if (!campusName.trim()) return;
    await create('/academic/campuses', { name: campusName.trim(), schoolId });
    setCampusName('');
    refetchCampuses();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-600 dark:text-gray-400">Each intake belongs to a programme. Dates set here are used before any inferred from the timetable.</p>
        <Button onClick={openCreate} disabled={!schoolId}><Plus size={16} className="mr-1" /> Add cohort</Button>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-left text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4 font-medium">Cohort</th>
                <th className="py-3 px-4 font-medium">Programme</th>
                <th className="py-3 px-4 font-medium">Dates</th>
                <th className="py-3 px-4 font-medium">Status</th>
                {execEdSuiteOn && <th className="py-3 px-4 font-medium">CEM</th>}
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cohorts?.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-white/5 align-top">
                  <td className="py-3 px-4">
                    <p className="text-slate-950 dark:text-white font-medium">{c.name} <span className="text-xs text-slate-500">{c.year}</span></p>
                    <p className="text-xs text-slate-500">{[c.mode ? MODE_LABEL[c.mode] : null, c.campus?.name, c.clientOrganisation, cohortMovesOn && c.currentMembers !== undefined && c.currentMembers !== (c._count?.members ?? 0) ? `${c.currentMembers} current · ${(c._count?.members ?? 0) - c.currentMembers} completed or left` : `${c._count?.members ?? 0} students`].filter(Boolean).join(' · ')}</p>
                    <LastChangedLine value={last?.[c.id]} />
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300">{c.major?.name ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-700 dark:text-gray-300 whitespace-nowrap">{c.startDate ? `${day(c.startDate)} → ${day(c.endDate) || '…'}` : '—'}</td>
                  <td className="py-3 px-4"><Badge color={STATUS_COLOR[c.status ?? 'ACTIVE']}>{STATUS_LABEL[c.status ?? 'ACTIVE']}</Badge></td>
                  {execEdSuiteOn && (
                    <td className="py-3 px-4 text-slate-700 dark:text-gray-300 whitespace-nowrap">
                      {c.assignedCem ? `${c.assignedCem.firstName} ${c.assignedCem.lastName}` : <span className="text-amber-600 dark:text-amber-400">No CEM</span>}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                    {cohortMovesOn && <Button variant="secondary" size="sm" onClick={() => setMoveFrom(c)} aria-label={`Move students from ${c.name}`}><ArrowRightLeft size={14} className="mr-1" />Move</Button>}
                    <Button variant="ghost" size="sm" onClick={() => setMembersOf(c)} aria-label={`Members of ${c.name}`}><Users size={14} /></Button>
                    {execEdSuiteOn && <Button variant="ghost" size="sm" onClick={() => setSyndicatesOf(c)} aria-label={`Syndicates of ${c.name}`}><Users2 size={14} /></Button>}
                    <Button variant="ghost" size="sm" onClick={() => setTimelineOf(c)} aria-label={`History of ${c.name}`}><History size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(c)} aria-label={`Delete ${c.name}`}><Trash2 size={14} className="text-red-500" /></Button>
                  </td>
                </tr>
              ))}
              {!cohorts?.length && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No cohorts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2"><MapPin size={14} /> Campuses</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {campuses?.map((c) => <Badge key={c.id} color="gray">{c.name}{c._count ? ` · ${c._count.cohorts}` : ''}</Badge>)}
          {!campuses?.length && <span className="text-xs text-slate-500">None — optional, only for institutions with more than one site.</span>}
        </div>
        <div className="flex gap-2 max-w-md">
          <input aria-label="New campus name" value={campusName} onChange={(e) => setCampusName(e.target.value)} placeholder="Campus name" className={selectCls} />
          <Button size="sm" onClick={() => void addCampus()} disabled={!campusName.trim()}>Add</Button>
        </div>
      </GlassCard>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit cohort' : 'Add cohort'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <Input label="Year" type="number" value={String(form.year)} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label htmlFor="coh-major" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Programme</label>
            <select id="coh-major" value={form.majorId} onChange={(e) => setForm({ ...form, majorId: e.target.value })} className={selectCls}>
              <option value="">—</option>
              {majors?.filter((m) => m.isActive !== false || m.id === form.majorId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="coh-mode" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Mode</label>
              <select id="coh-mode" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as CohortMode | '' })} className={selectCls}>
                <option value="">—</option>
                {(Object.keys(MODE_LABEL) as CohortMode[]).map((k) => <option key={k} value={k}>{MODE_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="coh-status" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Status</label>
              <select id="coh-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CohortStatus })} className={selectCls}>
                {(Object.keys(STATUS_LABEL) as CohortStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="coh-campus" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Campus (optional)</label>
              <select id="coh-campus" value={form.campusId} onChange={(e) => setForm({ ...form, campusId: e.target.value })} className={selectCls}>
                <option value="">—</option>
                {campuses?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="Client organisation (optional)" value={form.clientOrganisation} onChange={(e) => setForm({ ...form, clientOrganisation: e.target.value })} />
          </div>
          {execEdSuiteOn && (
            <div>
              <label htmlFor="coh-cem" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Client Experience Manager (CEM)</label>
              {cems && cems.length > 0 ? (
                <select id="coh-cem" value={form.assignedCemId} onChange={(e) => setForm({ ...form, assignedCemId: e.target.value })} className={selectCls}>
                  <option value="">No CEM assigned</option>
                  {cems.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
              ) : (
                <p className="text-xs text-slate-500 dark:text-gray-400">No Client Experience Managers at this institution yet — add one under People &amp; Organization.</p>
              )}
              <p className="text-xs text-slate-400 mt-1">Students who have finished onboarding get a welcome message from the CEM as soon as they are assigned.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={() => void handleSubmit()} className="w-full">{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>

      <MembersModal cohort={membersOf} schoolId={schoolId} onClose={() => { setMembersOf(null); reload(); }} />
      {cohortMovesOn && <MoveStudentsModal from={moveFrom} cohorts={cohorts ?? []} onClose={() => { setMoveFrom(null); reload(); }} />}
      <SyndicatesModal cohort={syndicatesOf} schoolId={schoolId} onClose={() => { setSyndicatesOf(null); reload(); }} />
      <TimelineModal cohort={timelineOf} schoolId={schoolId} onClose={() => setTimelineOf(null)} />
    </div>
  );
}

function MembersModal({ cohort, schoolId, onClose }: { cohort: Cohort | null; schoolId?: string; onClose: () => void }) {
  const { data: members, refetch } = useApi<CohortMember[]>(cohort ? `/academic/cohorts/${cohort.id}/members` : null);
  const { data: students } = useApi<User[]>(cohort ? `/users?schoolId=${schoolId}&role=STUDENT` : null);
  const { mutate: add } = useMutation('post');
  const { mutate: patch } = useMutation('patch');
  const { mutate: remove } = useMutation('delete');
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const inCohort = new Set((members ?? []).map((m) => m.userId));

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); refetch(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update membership'); }
  };

  return (
    <Modal open={!!cohort} onClose={onClose} title={cohort ? `Students — ${cohort.name}` : 'Students'}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <select aria-label="Student to add" value={pick} onChange={(e) => setPick(e.target.value)} className={selectCls}>
            <option value="">Add a student…</option>
            {students?.filter((s) => !inCohort.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.studentId ? ` (${s.studentId})` : ''}</option>)}
          </select>
          <Button size="sm" disabled={!pick} onClick={() => void run(async () => { await add(`/academic/cohorts/${cohort!.id}/members`, { userIds: [pick] }); setPick(''); })}>Add</Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
          {members?.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-900 dark:text-white truncate">{m.user.firstName} {m.user.lastName}</p>
                <p className="text-[11px] text-slate-500">Joined {m.joinedAt.slice(0, 10)}{m.leftAt ? ` · left ${m.leftAt.slice(0, 10)}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select aria-label={`Status of ${m.user.firstName} ${m.user.lastName}`} value={m.status} onChange={(e) => void run(() => patch(`/academic/cohorts/${cohort!.id}/members/${m.userId}`, { status: e.target.value }))} className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1">
                  {(Object.keys(MEMBER_LABEL) as CohortMemberStatus[]).map((k) => <option key={k} value={k}>{MEMBER_LABEL[k]}</option>)}
                </select>
                <button type="button" onClick={() => void run(() => remove(`/academic/cohorts/${cohort!.id}/members/${m.userId}`))} className="text-red-500 p-1 cursor-pointer" aria-label={`Remove ${m.user.firstName} ${m.user.lastName}`}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {!members?.length && <p className="text-sm text-slate-500 py-4 text-center">No students in this cohort yet.</p>}
        </div>
      </div>
    </Modal>
  );
}

/** The stage that usually follows: same programme, "Theory" → "Practical" in the name; else the
 * first other (non-Theory) cohort of the same programme. Only a suggestion — any cohort can be picked. */
function suggestTarget(from: Cohort, cohorts: Cohort[]): string {
  const others = cohorts.filter((c) => c.id !== from.id && c.status !== 'CANCELLED' && c.status !== 'COMPLETED');
  const next = from.name.replace(/theory/i, 'Practical');
  const byName = next !== from.name ? others.find((c) => c.name.toLowerCase() === next.toLowerCase()) : undefined;
  // Never suggest stepping back to a Theory cohort from a later stage.
  const forward = /theory/i.test(from.name) ? others : others.filter((c) => !/theory/i.test(c.name));
  return (byName ?? forward.find((c) => from.majorId && c.majorId === from.majorId) ?? forward[0])?.id ?? '';
}

/** Training schools (features.cohortMoves) — move one student or the whole group to another cohort. */
function MoveStudentsModal({ from, cohorts, onClose }: { from: Cohort | null; cohorts: Cohort[]; onClose: () => void }) {
  const { data: members, refetch } = useApi<CohortMember[]>(from ? `/academic/cohorts/${from.id}/members` : null);
  const { mutate: post, loading } = useMutation('post');
  const current = (members ?? []).filter((m) => m.status === 'ACTIVE' || m.status === 'DEFERRED');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [toId, setToId] = useState('');
  const [mode, setMode] = useState<'MOVE' | 'ADD'>('MOVE');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  // Fresh state each time the window opens (and forget the last cohort once it closes).
  if (!from && openedFor !== null) setOpenedFor(null);
  if (from && openedFor !== from.id) {
    setOpenedFor(from.id); setPicked(new Set()); setToId(suggestTarget(from, cohorts)); setMode('MOVE'); setConfirming(false); setError(''); setDone('');
  }
  const to = cohorts.find((c) => c.id === toId);
  const allPicked = current.length > 0 && current.every((m) => picked.has(m.userId));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const n = picked.size;
  const who = `${n} student${n === 1 ? '' : 's'}`;

  const submit = async () => {
    setError('');
    try {
      await post(`/academic/cohorts/${from!.id}/move`, { userIds: [...picked], toCohortId: toId, mode });
      setDone(mode === 'MOVE' ? `${who} moved to ${to?.name}.` : `${who} also added to ${to?.name}.`);
      setPicked(new Set()); setConfirming(false); refetch();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not move the students'); setConfirming(false); }
  };

  return (
    <Modal open={!!from} onClose={onClose} title={from ? `Move students — ${from.name}` : 'Move students'}>
      <div className="space-y-4">
        {done && <p className="text-sm rounded-lg bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 px-3 py-2">{done}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {confirming ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-800 dark:text-gray-200">
              {mode === 'MOVE'
                ? <>{who} move from <b>{from?.name}</b> to <b>{to?.name}</b>. From their next class they check in to {to?.name}'s classes, and {from?.name} records them as Completed.</>
                : <>{who} {n === 1 ? 'is' : 'are'} also added to <b>{to?.name}</b> and stay in <b>{from?.name}</b>. They check in to both cohorts' classes.</>}
              {' '}Past attendance is kept.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirming(false)}>Back</Button>
              <Button onClick={() => void submit()} disabled={loading}>{loading ? 'Moving…' : 'Confirm'}</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
              <label className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-900 dark:text-white cursor-pointer">
                <input type="checkbox" checked={allPicked} disabled={!current.length} onChange={() => setPicked(allPicked ? new Set() : new Set(current.map((m) => m.userId)))} aria-label="Select all students" />
                Select all ({current.length})
              </label>
              {current.map((m) => (
                <label key={m.userId} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-800 dark:text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={picked.has(m.userId)} onChange={() => toggle(m.userId)} aria-label={`Select ${m.user.firstName} ${m.user.lastName}`} />
                  <span className="truncate">{m.user.firstName} {m.user.lastName}{m.user.studentId ? <span className="text-xs text-slate-500"> · {m.user.studentId}</span> : null}</span>
                </label>
              ))}
              {members && !current.length && <p className="text-sm text-slate-500 py-4 text-center">No current students in this cohort.</p>}
            </div>
            <div>
              <label htmlFor="move-to" className="block text-sm font-medium text-slate-800 dark:text-gray-300 mb-1">Move to</label>
              <select id="move-to" value={toId} onChange={(e) => setToId(e.target.value)} className={selectCls}>
                <option value="">Pick a cohort…</option>
                {cohorts.filter((c) => c.id !== from?.id && c.status !== 'CANCELLED').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1 text-sm text-slate-800 dark:text-gray-200">
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="move-mode" checked={mode === 'MOVE'} onChange={() => setMode('MOVE')} /> Move — they leave {from?.name}</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="move-mode" checked={mode === 'ADD'} onChange={() => setMode('ADD')} /> Also add — they stay in both</label>
            </div>
            <div className="flex justify-end">
              <Button disabled={!n || !toId} onClick={() => setConfirming(true)}>{mode === 'MOVE' ? `Move ${who}` : `Add ${who}`}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function TimelineModal({ cohort, schoolId, onClose }: { cohort: Cohort | null; schoolId?: string; onClose: () => void }) {
  const { data } = useApi<AuditEvent[]>(cohort ? `/audit?cohortId=${cohort.id}&schoolId=${schoolId}` : null);
  return (
    <Modal open={!!cohort} onClose={onClose} title={cohort ? `History — ${cohort.name}` : 'History'}>
      <div className="max-h-[60vh] overflow-y-auto"><AuditTimeline events={data} /></div>
    </Modal>
  );
}

interface Syndicate { id: string; name: string; members: { userId: string; user: { id: string; firstName: string; lastName: string } }[]; _count: { classes: number } }

/** P9 (A8.3) — syndicate groups (6–8 peers, permanent) inside a cohort; breakout sessions target one.
 * A student sits in one syndicate per cohort; only ACTIVE members can join. */
function SyndicatesModal({ cohort, schoolId, onClose }: { cohort: Cohort | null; schoolId?: string; onClose: () => void }) {
  const q = schoolId ? `?schoolId=${schoolId}` : '';
  const { data: groups, refetch } = useApi<Syndicate[]>(cohort ? `/academic/cohorts/${cohort.id}/groups${q}` : null);
  const { data: members } = useApi<CohortMember[]>(cohort ? `/academic/cohorts/${cohort.id}/members${q}` : null);
  const { mutate: post } = useMutation('post');
  const { mutate: put } = useMutation('put');
  const { mutate: del } = useMutation('delete');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); refetch(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); } };
  const active = (members ?? []).filter((m) => m.status === 'ACTIVE');
  const taken = new Map<string, string>();
  for (const g of groups ?? []) for (const m of g.members) taken.set(m.userId, g.id);
  return (
    <Modal open={!!cohort} onClose={onClose} title={cohort ? `Syndicates — ${cohort.name}` : 'Syndicates'}>
      <div className="space-y-3" data-testid="syndicates-modal">
        <div className="flex gap-2">
          <Input label="" placeholder="New syndicate name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" disabled={!name.trim()} onClick={() => void run(async () => { await post(`/academic/cohorts/${cohort!.id}/groups${q}`, { name: name.trim() }); setName(''); })}>Add</Button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {(groups ?? []).map((g) => (
          <div key={g.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
            <div className="flex justify-between items-center">
              <p className="font-medium text-sm">{g.name} <span className="text-xs text-slate-500">· {g.members.length} members · {g._count.classes} breakout sessions</span></p>
              <div className="space-x-2 text-xs">
                <button className="text-blue-600 cursor-pointer" onClick={() => { setEditing(g.id); setPicked(g.members.map((m) => m.userId)); }}>Members</button>
                <button className="text-red-500 cursor-pointer" onClick={() => void run(() => del(`/academic/cohort-groups/${g.id}${q}`))}>Delete</button>
              </div>
            </div>
            {editing === g.id ? (
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {active.map((m) => {
                  const elsewhere = taken.has(m.userId) && taken.get(m.userId) !== g.id;
                  return (
                    <label key={m.userId} className={`flex items-center gap-2 text-sm ${elsewhere ? 'opacity-50' : ''}`}>
                      <input type="checkbox" disabled={elsewhere} checked={picked.includes(m.userId)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.userId] : picked.filter((x) => x !== m.userId))} />
                      {m.user.firstName} {m.user.lastName}{elsewhere ? ' (another syndicate)' : ''}
                    </label>
                  );
                })}
                <Button size="sm" onClick={() => void run(async () => { await put(`/academic/cohort-groups/${g.id}/members${q}`, { userIds: picked }); setEditing(null); })}>Save members</Button>
              </div>
            ) : g.members.length > 0 && <p className="text-xs text-slate-500 mt-1">{g.members.map((m) => `${m.user.firstName} ${m.user.lastName}`).join(', ')}</p>}
          </div>
        ))}
        {!groups?.length && <p className="text-sm text-slate-500 text-center py-3">No syndicates yet — they are optional.</p>}
      </div>
    </Modal>
  );
}

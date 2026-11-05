import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Activity, Download, Fingerprint, RotateCcw, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { ROLE_LABEL } from '../../shared/roles';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Card, Tile } from '../insights/InsightsUi';
import { Placeholder, Segmented, Skeleton, inputCls, labelCls, tdCls, thCls } from '../platform/PlatformUi';

/**
 * 11-02 — one school's audit trail as a page: who did what, to what, when, with the before/after.
 * Used twice: the Super Admin's Audit log (/platform/audit — picks a school; opening it is recorded in
 * that school's trail) and the School Admin's (/admin/audit — their own school).
 */

export type AuditCategory = 'structure' | 'people' | 'assignments' | 'classes' | 'tickets' | 'messages' | 'tali' | 'platform';

export interface AuditRow {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: string;
  actorName: string | null;
  action: string;
  category: AuditCategory;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  subjectUserId: string | null;
  subjectName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  requestId: string | null;
}
interface Page { items: AuditRow[]; nextCursor: string | null }
interface Facets {
  total: number;
  categories: Partial<Record<AuditCategory, number>>;
  actions: { action: string; category: AuditCategory; count: number }[];
  roles: { role: string; count: number }[];
  actors: { id: string; name: string | null; role: string | null; count: number }[];
}

const CATEGORY: Record<AuditCategory, { label: string; dot: string }> = {
  structure: { label: 'Structure', dot: 'bg-blue-500' },
  people: { label: 'People', dot: 'bg-emerald-500' },
  assignments: { label: 'Assignments', dot: 'bg-cyan-500' },
  classes: { label: 'Classes & attendance', dot: 'bg-amber-500' },
  tickets: { label: 'Tickets', dot: 'bg-orange-500' },
  messages: { label: 'Messages', dot: 'bg-rose-500' },
  tali: { label: 'TALI', dot: 'bg-purple-500' },
  platform: { label: 'Platform', dot: 'bg-slate-500' },
};

// What each action's first part refers to, in words.
const NOUN: Record<string, string> = {
  orgUnit: 'Department', programme: 'Programme', cohort: 'Cohort', campus: 'Campus', account: 'Account', membership: 'Membership',
  institution: 'Institution', groupView: 'Group view', manager: 'Manager', agentAction: 'TALI action', agentSettings: 'TALI settings',
  supportGrant: 'Support access', support: 'Support', school: 'School', cohortMember: 'Cohort member', cohortGroup: 'Cohort group',
  ticket: 'Facility ticket', escalation: 'Escalation', conversation: 'Conversation', messageFlag: 'Message flag', onboarding: 'Onboarding',
  supportTicket: 'Support ticket', billing: 'Billing', logo: 'Logo', tali: 'TALI', class: 'Class', attendance: 'Attendance', platform: 'Platform',
};
// Actions whose generic "<Noun> <verb>" reading is wrong or unclear.
const SPECIAL: Record<string, string> = {
  'support.action': 'Platform acted under support access',
  'platform.auditViewed': 'Platform viewed the audit log',
  'cohort.cemAssigned': 'CEM assigned to cohort',
  'cohort.cemUnassigned': 'CEM removed from cohort',
  'account.passwordSet': 'Password set',
  'account.actingHodGranted': 'Acting HOD granted',
  'account.actingHodRevoked': 'Acting HOD revoked',
  'ticket.managerInformedTwice': 'Facility ticket: manager told twice',
  'escalation.checkedIn': 'Student checked in from escalation',
  'onboarding.nudged': 'Setup reminder sent',
  'billing.planChanged': 'Billing plan changed',
  'tali.switchesChanged': 'TALI switched on/off',
  'class.online': 'Class moved online',
  'class.inPerson': 'Class moved in person',
  'attendance.corrected': 'Attendance corrected by hand',
  'school.tiersChanged': 'Data-sharing tiers changed',
  'school.onboardingCompleted': 'Onboarding completed',
  'school.checkoutPolicyChanged': 'Check-out policy changed',
};
const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\bhod\b/g, 'HOD').replace(/\bcem\b/g, 'CEM');
export function actionLabel(action: string) {
  if (SPECIAL[action]) return SPECIAL[action];
  const [noun, verb = ''] = action.split('.');
  return `${NOUN[noun] ?? words(noun)} ${words(verb)}`.trim();
}
const roleLabel = (r: string | null | undefined) => (!r || r === 'SYSTEM' ? 'System' : (ROLE_LABEL as Record<string, string>)[r] ?? words(r));

const PERIODS = [
  { key: '1', label: '24 hours' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: 'all', label: 'All time' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

const fmtValue = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString() : v;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map(fmtValue).join(', ') : '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

/** Each changed field once: before → after (fields only on one side show "—" on the other). */
function changes(r: AuditRow) {
  const keys = [...new Set([...Object.keys(r.before ?? {}), ...Object.keys(r.after ?? {})])];
  return keys.map((k) => ({ key: k, label: words(k), before: r.before?.[k], after: r.after?.[k], inBefore: !!r.before && k in r.before }));
}

const ago = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return new Date(iso).toLocaleDateString();
};

export function AuditLogView({ base, schoolId, schoolName }: {
  /** '/platform/audit' (Super Admin, needs schoolId) or '/audit/events' (School Admin, own school). */
  base: string;
  schoolId?: string;
  schoolName?: string;
}) {
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [category, setCategory] = useState<AuditCategory | ''>('');
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [idQuery, setIdQuery] = useState('');
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<AuditRow | null>(null);
  const [exporting, setExporting] = useState(false);

  // "from" is fixed when the period changes, so paging doesn't drift as the clock moves.
  const from = useMemo(() => (period === 'all' ? '' : new Date(Date.now() - Number(period) * 86_400_000).toISOString()), [period]);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (schoolId) p.set('schoolId', schoolId);
    if (from) p.set('from', from);
    if (action) p.set('action', action);
    else if (category) p.set('category', category);
    if (actorId) p.set('actorId', actorId);
    if (actorRole) p.set('actorRole', actorRole);
    if (idQuery.trim()) p.set('id', idQuery.trim());
    return p;
  }, [schoolId, from, category, action, actorId, actorRole, idQuery]);

  const facetsParams = new URLSearchParams();
  if (schoolId) facetsParams.set('schoolId', schoolId);
  if (from) facetsParams.set('from', from);
  const { data: facets } = useApi<Facets>(`${base}/facets?${facetsParams}`);

  useEffect(() => {
    let live = true;
    setRows(null); setCursor(null); setError('');
    api.get<Page>(`${base}?${query}`).then((p) => { if (live) { setRows(p.items); setCursor(p.nextCursor); } })
      .catch((e) => { if (live) { setRows([]); setError(e instanceof Error ? e.message : 'Could not load the audit log'); } });
    return () => { live = false; };
  }, [base, query]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const p = new URLSearchParams(query); p.set('cursor', cursor);
      const page = await api.get<Page>(`${base}?${p}`);
      setRows((r) => [...(r ?? []), ...page.items]); setCursor(page.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load more'); } finally { setLoadingMore(false); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await api.getText(`${base}/export?${query}`);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `audit-log${schoolName ? `-${schoolName.replace(/[^\w-]+/g, '-')}` : ''}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed'); } finally { setExporting(false); }
  };

  const filtered = !!(category || action || actorId || actorRole || idQuery.trim());
  const reset = () => { setCategory(''); setAction(''); setActorId(''); setActorRole(''); setIdQuery(''); };
  const actionsShown = (facets?.actions ?? []).filter((a) => !category || a.category === category);
  const top = facets?.actions[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="Events" value={facets ? facets.total.toLocaleString() : '—'} icon={<Activity size={18} />} color="blue" basis={PERIODS.find((p) => p.key === period)?.label} />
        <Tile label="People who made changes" value={facets ? String(facets.actors.length) : '—'} icon={<Users size={18} />} color="green" basis="Signed-in accounts; automatic jobs not counted" />
        <Tile label="Most frequent" value={top ? actionLabel(top.action) : '—'} icon={<Fingerprint size={18} />} color="purple" basis={top ? `${top.count.toLocaleString()} times` : undefined} />
      </div>

      <Card
        title="Events"
        subtitle="Newest first. Click a row for the full before and after."
        action={<Button variant="secondary" size="sm" onClick={() => void exportCsv()} disabled={exporting}><Download size={14} className="mr-1.5" />{exporting ? 'Exporting…' : 'Export CSV'}</Button>}
      >
        <div className="space-y-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ key: p.key, label: p.label }))} />
          </div>
          <Segmented<AuditCategory | ''>
            label="Category"
            value={category}
            onChange={(c) => { setCategory(c); setAction(''); }}
            options={[
              { key: '', label: 'All', count: facets?.total },
              ...(Object.keys(CATEGORY) as AuditCategory[]).filter((c) => facets?.categories[c]).map((c) => ({ key: c, label: CATEGORY[c].label, count: facets?.categories[c] })),
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Action</label>
              <SearchableSelect
                value={action}
                onChange={setAction}
                placeholder="Any action"
                options={[{ value: '', label: 'Any action' }, ...actionsShown.map((a) => ({ value: a.action, label: actionLabel(a.action), sublabel: `${a.count.toLocaleString()} · ${CATEGORY[a.category].label}` }))]}
              />
            </div>
            <div>
              <label className={labelCls}>Who</label>
              <SearchableSelect
                value={actorId}
                onChange={setActorId}
                placeholder="Anyone"
                options={[{ value: '', label: 'Anyone' }, ...(facets?.actors ?? []).map((a) => ({ value: a.id, label: a.name ?? 'Deleted account', sublabel: `${roleLabel(a.role)} · ${a.count.toLocaleString()}` }))]}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="audit-role">Role</label>
              <select id="audit-role" value={actorRole} onChange={(e) => setActorRole(e.target.value)} className={inputCls}>
                <option value="">Any role</option>
                {(facets?.roles ?? []).map((r) => <option key={r.role} value={r.role}>{roleLabel(r.role)} ({r.count.toLocaleString()})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="audit-id">Record ID</label>
              <input id="audit-id" value={idQuery} onChange={(e) => setIdQuery(e.target.value)} placeholder="Account, cohort or record ID" className={inputCls} />
            </div>
          </div>
          {filtered && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              <RotateCcw size={12} /> Clear filters
            </button>
          )}
        </div>

        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        {!rows ? <Skeleton rows={6} /> : rows.length === 0 ? (
          <Placeholder icon={<Activity size={22} />} title={filtered ? 'Nothing matches these filters' : 'No events in this period'}>
            {filtered ? 'Try a wider period or clear the filters.' : 'Changes made in this school will appear here.'}
          </Placeholder>
        ) : (
          <>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full">
                <thead>
                  <tr><th className={thCls}>When</th><th className={thCls}>Who</th><th className={thCls}>Action</th><th className={thCls}>On</th><th className={thCls}>Change</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ch = changes(r);
                    return (
                      <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-white/[0.03]" data-testid="audit-row">
                        <td className={clsx(tdCls, 'whitespace-nowrap')} title={new Date(r.at).toLocaleString()}>
                          <p className="text-slate-900 dark:text-white">{ago(r.at)}</p>
                          <p className="text-xs text-slate-500">{new Date(r.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </td>
                        <td className={tdCls}>
                          <p className="font-medium text-slate-900 dark:text-white">{r.actorName ?? (r.actorId ? 'Deleted account' : 'System')}</p>
                          <p className="text-xs text-slate-500">{roleLabel(r.actorRole)}</p>
                        </td>
                        <td className={tdCls}>
                          <span className="inline-flex items-center gap-2">
                            <span className={clsx('w-2 h-2 rounded-full shrink-0', CATEGORY[r.category].dot)} aria-hidden />
                            <span className="font-medium text-slate-900 dark:text-white">{actionLabel(r.action)}</span>
                          </span>
                          <p className="text-xs text-slate-500 pl-4">{CATEGORY[r.category].label}</p>
                        </td>
                        <td className={tdCls}>
                          <p className="text-slate-900 dark:text-white">{r.entityLabel ?? r.subjectName ?? <span className="text-slate-500">{words(r.entityType)}</span>}</p>
                          <p className="text-xs text-slate-500">
                            {words(r.entityType)}
                            {r.subjectName && r.subjectName !== r.entityLabel ? ` · ${r.subjectName}` : ''}
                            {r.cohortName && r.cohortName !== r.entityLabel ? ` · ${r.cohortName}` : ''}
                          </p>
                        </td>
                        <td className={clsx(tdCls, 'max-w-xs')}>
                          {ch.length === 0 ? <span className="text-slate-400">{r.reason ?? '—'}</span> : (
                            <ul className="space-y-0.5 text-xs">
                              {ch.slice(0, 2).map((c) => (
                                <li key={c.key} className="truncate">
                                  <span className="text-slate-500">{c.label}: </span>
                                  {c.inBefore && <><span className="line-through text-slate-400">{fmtValue(c.before)}</span> → </>}
                                  <span className="text-slate-900 dark:text-white">{fmtValue(c.after)}</span>
                                </li>
                              ))}
                              {ch.length > 2 && <li className="text-slate-400">+{ch.length - 2} more</li>}
                            </ul>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-4 text-xs text-slate-500">
              <span>Showing {rows.length.toLocaleString()}{facets && !filtered ? ` of ${facets.total.toLocaleString()}` : ''}</span>
              {cursor && <Button variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>}
            </div>
          </>
        )}
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? actionLabel(open.action) : ''}>
        {open && <AuditDetail row={open} />}
      </Modal>
    </div>
  );
}

function AuditDetail({ row: r }: { row: AuditRow }) {
  const ch = changes(r);
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-gray-100 dark:border-white/5 text-sm">
      <dt className="text-slate-500">{label}</dt><dd className="col-span-2 text-slate-900 dark:text-white break-words">{children}</dd>
    </div>
  );
  return (
    <div className="space-y-5" data-testid="audit-detail">
      <dl>
        <Field label="When">{new Date(r.at).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' })}</Field>
        <Field label="Who">{r.actorName ?? (r.actorId ? 'Deleted account' : 'System')} <span className="text-slate-500">· {roleLabel(r.actorRole)}</span></Field>
        <Field label="Category">{CATEGORY[r.category].label}</Field>
        <Field label="On">{r.entityLabel ?? '—'} <span className="text-slate-500">· {words(r.entityType)}</span></Field>
        {r.subjectName && <Field label="Person affected">{r.subjectName}</Field>}
        {r.cohortName && <Field label="Cohort">{r.cohortName}</Field>}
        {r.reason && <Field label="Reason">{r.reason}</Field>}
      </dl>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">What changed</p>
        {ch.length === 0 ? <p className="text-sm text-slate-500">No field-level change recorded for this action.</p> : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 dark:bg-white/5"><th className={thCls}>Field</th><th className={thCls}>Before</th><th className={thCls}>After</th></tr></thead>
              <tbody>
                {ch.map((c) => (
                  <tr key={c.key}>
                    <td className={tdCls}>{c.label}</td>
                    <td className={clsx(tdCls, 'text-slate-500')}>{c.inBefore ? fmtValue(c.before) : '—'}</td>
                    <td className={clsx(tdCls, 'font-medium')}>{fmtValue(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer select-none">Technical details</summary>
        <dl className="mt-2 space-y-1 font-mono">
          <div>event: {r.id}</div>
          <div>action: {r.action}</div>
          <div>{r.entityType}: {r.entityId}</div>
          {r.actorId && <div>actor: {r.actorId}</div>}
          {r.subjectUserId && <div>subject: {r.subjectUserId}</div>}
          {r.cohortId && <div>cohort: {r.cohortId}</div>}
          {r.requestId && <div>request: {r.requestId}</div>}
        </dl>
      </details>
    </div>
  );
}

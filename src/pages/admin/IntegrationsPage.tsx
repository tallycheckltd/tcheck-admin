import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi, useMutation } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import {
  Plug, RefreshCw, UploadCloud, Unplug, CheckCircle2, XCircle, Clock, AlertTriangle,
  GraduationCap, BookOpenCheck, Cloud, ArrowRight, Sparkles, Link2, Network, Presentation, Building2,
  ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ReviewSync } from '../../components/integrations/ReviewSync';
import type { IntegrationConnection, IntegrationProvider, Course } from '../../types';
import { MoodleCentre } from '../../components/integrations/MoodleCentre';
import { MicrosoftSignIn } from '../../components/integrations/MicrosoftSignIn';

type Category = 'LEARNING' | 'RECORDS' | 'REPORTING';
/** Real-ish brand colours per provider — purely cosmetic, makes each one instantly recognisable. */
const PROVIDER_META: Record<IntegrationProvider, {
  label: string;
  tagline: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  isRosterSource: boolean;
  category: Category;
  /** What it does, shown as chips. */
  imports: boolean;
  sendsAttendance: boolean;
}> = {
  MOODLE: {
    label: 'Moodle',
    tagline: 'Add Moodle enrolments to Tcheck; optionally write attendance to mod_attendance.',
    icon: BookOpenCheck, gradient: 'from-[#F98012] to-[#D96A0A]', isRosterSource: true, category: 'LEARNING', imports: true, sendsAttendance: true,
  },
  CANVAS: {
    label: 'Canvas',
    tagline: 'Pull terms, departments, courses and people from Canvas into Review sync (roster only for now).',
    icon: GraduationCap, gradient: 'from-[#E4572E] to-[#C43D22]', isRosterSource: true, category: 'LEARNING', imports: true, sendsAttendance: false,
  },
  BLACKBOARD: {
    label: 'Blackboard',
    tagline: 'Pull terms, departments, courses and people from Blackboard Learn into Review sync; write present / late to Blackboard attendance.',
    icon: Presentation, gradient: 'from-[#262626] to-[#000000]', isRosterSource: false, category: 'LEARNING', imports: true, sendsAttendance: true,
  },
  ONEROSTER: {
    label: 'OneRoster',
    tagline: 'Pull departments, terms, classes and people from your student information system (OneRoster 1.1 or 1.2) into Review sync.',
    icon: Network, gradient: 'from-[#4F46E5] to-[#3730A3]', isRosterSource: false, category: 'RECORDS', imports: true, sendsAttendance: false,
  },
  BUSINESS_CENTRAL: {
    label: 'Business Central',
    tagline: 'Pull semesters, departments, units, students and lecturers from Microsoft Dynamics 365 Business Central or Dynamics NAV into Review sync (read-only).',
    icon: Building2, gradient: 'from-[#0B6A8A] to-[#002050]', isRosterSource: false, category: 'RECORDS', imports: true, sendsAttendance: false,
  },
  SALESFORCE: {
    label: 'Salesforce',
    tagline: 'Send finished attendance to your Salesforce org for reporting — one row per student per session.',
    icon: Cloud, gradient: 'from-[#00A1E0] to-[#0077B5]', isRosterSource: false, category: 'REPORTING', imports: false, sendsAttendance: true,
  },
};
const PROVIDER_ORDER = Object.keys(PROVIDER_META) as IntegrationProvider[];
const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'LEARNING', label: 'Learning systems', hint: 'Where courses and enrolments live (LMS)' },
  { key: 'RECORDS', label: 'Student records', hint: 'Registry, ERP or student information system' },
  { key: 'REPORTING', label: 'Reporting', hint: 'Where attendance is reported (CRM)' },
];
/** P7 — providers that can fill the institution through Review sync. */
const DIRECTORY_PROVIDERS: IntegrationProvider[] = ['MOODLE', 'CANVAS', 'ONEROSTER', 'BLACKBOARD', 'BUSINESS_CENTRAL'];
/** Attendance can be sent from the card ("Export Attendance"): not Moodle (its centre does it), not the read-only / roster-only ones. */
const CAN_EXPORT = (p: IntegrationProvider) => p === 'SALESFORCE' || p === 'BLACKBOARD';

const STATUS_META: Record<NonNullable<IntegrationConnection['lastSyncStatus']>, { label: string; color: 'green' | 'yellow' | 'red'; icon: React.ComponentType<{ size?: number }> }> = {
  SUCCESS: { label: 'Synced', color: 'green', icon: CheckCircle2 },
  PARTIAL: { label: 'Partial', color: 'yellow', icon: AlertTriangle },
  FAILED: { label: 'Failed', color: 'red', icon: XCircle },
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ProviderIcon({ provider, size = 'md' }: { provider: IntegrationProvider; size?: 'sm' | 'md' }) {
  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;
  return (
    <div className={clsx('rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg', meta.gradient, size === 'sm' ? 'w-8 h-8 rounded-xl' : 'w-11 h-11')}>
      <Icon size={size === 'sm' ? 15 : 20} className="text-white" />
    </div>
  );
}

function Capabilities({ provider }: { provider: IntegrationProvider }) {
  const meta = PROVIDER_META[provider];
  return (
    <div className="flex flex-wrap gap-1.5">
      {meta.imports && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><ArrowDownToLine size={11} /> Imports courses &amp; people</span>}
      {meta.sendsAttendance && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><ArrowUpFromLine size={11} /> Sends attendance</span>}
      {!meta.sendsAttendance && meta.imports && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-slate-600 dark:bg-white/5 dark:text-slate-400">Read-only</span>}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h2>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function IntegrationsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [schoolId, setSchoolId] = useState(user?.schoolId ?? '');
  const { data: schools } = useApi<{ id: string; name: string }[]>(isSuperAdmin ? '/schools' : null);
  // Staff sign-in shows only once Sign in with Microsoft is set up on this server (MICROSOFT_CLIENT_ID/_SECRET).
  const { data: microsoft } = useApi<{ serverReady: boolean }>(isSuperAdmin ? null : '/integrations/microsoft');
  const effectiveSchoolId = isSuperAdmin ? schoolId : (user?.schoolId ?? '');

  const { data: connections, refetch } = useApi<IntegrationConnection[]>(
    effectiveSchoolId ? `/integrations/connections?schoolId=${effectiveSchoolId}` : null,
  );
  const refetchConnections = useCallback(() => { void refetch(); }, [refetch]);
  const { data: courses } = useApi<Course[]>(effectiveSchoolId ? `/courses?schoolId=${effectiveSchoolId}` : null);

  const [connectProvider, setConnectProvider] = useState<IntegrationProvider | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ provider: IntegrationProvider; message: string; ok: boolean } | null>(null);
  const [selected, setSelected] = useState<IntegrationProvider | null>(null);

  const { mutate: createConnection } = useMutation('post');
  const { mutate: deleteConnection } = useMutation('delete');
  const { mutate: postAction } = useMutation('post');
  const { mutate: patchAction } = useMutation('patch');
  const setNightly = async (provider: IntegrationProvider, id: string, on: boolean) => {
    try {
      await patchAction(`/integrations/connections/${id}/nightly-export`, { nightlyExport: on });
      setActionResult({ provider, ok: true, message: on ? 'Attendance will be sent every night.' : 'Nightly attendance sending is off. "Export Attendance" still sends on demand.' });
    } catch (e) {
      setActionResult({ provider, ok: false, message: e instanceof Error ? e.message : 'Could not save' });
    }
    refetch();
  };

  const byProvider = (provider: IntegrationProvider) => connections?.find((c) => c.provider === provider) ?? null;
  const connected = PROVIDER_ORDER.filter((p) => byProvider(p));
  const available = PROVIDER_ORDER.filter((p) => !byProvider(p));
  // The open tab: the one picked, else the first that needs attention, else the first connected.
  const active = selected && connected.includes(selected) ? selected : (connected.find((p) => (byProvider(p)?.pendingReview ?? 0) > 0) ?? connected[0] ?? null);
  const totalToReview = connected.reduce((n, p) => n + (byProvider(p)?.pendingReview ?? 0), 0);

  const runAction = async (provider: IntegrationProvider, connectionId: string, path: string, label: string) => {
    setBusyProvider(provider);
    setActionResult(null);
    try {
      const result = await postAction(`/integrations/connections/${connectionId}/${path}`, {});
      setActionResult({ provider, ok: true, message: summarizeResult(path, result) });
      refetch();
    } catch (e) {
      setActionResult({ provider, ok: false, message: e instanceof Error ? e.message : `${label} failed` });
    } finally {
      setBusyProvider(null);
    }
  };

  const [disconnecting, setDisconnecting] = useState<{ provider: IntegrationProvider; id: string } | null>(null);
  const handleDisconnect = async () => {
    if (!disconnecting) return;
    await deleteConnection(`/integrations/connections/${disconnecting.id}`);
    setDisconnecting(null);
    refetch();
  };

  /** Everything about one connected integration, in one place. */
  const workspace = (provider: IntegrationProvider) => {
    const meta = PROVIDER_META[provider];
    const connection = byProvider(provider)!;
    const statusMeta = connection.lastSyncStatus ? STATUS_META[connection.lastSyncStatus] : null;
    const isBusy = busyProvider === provider;
    const unmatched = provider === 'CANVAS' ? connection.lastSyncSummary?.coursesUnmatched ?? [] : [];
    return (
      <div className="space-y-5" data-testid={`integration-${provider}`}>
        <div className="glass-card p-0 overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${meta.gradient}`} />
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-4 flex-wrap">
              <ProviderIcon provider={provider} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-white">{meta.label}</h3>
                  <Badge color="blue">Connected</Badge>
                  {statusMeta && <Badge color={statusMeta.color}><statusMeta.icon size={11} /> {statusMeta.label}</Badge>}
                  {!!connection.pendingReview && <Badge color="yellow">{connection.pendingReview} to review</Badge>}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">{meta.tagline}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Capabilities provider={provider} />
                  <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Clock size={12} /> Last synced <span className="font-medium text-slate-800 dark:text-slate-200">{timeAgo(connection.lastSyncedAt)}</span></span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void runAction(provider, connection.id, 'test', 'Test')}>
                  {isBusy ? 'Working…' : 'Test'}
                </Button>
                {/* SBS Phase 7: Moodle syncs run from the Moodle integration centre below. */}
                {meta.isRosterSource && provider !== 'MOODLE' && (
                  <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void runAction(provider, connection.id, 'sync-roster', 'Sync')}>
                    <RefreshCw size={13} className="mr-1" /> Sync Roster
                  </Button>
                )}
                {CAN_EXPORT(provider) && (
                  <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void runAction(provider, connection.id, 'export-attendance', 'Export')}>
                    <UploadCloud size={13} className="mr-1" /> Export Attendance
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => setDisconnecting({ provider, id: connection.id })}>
                  <Unplug size={13} className="mr-1" /> Disconnect
                </Button>
              </div>
            </div>

            {(provider === 'SALESFORCE' || provider === 'BLACKBOARD') && (
              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 border-t border-gray-100 dark:border-white/5 pt-3">
                <input type="checkbox" className="mt-0.5" checked={(connection.config as { nightlyExport?: boolean })?.nightlyExport === true} onChange={(e) => void setNightly(provider, connection.id, e.target.checked)} />
                <span>Send attendance every night<span className="block text-[11px] text-slate-500">{provider === 'BLACKBOARD' ? 'Present / late into the attendance sessions lecturers create in Blackboard. Absences and existing marks are never touched.' : 'One record per student per session in Salesforce; corrections update the same record.'}</span></span>
              </label>
            )}
            {connection.lastSyncError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5">{connection.lastSyncError}</p>
            )}
            {actionResult?.provider === provider && (
              <p role="status" className={`text-xs ${actionResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{actionResult.message}</p>
            )}
          </div>
        </div>

        {/* SBS Phase 7 — Moodle integration centre (status, syncs, review, write-back, history). */}
        {provider === 'MOODLE' && <MoodleCentre connectionId={connection.id} courses={courses ?? []} onChanged={refetchConnections} />}

        {/* P7 (A6.3) — Review sync for every connection that can fill the institution. */}
        {DIRECTORY_PROVIDERS.includes(provider) && (
          <ReviewSync key={provider} connectionId={connection.id} providerLabel={meta.label} hasCohorts={provider !== 'ONEROSTER' && provider !== 'BLACKBOARD'} onChanged={refetchConnections} setupOnly={provider === 'MOODLE' && (courses?.length ?? 0) > 0} />
        )}

        {/* Unmatched courses — the manual-mapping fallback for a Canvas roster sync whose LMS code didn't match a Tcheck Course.code. */}
        {unmatched.length > 0 && (
          <UnmatchedCoursesPanel provider={provider} connectionId={connection.id} unmatched={unmatched} courses={courses ?? []} onMapped={refetch} />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Sparkles size={22} className="text-blue-500" /> Integrations
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Connect Tcheck to your institution's systems — bring in courses and people automatically, send attendance back where your staff already look.
          </p>
        </div>
        {isSuperAdmin && (
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
          >
            <option value="">Select an institution…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {!effectiveSchoolId ? (
        <div className="glass-card p-10 text-center">
          <Plug size={28} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Pick an institution above to manage its integrations.</p>
        </div>
      ) : (
        <>
          {/* 1 — Connected: one tab per integration, its whole workspace below. */}
          <section className="space-y-4" aria-labelledby="connected-integrations">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SectionTitle title={`Your integrations${connected.length ? ` · ${connected.length}` : ''}`} hint={totalToReview ? `${totalToReview} item${totalToReview === 1 ? '' : 's'} waiting for your review` : undefined} />
            </div>
            {connected.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-2">
                <Plug size={26} className="mx-auto text-slate-400" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Nothing connected yet</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">Pick the system your institution already uses below. Nothing in TCheck changes until you review and approve what comes in.</p>
              </div>
            ) : (
              <>
                <div role="tablist" aria-label="Connected integrations" className="flex gap-2 flex-wrap">
                  {connected.map((p) => {
                    const c = byProvider(p)!;
                    const on = p === active;
                    return (
                      <button
                        key={p} type="button" role="tab" aria-selected={on} onClick={() => setSelected(p)}
                        className={clsx('flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border text-sm transition-colors cursor-pointer',
                          on ? 'bg-white dark:bg-white/10 border-blue-400 dark:border-blue-400/60 text-slate-950 dark:text-white shadow-sm' : 'bg-transparent border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5')}
                      >
                        <ProviderIcon provider={p} size="sm" />
                        <span className="font-medium">{PROVIDER_META[p].label}</span>
                        {!!c.pendingReview && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">{c.pendingReview}</span>}
                        {c.lastSyncStatus === 'FAILED' && <XCircle size={14} className="text-red-500" aria-label="Last sync failed" />}
                      </button>
                    );
                  })}
                </div>
                {active && workspace(active)}
              </>
            )}
          </section>

          {/* 2 — Staff sign-in. The school's own admin only (Super Admin views other schools here). */}
          {!isSuperAdmin && microsoft?.serverReady && (
            <section className="space-y-4" aria-labelledby="sign-in">
              <SectionTitle title="Staff sign-in" hint="How staff get into this dashboard" />
              <MicrosoftSignIn />
            </section>
          )}

          {/* 3 — Add an integration, grouped by what the system is. */}
          {available.length > 0 && (
            <section className="space-y-5" aria-labelledby="add-integration">
              <SectionTitle title="Add an integration" />
              {CATEGORIES.map((cat) => {
                const items = available.filter((p) => PROVIDER_META[p].category === cat.key);
                if (!items.length) return null;
                return (
                  <div key={cat.key} className="space-y-2.5">
                    <p className="text-xs text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-800 dark:text-slate-200">{cat.label}</span> — {cat.hint}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {items.map((p) => (
                        <div key={p} className="glass-card p-4 flex flex-col gap-3" data-testid={`available-${p}`}>
                          <div className="flex items-start gap-3">
                            <ProviderIcon provider={p} />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-slate-950 dark:text-white">{PROVIDER_META[p].label}</h3>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{PROVIDER_META[p].tagline}</p>
                            </div>
                          </div>
                          <Capabilities provider={p} />
                          <Button size="sm" onClick={() => setConnectProvider(p)} className="w-full mt-auto">
                            <Plug size={14} className="mr-1.5" /> Connect {PROVIDER_META[p].label}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {disconnecting && (
        <Modal open onClose={() => setDisconnecting(null)} title={`Disconnect ${PROVIDER_META[disconnecting.provider].label}?`}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">The stored sign-in details are deleted and syncing stops. Everything already in TCheck — courses, people, attendance — stays as it is.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDisconnecting(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => void handleDisconnect()}><Unplug size={13} className="mr-1" /> Disconnect</Button>
            </div>
          </div>
        </Modal>
      )}

      {connectProvider && (
        <ConnectModal
          provider={connectProvider}
          schoolId={effectiveSchoolId}
          onClose={() => setConnectProvider(null)}
          onSubmit={async (config, credentials) => {
            await createConnection('/integrations/connections', { schoolId: effectiveSchoolId, provider: connectProvider, config, credentials });
            setSelected(connectProvider); // land on the new integration's tab
            setConnectProvider(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function summarizeResult(path: string, result: unknown): string {
  const r = result as { ok?: boolean; detail?: string; coursesMatched?: number; coursesUnmatched?: unknown[]; enrollmentsCreated?: number; pushed?: number; recordsConsidered?: number };
  if (path === 'test') return r.ok ? (r.detail ?? 'Connection OK') : (r.detail ?? 'Connection failed');
  if (path === 'sync-roster') return `Matched ${r.coursesMatched ?? 0} course(s), ${r.coursesUnmatched?.length ?? 0} unmatched, ${r.enrollmentsCreated ?? 0} new enrollment(s).`;
  if (path === 'export-attendance') return `Considered ${r.recordsConsidered ?? 0} record(s), pushed ${r.pushed ?? 0}.`;
  return 'Done';
}

function UnmatchedCoursesPanel({
  provider,
  connectionId,
  unmatched,
  courses,
  onMapped,
}: {
  provider: IntegrationProvider;
  connectionId: string;
  unmatched: { externalId: string; name: string; code: string }[];
  courses: Course[];
  onMapped: () => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const { mutate: mapCourse, loading } = useMutation('post');

  const handleMap = async (externalId: string) => {
    const courseId = selections[externalId];
    if (!courseId) return;
    await mapCourse(`/integrations/connections/${connectionId}/map-course`, { externalId, courseId });
    onMapped();
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
          {PROVIDER_META[provider].label} — Unmatched Courses
        </h3>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
        These courses exist in {PROVIDER_META[provider].label} but their code didn't match any Tcheck course. Map each one by hand — Tcheck never creates a course automatically.
      </p>
      <div className="space-y-2.5">
        {unmatched.map((u) => (
          <div key={u.externalId} className="flex items-center gap-3 flex-wrap bg-gray-50 dark:bg-white/5 rounded-xl p-3">
            <div className="min-w-[160px]">
              <p className="text-sm font-medium text-slate-950 dark:text-white">{u.name}</p>
              <p className="text-xs text-slate-500 font-mono">{u.code}</p>
            </div>
            <div className="flex-1 min-w-[220px]">
              <SearchableSelect
                placeholder="Map to Tcheck course…"
                value={selections[u.externalId] ?? ''}
                onChange={(v) => setSelections((s) => ({ ...s, [u.externalId]: v }))}
                options={courses.map((c) => ({ value: c.id, label: c.name, sublabel: c.code }))}
              />
            </div>
            <Button size="sm" disabled={!selections[u.externalId] || loading} onClick={() => void handleMap(u.externalId)}>
              <Link2 size={13} className="mr-1" /> Map
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Blackboard: the school enters its address; TCheck's own Developer Portal app (one for all schools)
 * signs in, so the school's Learn admin only needs TCheck's Application ID. */
function BlackboardFields({ fields, setFields, set }: { fields: Record<string, string>; setFields: React.Dispatch<React.SetStateAction<Record<string, string>>>; set: (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const { data } = useApi<{ applicationId: string | null; configured: boolean }>('/integrations/providers/blackboard');
  const [copied, setCopied] = useState(false);
  const own = fields.ownApp === 'yes';
  return (
    <>
      <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Blackboard address" placeholder="https://school.blackboard.com" value={fields.baseUrl ?? ''} onChange={set('baseUrl')} />
      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 rounded-xl bg-gray-50 dark:bg-white/5 p-3">
        <p className="font-semibold text-slate-800 dark:text-slate-200">Ask your Blackboard administrator to enable TCheck first:</p>
        <p>Administrator Panel → <b>REST API Integrations → Create Integration</b> → Application ID:</p>
        {data?.applicationId ? (
          <div className="flex items-center gap-2">
            <code className="font-mono text-[11px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded px-2 py-1 select-all break-all">{data.applicationId}</code>
            <button type="button" className="text-blue-600 cursor-pointer shrink-0" onClick={() => { void navigator.clipboard?.writeText(data.applicationId!); setCopied(true); }}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        ) : <p className="text-amber-600">TCheck's Blackboard Application ID isn't set on this server — contact TCheck support.</p>}
        <p>Choose a dedicated Learn user for TCheck, End User Access = No, Authorized To Act As User = No. That user needs to view courses, enrolments, terms and the institutional hierarchy (and view / create course attendance for write-back).</p>
        <p>TCheck writes present → Present and late → Late into meetings lecturers create; absences and existing marks are never changed.</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input type="checkbox" checked={own} onChange={(e) => setFields((f) => ({ ...f, ownApp: e.target.checked ? 'yes' : '' }))} /> Advanced: we registered our own Developer Portal application
      </label>
      {own && (
        <>
          <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Application key" value={fields.applicationKey ?? ''} onChange={set('applicationKey')} />
          <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label="Secret" type="password" value={fields.secret ?? ''} onChange={set('secret')} />
        </>
      )}
    </>
  );
}

const BC_MAPPING_TEMPLATE = `{
  "students": { "set": "StudentList", "fields": { "id": "No", "studentNumber": "Registration_No", "firstName": "First_Name", "lastName": "Surname", "email": "E_Mail", "programme": "Programme", "intake": "Intake", "status": "Status" } },
  "lecturers": { "set": "LecturerList", "fields": { "id": "Code", "firstName": "First_Name", "lastName": "Surname", "email": "E_Mail" } },
  "units": { "set": "UnitList", "fields": { "id": "No", "code": "Unit_Code", "name": "Description", "departmentId": "Department_Code", "semesterId": "Semester", "lecturerId": "Lecturer_Code" } },
  "registrations": { "set": "UnitRegistrations", "fields": { "studentId": "Student_No", "unitId": "Unit_Code", "status": "Status" } },
  "semesters": { "set": "SemesterList", "fields": { "id": "Code", "name": "Description", "startDate": "Start_Date", "endDate": "End_Date" } },
  "departments": { "set": "DepartmentList", "fields": { "id": "Code", "name": "Name", "parentId": "Faculty_Code" } }
}`;

/** Business Central / NAV: where it runs (Microsoft cloud or the university's server) and how the student
 * tables are published (TCheck API pack, or the university's own pages + a field mapping). */
function BusinessCentralFields({ fields, setFields, set }: { fields: Record<string, string>; setFields: React.Dispatch<React.SetStateAction<Record<string, string>>>; set: (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const onprem = fields.bcDeployment === 'onprem';
  const custom = fields.bcRoute === 'odata';
  const choose = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v, ...(k === 'bcRoute' && v === 'odata' && !f.bcMapping ? { bcMapping: BC_MAPPING_TEMPLATE } : {}) }));
  const seg = (k: string, v: string, label: string, on: boolean) => (
    <button type="button" onClick={() => choose(k, v)} aria-pressed={on} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}>{label}</button>
  );
  return (
    <>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Where does it run?</p>
        <div className="flex gap-2">{seg('bcDeployment', 'online', 'Microsoft cloud (Business Central online)', !onprem)}{seg('bcDeployment', 'onprem', "University's own server (NAV / BC on-premises)", onprem)}</div>
      </div>
      {onprem ? (
        <>
          <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Server address (OData)" placeholder="https://erp.university.ac.ke:7048/BC" value={fields.baseUrl ?? ''} onChange={set('baseUrl')} />
          <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Company name (as in Business Central)" value={fields.company ?? ''} onChange={set('company')} />
          <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="User name for TCheck" value={fields.username ?? ''} onChange={set('username')} />
          <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label="Web service access key" type="password" value={fields.webServiceKey ?? ''} onChange={set('webServiceKey')} />
        </>
      ) : (
        <>
          <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Microsoft tenant id or university Microsoft domain" placeholder="university.ac.ke" value={fields.tenantId ?? ''} onChange={set('tenantId')} />
          <div className="grid grid-cols-2 gap-3">
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Environment" placeholder="Production" value={fields.environment ?? ''} onChange={set('environment')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Company name" value={fields.company ?? ''} onChange={set('company')} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={fields.ownApp === 'yes'} onChange={(e) => setFields((f) => ({ ...f, ownApp: e.target.checked ? 'yes' : '' }))} /> Advanced: we registered our own Microsoft app for TCheck
          </label>
          {fields.ownApp === 'yes' && (
            <>
              <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Application (client) id" value={fields.clientId ?? ''} onChange={set('clientId')} />
              <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label="Client secret" type="password" value={fields.clientSecret ?? ''} onChange={set('clientSecret')} />
            </>
          )}
        </>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">How are the student tables published?</p>
        <div className="flex gap-2">{seg('bcRoute', 'api', 'TCheck API pack (installed by our Microsoft partner)', !custom)}{seg('bcRoute', 'odata', 'Our own web services (field mapping)', custom)}</div>
      </div>
      {custom && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Field mapping — your page / web service names and field names</label>
          <textarea rows={8} spellCheck={false} autoComplete="off" value={fields.bcMapping ?? ''} onChange={(e) => setFields((f) => ({ ...f, bcMapping: e.target.value }))}
            className="w-full rounded-xl px-3 py-2 text-[11px] font-mono bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white" />
          <p className="text-[11px] text-slate-500">Tables you leave out use the TCheck API pack names. "Test" reads one row of each and names any field it can't find.</p>
        </div>
      )}
      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 rounded-xl bg-gray-50 dark:bg-white/5 p-3">
        {onprem
          ? <p>Your Business Central administrator creates a user for TCheck with a web service access key and the <b>TCHECK READ</b> permission set (read-only on the student tables).</p>
          : <p>Your Microsoft administrator approves TCheck for Business Central in your Microsoft directory, then in Business Central opens <b>Microsoft Entra Applications</b>, adds TCheck's app and gives it <b>TCHECK READ</b> (read-only on the student tables).</p>}
        <p>TCheck only reads. Semesters, departments, units, students, lecturers and unit registrations go to Review sync — nothing changes in TCheck until you approve. Your Microsoft partner's guide: "TCheck API pack" in TCheck's documentation.</p>
      </div>
    </>
  );
}

function ConnectModal({
  provider,
  schoolId,
  onClose,
  onSubmit,
}: {
  provider: IntegrationProvider;
  schoolId: string;
  onClose: () => void;
  onSubmit: (config: Record<string, unknown>, credentials: Record<string, unknown>) => Promise<void>;
}) {
  const meta = PROVIDER_META[provider];
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (provider === 'CANVAS') {
        await onSubmit(
          { domain: fields.domain, accountId: fields.accountId },
          { clientId: fields.clientId, clientSecret: fields.clientSecret, refreshToken: fields.refreshToken },
        );
      } else if (provider === 'MOODLE') {
        // SBS Phase 7: a pre-issued web-service token (no username/password); https address only.
        await onSubmit(
          { baseUrl: (fields.baseUrl ?? '').trim() },
          { token: (fields.token ?? '').trim() },
        );
      } else if (provider === 'BUSINESS_CENTRAL') {
        let entities: unknown;
        if (fields.bcRoute === 'odata' || fields.bcMapping?.trim()) {
          try { entities = fields.bcMapping?.trim() ? JSON.parse(fields.bcMapping) : undefined; } catch { throw new Error('The field mapping is not valid JSON'); }
        }
        const onprem = fields.bcDeployment === 'onprem';
        await onSubmit(
          { deployment: onprem ? 'onprem' : 'online', route: fields.bcRoute === 'odata' ? 'odata' : 'api', company: (fields.company ?? '').trim(),
            ...(onprem ? { baseUrl: (fields.baseUrl ?? '').trim() } : { tenantId: (fields.tenantId ?? '').trim(), environment: (fields.environment ?? '').trim() || 'Production' }),
            ...(entities ? { entities } : {}) },
          onprem ? { username: (fields.username ?? '').trim(), webServiceKey: fields.webServiceKey ?? '' }
            : fields.ownApp === 'yes' ? { clientId: (fields.clientId ?? '').trim(), clientSecret: fields.clientSecret ?? '' } : {},
        );
      } else if (provider === 'BLACKBOARD') {
        // Learn REST: the Developer Portal application key + secret, enabled by the school's Learn admin.
        // Normally TCheck's own registration is used (held on the server); "own app" is the exception.
        await onSubmit({ baseUrl: (fields.baseUrl ?? '').trim() }, fields.ownApp === 'yes' ? { applicationKey: (fields.applicationKey ?? '').trim(), secret: fields.secret ?? '' } : {});
      } else if (provider === 'ONEROSTER') {
        // P7: OneRoster 1.1 or 1.2 REST; OAuth 2.0 client credentials or OAuth 1.0a signed requests.
        await onSubmit(
          { baseUrl: (fields.baseUrl ?? '').trim(), version: fields.version || '1.1', auth: fields.auth || 'oauth2', ...(fields.auth !== 'oauth1' && fields.tokenUrl?.trim() ? { tokenUrl: fields.tokenUrl.trim() } : {}) },
          { clientId: (fields.clientId ?? '').trim(), clientSecret: fields.clientSecret ?? '' },
        );
      } else {
        await onSubmit(
          { orgDomain: (fields.orgDomain ?? '').trim(), apiVersion: fields.apiVersion || 'v66.0', targetObject: fields.targetObject || 'TCheck_Attendance__c' },
          { clientId: fields.clientId, username: fields.username, privateKey: fields.privateKey },
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Connect ${meta.label}`}>
      <div className="space-y-4">
        {!schoolId && <p className="text-sm text-red-500">Select an institution first.</p>}
        {/* Every field opts out of browser autofill: a saved TCheck password must never land in a
            token / secret field and be sent to the school's LMS (seen in testing, 2026-10-05). */}

        {provider === 'CANVAS' && (
          <>
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Canvas Domain" placeholder="school.instructure.com" value={fields.domain ?? ''} onChange={set('domain')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Account ID" placeholder="1" value={fields.accountId ?? ''} onChange={set('accountId')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Developer Key — Client ID" value={fields.clientId ?? ''} onChange={set('clientId')} />
            <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label="Developer Key — Client Secret" type="password" value={fields.clientSecret ?? ''} onChange={set('clientSecret')} />
            <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label="Refresh Token" type="password" value={fields.refreshToken ?? ''} onChange={set('refreshToken')} />
          </>
        )}

        {provider === 'MOODLE' && (
          <>
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Moodle address" placeholder="https://moodle.school.ac.ke" value={fields.baseUrl ?? ''} onChange={set('baseUrl')} />
            <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label="Web-service token" type="password" value={fields.token ?? ''} onChange={set('token')} />
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <p>In Moodle: Site administration → Server → Web services. Create an external service for Tcheck, add a token for a dedicated service account, and enable these functions:</p>
              <p className="font-mono text-[11px] leading-relaxed">core_webservice_get_site_info, core_course_get_courses, core_enrol_get_enrolled_users</p>
              <p>For attendance write-back (optional, needs mod_attendance): <span className="font-mono text-[11px]">mod_attendance_get_sessions, mod_attendance_get_session, mod_attendance_update_user_status</span></p>
              <p>To build your departments, terms and courses from Moodle with Review sync (optional): <span className="font-mono text-[11px]">core_course_get_categories, core_cohort_get_cohorts, core_cohort_get_cohort_members</span></p>
              <p>The token is encrypted in Tcheck and never shown again. Use "Test" afterwards to confirm every function is available.</p>
            </div>
          </>
        )}

        {provider === 'BLACKBOARD' && <BlackboardFields fields={fields} setFields={setFields} set={set} />}
        {provider === 'BUSINESS_CENTRAL' && <BusinessCentralFields fields={fields} setFields={setFields} set={set} />}

        {provider === 'ONEROSTER' && (
          <>
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="OneRoster base address" placeholder="https://sis.school.edu" value={fields.baseUrl ?? ''} onChange={set('baseUrl')} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Version
                <select value={fields.version ?? '1.1'} onChange={(e) => setFields((f) => ({ ...f, version: e.target.value }))} className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white">
                  <option value="1.1">OneRoster 1.1</option>
                  <option value="1.2">OneRoster 1.2</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sign-in
                <select value={fields.auth ?? 'oauth2'} onChange={(e) => setFields((f) => ({ ...f, auth: e.target.value }))} className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white">
                  <option value="oauth2">OAuth 2.0</option>
                  <option value="oauth1">OAuth 1.0a</option>
                </select>
              </label>
            </div>
            {fields.auth !== 'oauth1' && <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Token address (optional)" placeholder="https://sis.school.edu/oauth/token" value={fields.tokenUrl ?? ''} onChange={set('tokenUrl')} />}
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label={fields.auth === 'oauth1' ? 'Consumer key' : 'Client ID'} value={fields.clientId ?? ''} onChange={set('clientId')} />
            <Input autoComplete="new-password" data-1p-ignore data-lpignore="true" label={fields.auth === 'oauth1' ? 'Consumer secret' : 'Client secret'} type="password" value={fields.clientSecret ?? ''} onChange={set('clientSecret')} />
            <p className="text-xs text-slate-600 dark:text-slate-400">Your SIS vendor gives you these when they enable OneRoster for Tcheck. Read-only: Tcheck pulls departments, terms, classes and people into Review sync below — nothing changes until you approve. The secret is encrypted and never shown again.</p>
          </>
        )}

        {provider === 'SALESFORCE' && (
          <>
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Salesforce address" placeholder="yourorg.my.salesforce.com" value={fields.orgDomain ?? ''} onChange={set('orgDomain')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="API version" placeholder="v66.0" value={fields.apiVersion ?? ''} onChange={set('apiVersion')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Object" placeholder="TCheck_Attendance__c" value={fields.targetObject ?? ''} onChange={set('targetObject')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="External Client App — consumer key" value={fields.clientId ?? ''} onChange={set('clientId')} />
            <Input autoComplete="off" data-1p-ignore data-lpignore="true" label="Integration user (username)" value={fields.username ?? ''} onChange={set('username')} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Private key (PEM) — pairs with the certificate uploaded to the app</label>
              <textarea
                rows={4}
                value={fields.privateKey ?? ''}
                onChange={(e) => setFields((f) => ({ ...f, privateKey: e.target.value }))}
                placeholder="-----BEGIN PRIVATE KEY-----"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-mono bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">TCheck sends each finished session's present / late marks: student name, email and number, course, session and check-in / out times. No face data, device or location. Re-sending updates the same row, never duplicates it. Install TCheck's Salesforce package first (object TCheck Attendance + permission set TCheck Integration).</p>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={() => void handleSubmit()} disabled={submitting || !schoolId} className="w-full group">
          {submitting ? 'Connecting…' : 'Save Connection'} <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </Modal>
  );
}

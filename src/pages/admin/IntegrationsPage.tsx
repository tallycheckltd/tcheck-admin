import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApi, useMutation } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import {
  Plug, RefreshCw, UploadCloud, Unplug, CheckCircle2, XCircle, Clock, AlertTriangle,
  GraduationCap, BookOpenCheck, Cloud, ArrowRight, Sparkles, Link2,
} from 'lucide-react';
import type { IntegrationConnection, IntegrationProvider, Course } from '../../types';

/** Real-ish brand colors per provider — Canvas's red/orange, Moodle's orange, Salesforce's blue —
 * purely cosmetic, makes each card instantly recognizable rather than three identical gray boxes. */
const PROVIDER_META: Record<IntegrationProvider, {
  label: string;
  tagline: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  isRosterSource: boolean;
}> = {
  CANVAS: {
    label: 'Canvas',
    tagline: 'Pull courses & rosters, post attendance as a gradebook score.',
    icon: GraduationCap,
    gradient: 'from-[#E4572E] to-[#C43D22]',
    isRosterSource: true,
  },
  MOODLE: {
    label: 'Moodle',
    tagline: 'Pull courses & rosters, write attendance to mod_attendance.',
    icon: BookOpenCheck,
    gradient: 'from-[#F98012] to-[#D96A0A]',
    isRosterSource: true,
  },
  SALESFORCE: {
    label: 'Salesforce',
    tagline: 'Push finalized attendance records — reporting destination only.',
    icon: Cloud,
    gradient: 'from-[#00A1E0] to-[#0077B5]',
    isRosterSource: false,
  },
};

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

export function IntegrationsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [schoolId, setSchoolId] = useState(user?.schoolId ?? '');
  const { data: schools } = useApi<{ id: string; name: string }[]>(isSuperAdmin ? '/schools' : null);
  const effectiveSchoolId = isSuperAdmin ? schoolId : (user?.schoolId ?? '');

  const { data: connections, refetch } = useApi<IntegrationConnection[]>(
    effectiveSchoolId ? `/integrations/connections?schoolId=${effectiveSchoolId}` : null,
  );
  const { data: courses } = useApi<Course[]>(effectiveSchoolId ? `/courses?schoolId=${effectiveSchoolId}` : null);

  const [connectProvider, setConnectProvider] = useState<IntegrationProvider | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ provider: IntegrationProvider; message: string; ok: boolean } | null>(null);

  const { mutate: createConnection } = useMutation('post');
  const { mutate: deleteConnection } = useMutation('delete');
  const { mutate: postAction } = useMutation('post');

  const byProvider = (provider: IntegrationProvider) => connections?.find((c) => c.provider === provider) ?? null;

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

  const handleDisconnect = async (provider: IntegrationProvider, id: string) => {
    if (!confirm(`Disconnect ${PROVIDER_META[provider].label}? Stored credentials will be permanently deleted.`)) return;
    await deleteConnection(`/integrations/connections/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Sparkles size={22} className="text-blue-500" /> Integrations
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Connect TCheck to your school's LMS or CRM — pull rosters automatically, push attendance back where your staff already look.
          </p>
        </div>
        {isSuperAdmin && (
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
          >
            <option value="">Select a school…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {!effectiveSchoolId ? (
        <div className="glass-card p-10 text-center">
          <Plug size={28} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Pick a school above to manage its integrations.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {(Object.keys(PROVIDER_META) as IntegrationProvider[]).map((provider) => {
              const meta = PROVIDER_META[provider];
              const Icon = meta.icon;
              const connection = byProvider(provider);
              const statusMeta = connection?.lastSyncStatus ? STATUS_META[connection.lastSyncStatus] : null;
              const isBusy = busyProvider === provider;

              return (
                <div key={provider} className="glass-card p-0 overflow-hidden flex flex-col">
                  <div className={`h-1.5 bg-gradient-to-r ${meta.gradient}`} />
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                        <Icon size={20} className="text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-950 dark:text-white">{meta.label}</h3>
                          {connection ? (
                            <Badge color="blue">Connected</Badge>
                          ) : (
                            <Badge color="gray">Not connected</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{meta.tagline}</p>
                      </div>
                    </div>

                    {connection && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1"><Clock size={12} /> Last synced</span>
                          <span className="font-medium text-slate-950 dark:text-white">{timeAgo(connection.lastSyncedAt)}</span>
                        </div>
                        {statusMeta && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Status</span>
                            <Badge color={statusMeta.color}>
                              <statusMeta.icon size={11} /> {statusMeta.label}
                            </Badge>
                          </div>
                        )}
                        {connection.lastSyncError && (
                          <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg p-2 line-clamp-3">
                            {connection.lastSyncError}
                          </p>
                        )}
                      </div>
                    )}

                    {actionResult?.provider === provider && (
                      <p className={`text-xs mt-3 ${actionResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {actionResult.message}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!connection ? (
                        <Button size="sm" onClick={() => setConnectProvider(provider)} className="w-full">
                          <Plug size={14} className="mr-1.5" /> Connect {meta.label}
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void runAction(provider, connection.id, 'test', 'Test')}>
                            {isBusy ? 'Working…' : 'Test'}
                          </Button>
                          {meta.isRosterSource && (
                            <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void runAction(provider, connection.id, 'sync-roster', 'Sync')}>
                              <RefreshCw size={13} className="mr-1" /> Sync Roster
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" disabled={isBusy} onClick={() => void runAction(provider, connection.id, 'export-attendance', 'Export')}>
                            <UploadCloud size={13} className="mr-1" /> Export Attendance
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void handleDisconnect(provider, connection.id)}>
                            <Unplug size={13} className="mr-1" /> Disconnect
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unmatched courses — the manual-mapping fallback for whichever roster-source
              connection's last sync found a course whose LMS code doesn't already match a
              TCheck Course.code. */}
          {(['CANVAS', 'MOODLE'] as IntegrationProvider[]).map((provider) => {
            const connection = byProvider(provider);
            const unmatched = connection?.lastSyncSummary?.coursesUnmatched ?? [];
            if (!connection || unmatched.length === 0) return null;
            return (
              <UnmatchedCoursesPanel
                key={provider}
                provider={provider}
                connectionId={connection.id}
                unmatched={unmatched}
                courses={courses ?? []}
                onMapped={refetch}
              />
            );
          })}
        </>
      )}

      {connectProvider && (
        <ConnectModal
          provider={connectProvider}
          schoolId={effectiveSchoolId}
          onClose={() => setConnectProvider(null)}
          onSubmit={async (config, credentials) => {
            await createConnection('/integrations/connections', { schoolId: effectiveSchoolId, provider: connectProvider, config, credentials });
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
        These courses exist in {PROVIDER_META[provider].label} but their code didn't match any TCheck course. Map each one by hand — TCheck never creates a course automatically.
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
                placeholder="Map to TCheck course…"
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
        await onSubmit(
          { domain: fields.domain, serviceShortname: fields.serviceShortname, hasAttendancePlugin: fields.hasAttendancePlugin === 'yes' },
          { username: fields.username, password: fields.password },
        );
      } else {
        await onSubmit(
          { orgDomain: fields.orgDomain, apiVersion: fields.apiVersion || 'v66.0', targetObject: fields.targetObject || 'Attendance__c' },
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
        {!schoolId && <p className="text-sm text-red-500">Select a school first.</p>}

        {provider === 'CANVAS' && (
          <>
            <Input label="Canvas Domain" placeholder="school.instructure.com" value={fields.domain ?? ''} onChange={set('domain')} />
            <Input label="Account ID" placeholder="1" value={fields.accountId ?? ''} onChange={set('accountId')} />
            <Input label="Developer Key — Client ID" value={fields.clientId ?? ''} onChange={set('clientId')} />
            <Input label="Developer Key — Client Secret" type="password" value={fields.clientSecret ?? ''} onChange={set('clientSecret')} />
            <Input label="Refresh Token" type="password" value={fields.refreshToken ?? ''} onChange={set('refreshToken')} />
          </>
        )}

        {provider === 'MOODLE' && (
          <>
            <Input label="Moodle Domain" placeholder="school.moodle.com" value={fields.domain ?? ''} onChange={set('domain')} />
            <Input label="Web Service Shortname" value={fields.serviceShortname ?? ''} onChange={set('serviceShortname')} />
            <Input label="Web Service Username" value={fields.username ?? ''} onChange={set('username')} />
            <Input label="Web Service Password" type="password" value={fields.password ?? ''} onChange={set('password')} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Is mod_attendance installed?</label>
              <select
                value={fields.hasAttendancePlugin ?? ''}
                onChange={(e) => setFields((f) => ({ ...f, hasAttendancePlugin: e.target.value }))}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
              >
                <option value="">Not sure yet</option>
                <option value="yes">Yes — write-back can use it directly</option>
                <option value="no">No — roster pull only, for now</option>
              </select>
            </div>
          </>
        )}

        {provider === 'SALESFORCE' && (
          <>
            <Input label="Org Domain" placeholder="yourorg.my.salesforce.com" value={fields.orgDomain ?? ''} onChange={set('orgDomain')} />
            <Input label="API Version" placeholder="v66.0" value={fields.apiVersion ?? ''} onChange={set('apiVersion')} />
            <Input label="Target Object" placeholder="Attendance__c" value={fields.targetObject ?? ''} onChange={set('targetObject')} />
            <Input label="Connected App — Consumer Key" value={fields.clientId ?? ''} onChange={set('clientId')} />
            <Input label="Integration Username" value={fields.username ?? ''} onChange={set('username')} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Private Key (PEM)</label>
              <textarea
                rows={4}
                value={fields.privateKey ?? ''}
                onChange={(e) => setFields((f) => ({ ...f, privateKey: e.target.value }))}
                placeholder="-----BEGIN PRIVATE KEY-----"
                className="w-full rounded-xl px-4 py-2.5 text-sm font-mono bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
              />
            </div>
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

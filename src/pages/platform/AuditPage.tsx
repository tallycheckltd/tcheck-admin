import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { Eye, ScrollText } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { AuditLogView } from '../../components/audit/AuditLogView';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Card } from '../../components/insights/InsightsUi';
import { Avatar, PageHeader, Placeholder, Skeleton, labelCls } from '../../components/platform/PlatformUi';

interface AuditSchool { id: string; name: string; code: string; last30Days: number; lastEventAt: string | null }

/**
 * 11-02 — the Super Admin's Audit log, one school at a time. Owner decision 11-02: names are shown
 * here (an exception to the watchtower's counts-only rule), and opening a school's log is recorded in
 * that school's own trail, which its School Admin sees on their Audit log.
 */
export function PlatformAuditPage() {
  const [params, setParams] = useSearchParams();
  const schoolId = params.get('schoolId') ?? '';
  const { data: schools } = useApi<AuditSchool[]>('/platform/audit/schools');
  const school = schools?.find((s) => s.id === schoolId);
  const pick = (id: string) => setParams(id ? { schoolId: id } : {}, { replace: false });
  const ranked = [...(schools ?? [])].sort((a, b) => b.last30Days - a.last30Days || a.name.localeCompare(b.name));

  return (
    <div className="space-y-5 max-w-7xl" data-testid="platform-audit">
      <PageHeader
        title={school ? `Audit log — ${school.name}` : 'Audit log'}
        subtitle="Who changed what in each school, and when. Pick a school to see its trail."
      />

      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="w-full md:w-96">
          <label className={labelCls}>School</label>
          <SearchableSelect
            value={schoolId}
            onChange={pick}
            placeholder="Search schools…"
            options={ranked.map((s) => ({ value: s.id, label: s.name, sublabel: `${s.code} · ${s.last30Days.toLocaleString()} events in 30 days` }))}
          />
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 md:pb-3">
          <Eye size={14} className="shrink-0" /> Opening a school&apos;s log is recorded in that school&apos;s own audit trail, where its School Admin can see it.
        </p>
      </div>

      {schoolId ? (
        <AuditLogView key={schoolId} base="/platform/audit" schoolId={schoolId} schoolName={school?.name} />
      ) : (
        <Card title="Schools" subtitle="Most active in the last 30 days first.">
          {!schools ? <Skeleton rows={4} /> : schools.length === 0 ? (
            <Placeholder icon={<ScrollText size={22} />} title="No schools yet" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {ranked.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s.id)}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-white/10 p-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <Avatar name={s.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900 dark:text-white truncate">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      {s.lastEventAt ? `Last change ${new Date(s.lastEventAt).toLocaleDateString()}` : 'No changes recorded'}
                    </span>
                  </span>
                  <span className={clsx('text-sm tabular-nums font-semibold', s.last30Days ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>{s.last30Days.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

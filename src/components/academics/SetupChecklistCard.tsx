import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ClipboardCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../ui/GlassCard';

interface Checklist { items: { key: string; label: string; done: boolean; detail: string }[]; done: boolean; draftRunId: string | null; onboardingCompletedAt?: string | null }

/** Where each line takes the admin (A10.2: "each line links to the step"). */
const LINK: Record<string, string> = {
  calendar: '/admin/setup', orgUnits: '/admin/setup', programmes: '/admin/academics?tab=programmes', rooms: '/admin/classrooms',
  beacons: '/admin/beacons', staff: '/admin/people', students: '/admin/users', timetable: '/admin/setup', cems: '/admin/academics?tab=cohorts',
};

/** P6 (A10.2) — the setup checklist on the School Admin home and on Institution Setup. */
export function SetupChecklistCard({ schoolId, refreshKey = 0, compact = false }: { schoolId?: string | null; refreshKey?: number; compact?: boolean }) {
  const { user } = useAuth();
  const { data, refetch } = useApi<Checklist>(schoolId ? `/setup/checklist?schoolId=${schoolId}&r=${refreshKey}` : null);
  if (!data || (compact && data.done)) return null;
  return (
    <div data-testid="setup-checklist"><GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardCheck size={18} /> Setup checklist</h2>
        {compact && <Link to="/admin/setup" className="text-sm text-blue-600 dark:text-blue-400">Open Institution Setup</Link>}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {data.items.map((i) => (
          <li key={i.key} className="text-sm flex items-center gap-2">
            {i.done ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <Circle size={14} className="text-slate-400 shrink-0" />}
            <Link to={LINK[i.key] ?? '/admin/setup'} className="text-slate-900 dark:text-white hover:underline">{i.label}</Link>
            <span className="text-xs text-slate-500">{i.detail}</span>
          </li>
        ))}
      </ul>
      {/* P10 (A7.7): marking setup complete ends the platform's access to Institution Setup. */}
      {!compact && user?.role === 'SCHOOL_ADMIN' && (
        <div className="mt-3 text-sm flex items-center gap-3" data-testid="setup-complete">
          {data.onboardingCompletedAt
            ? <span className="text-emerald-600">Setup marked complete on {data.onboardingCompletedAt.slice(0, 10)} — the platform can no longer open Institution Setup.</span>
            : <button type="button" className="text-blue-600 dark:text-blue-400 cursor-pointer" onClick={async () => { await api.post('/setup/complete', {}); refetch(); }}>Setup is complete — close platform access to Setup</button>}
        </div>
      )}
    </GlassCard></div>
  );
}

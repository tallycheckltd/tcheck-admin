import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Cake, ClipboardCheck, Megaphone, Folder, Star, Wrench, BarChart3 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { StaffPanelsGrid, STAFF_PANEL_LABEL, type StaffPanelKey } from '../admin/StaffViewPage';

interface CemCohort {
  id: string;
  name: string;
}

const PANEL_ICON: Record<StaffPanelKey, React.ElementType> = {
  checkins: ClipboardCheck, 'manual-checkin': ClipboardCheck, broadcast: Megaphone, materials: Folder,
  feedback: Star, facilities: Wrench, analytics: BarChart3, birthdays: Cake,
};

/**
 * A single panel's own dedicated page (`/cem/cohorts/:cohortId/:panel`) — the sidebar's
 * per-programme links (Sidebar.tsx's buildCxmCohortLinks) point straight here instead of a
 * `#panel-*` hash anchor on one shared page, per explicit request: each panel genuinely lives on
 * its own page, not an accordion section shared with six others. Reuses StaffPanelsGrid's `only`
 * mode rather than a second panel implementation.
 */
export function CemCohortPanelPage() {
  const { cohortId, panel } = useParams<{ cohortId: string; panel: string }>();
  const navigate = useNavigate();
  const { data: dashboard } = useApi<{ cohorts: CemCohort[] }>('/cem/dashboard');
  const cohort = dashboard?.cohorts.find((c) => c.id === cohortId);

  const key = panel as StaffPanelKey;
  const label = STAFF_PANEL_LABEL[key];
  const Icon = PANEL_ICON[key];

  if (!label) {
    navigate(`/cem/cohorts/${cohortId}`, { replace: true });
    return null;
  }

  return (
    <div className="space-y-6">
      <Link to={`/cem/cohorts/${cohortId}`} className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
        <ArrowLeft size={14} /> Back to {cohort?.name ?? 'programme'}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Icon size={22} className="text-blue-500" /> {label}
      </h1>
      <StaffPanelsGrid cohortId={cohortId} only={key} />
    </div>
  );
}

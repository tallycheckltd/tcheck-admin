import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Cake, ClipboardCheck, Megaphone, Folder, Star, Wrench, BarChart3, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ProgramDetailView } from '../../components/admin/ProgramDetailView';
import { STAFF_PANEL_ORDER, STAFF_PANEL_LABEL, BROADCAST_PERMISSIONS, type StaffPanelKey } from '../admin/StaffViewPage';

const PANEL_ICON: Record<StaffPanelKey, React.ElementType> = {
  checkins: ClipboardCheck, 'manual-checkin': ClipboardCheck, broadcast: Megaphone, materials: Folder,
  feedback: Star, facilities: Wrench, analytics: BarChart3, birthdays: Cake,
};

/**
 * Outline B3/11.4 — clicking a "My programmes" card on /cem drops in here. Per explicit request
 * this is now the full "click a programme, see everything about it, end to end" view
 * (ProgramDetailView — courses in the programme, attendance, gender breakdown, facilities,
 * roster; the same component the Dean-facing report drills into), followed by link-cards out to
 * each action panel's own dedicated page (CemCohortPanelPage.tsx) in STAFF_PANEL_ORDER —
 * Birthdays deliberately last.
 */
export function CemCohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const perms = new Set(user?.permissions ?? []);

  const grantedPanels = STAFF_PANEL_ORDER.filter((key) => {
    switch (key) {
      case 'birthdays': return perms.has('VIEW_BIRTHDAYS');
      case 'checkins': return perms.has('VIEW_BLE_CHECKINS') || perms.has('VIEW_MANUAL_CHECKINS');
      case 'manual-checkin': return perms.has('MANUAL_CHECK_IN');
      case 'broadcast': return BROADCAST_PERMISSIONS.some((p) => perms.has(p));
      case 'materials': return perms.has('MANAGE_MATERIALS');
      case 'feedback': return perms.has('REQUEST_FEEDBACK');
      case 'facilities': return perms.has('VIEW_FACILITIES');
      case 'analytics': return perms.has('VIEW_ANALYTICS');
      default: return false;
    }
  });

  return (
    <div className="space-y-6">
      <Link to="/cem" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
        <ArrowLeft size={14} /> Back to My programmes
      </Link>

      {cohortId && <ProgramDetailView cohortId={cohortId} />}

      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Manage this programme</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {grantedPanels.map((key) => {
            const Icon = PANEL_ICON[key];
            return (
              <Link
                key={key}
                to={`/cem/cohorts/${cohortId}/${key}`}
                className="glass-card p-4 flex items-center justify-between hover:ring-2 hover:ring-blue-400/50 transition-shadow"
              >
                <span className="flex items-center gap-2.5 font-medium text-gray-900 dark:text-white">
                  <Icon size={18} className="text-blue-500" /> {STAFF_PANEL_LABEL[key]}
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

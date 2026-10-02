import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ProgramDetailView } from '../../components/admin/ProgramDetailView';

/**
 * Outline B3/11.4 — clicking a "My programmes" card on /cem drops in here: the programme overview
 * (ProgramDetailView — stats, courses in the programme, attendance, gender breakdown, roster; the
 * same component the Dean-facing report drills into). UAT F15 — no Facilities section and no
 * "Manage this programme" link grid: the sidebar's per-programme list already links every panel,
 * and the CEM's top-level Facilities page covers tickets.
 */
export function CemCohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();

  return (
    <div className="space-y-6">
      <Link to="/cem" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
        <ArrowLeft size={14} /> Back to My programmes
      </Link>

      {cohortId && <ProgramDetailView cohortId={cohortId} showFacilities={false} />}
    </div>
  );
}

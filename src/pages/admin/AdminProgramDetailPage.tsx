import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ProgramDetailView } from '../../components/admin/ProgramDetailView';

/**
 * Dean/HOD/School Admin-facing counterpart of CemCohortDetailPage.tsx's own programme view —
 * "click a programme, see everything about it, end to end", reached from the CEM & Programmes
 * Report (CemReportsPage.tsx). Same ProgramDetailView component, same GET /cem/programs/:cohortId
 * endpoint, so a Dean and the programme's own CEM can never see a different picture of it.
 */
export function AdminProgramDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();

  return (
    <div className="space-y-6">
      <Link to="/admin/cem-reports" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
        <ArrowLeft size={14} /> Back to CEM & Programmes Report
      </Link>
      {cohortId && <ProgramDetailView cohortId={cohortId} />}
    </div>
  );
}

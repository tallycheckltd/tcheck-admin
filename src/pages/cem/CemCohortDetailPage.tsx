import { useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { ProgramDetailView } from '../../components/admin/ProgramDetailView';
import { ProgrammeDelegates } from '../../components/cem/ProgrammeTools';

/**
 * Outline B3/11.4 — clicking a "My programmes" card on /cem drops in here: the programme overview
 * (ProgramDetailView — stats, courses in the programme, attendance, gender breakdown, roster; the
 * same component the Dean-facing report drills into). UAT F15 — no Facilities section and no
 * "Manage this programme" link grid: the sidebar's per-programme list already links every panel,
 * and the CEM's top-level Facilities page covers tickets.
 */
export function CemCohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  // A Head of CEM arrives from a CEM's page and goes back there (SBS, 5 Nov).
  const from = (useLocation().state ?? null) as { back?: string; backLabel?: string } | null;
  const back = from?.back ?? (user?.role === 'CEM_MANAGER' ? '/cem-team' : '/cem');
  const backLabel = from?.backLabel ?? (user?.role === 'CEM_MANAGER' ? 'CEM Team' : 'My programmes');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to={back} className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
          <ArrowLeft size={14} /> Back to {backLabel}
        </Link>
        {user?.role === 'CEM_MANAGER' && cohortId && (
          <Link to={`/cem/cohorts/${cohortId}/completion`} state={from} className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
            <GraduationCap size={14} /> Completion
          </Link>
        )}
      </div>

      {cohortId && (
        <ProgramDetailView cohortId={cohortId} showFacilities={false}>
          <ProgrammeDelegates cohortId={cohortId} />
        </ProgramDetailView>
      )}
    </div>
  );
}

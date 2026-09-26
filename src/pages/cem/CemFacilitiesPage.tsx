import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';
import { FacilitiesQueue } from '../../components/facilities/FacilitiesQueue';

/**
 * Top-level Facilities page for a CEM — `/cem/facilities`, reachable directly from the CEM
 * sidebar's main (non-cohort-context) nav (cxmLinks in Sidebar.tsx). Deliberately NOT scoped to
 * one programme (no `cohortId` passed to FacilitiesQueue) — "see all the issues" across every
 * programme this CEM manages, same pooled scope /cem's own "My tickets" table already uses
 * (staffScope.ts's resolveStaffCourseIds pools across every Cohort.assignedCemId match when no
 * cohortId is given). Same triage UI (stats cards, search, status tabs, list/detail split with
 * reply/acknowledge/escalate/resolve) as the admin Facilities Queue, per explicit request that a
 * CEM/Head of CEM's facilities page should feel like the admin one, not the old compact summary —
 * reuses the one FacilitiesQueue component so the two surfaces never drift apart.
 */
export function CemFacilitiesPage() {
  return (
    <div className="space-y-6">
      <Link to="/cem" className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
        <ArrowLeft size={14} /> Back to My programmes
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Wrench size={22} className="text-blue-500" /> Facilities
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">Every open facility ticket across all your programmes.</p>
      <FacilitiesQueue />
    </div>
  );
}

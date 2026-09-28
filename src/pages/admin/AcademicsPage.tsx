import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap, AlertTriangle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { School } from '../../types';
import { TermsPage } from './TermsPage';
import { MajorsPage } from './MajorsPage';
import { CohortsPage } from './CohortsPage';
import { LevelsPage } from './LevelsPage';
import { CourseAssignmentsPage } from './CourseAssignmentsPage';
import { ProgramsPage } from './ProgramsPage';
import { PlacementQueue } from '../../components/academics/PlacementQueue';
import { ResponsibilityMatrix } from '../../components/academics/ResponsibilityMatrix';

/** P5 (A4) — one "Academics" entry for a School Admin, with tabs. The old sidebar pages
 * (/admin/terms, /admin/majors, /admin/cohorts, /admin/levels, /admin/course-assignments,
 * /admin/programs) redirect here (App.tsx). Calendar is hidden for STAGE_BASED tenants and Training
 * pipelines for CALENDAR_BASED ones — the same rule the sidebar applied before. */
export const ACADEMIC_TABS = [
  { key: 'calendar', label: 'Calendar', hideFor: 'STAGE_BASED' },
  { key: 'programmes', label: 'Programmes' },
  { key: 'cohorts', label: 'Cohorts / Intakes' },
  { key: 'levels', label: 'Levels' },
  { key: 'course-links', label: 'Course links' },
  { key: 'pipelines', label: 'Training pipelines', hideFor: 'CALENDAR_BASED' },
  { key: 'placement', label: 'Placement queue' },
  // P9 (D-11.8) — the responsibility matrix: department/HOD, CEM, CEM Manager, lecturers per cohort.
  { key: 'responsibility', label: 'Responsibility' },
] as const;
export type AcademicTab = (typeof ACADEMIC_TABS)[number]['key'];

interface Attention { items: { key: string; message: string; count: number }[] }

export function AcademicsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [params, setParams] = useSearchParams();
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const { data: ownSchool } = useApi<School>(!isSuperAdmin && user?.schoolId ? `/schools/${user.schoolId}` : null);
  const [pickedId, setPickedId] = useState('');
  const school = isSuperAdmin ? schools?.find((s) => s.id === pickedId) ?? null : ownSchool ?? null;
  const mode = school?.attendanceMode ?? 'CALENDAR_BASED';
  const tabs = ACADEMIC_TABS.filter((t) => !('hideFor' in t) || t.hideFor !== mode);
  const wanted = params.get('tab') as AcademicTab | null;
  const tab: AcademicTab = tabs.some((t) => t.key === wanted) ? wanted! : tabs[0]!.key;
  const { data: attention } = useApi<Attention>(school ? `/academic/attention?schoolId=${school.id}` : null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white flex items-center gap-2"><GraduationCap size={24} className="text-blue-500" /> Academics</h1>
        <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">Calendar, programmes, cohorts and how courses link to them — set up once, then mostly read-only.</p>
        {isSuperAdmin && (
          <select aria-label="Institution" value={pickedId} onChange={(e) => setPickedId(e.target.value)} className="mt-3 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5 min-w-[220px]">
            <option value="">Select an institution…</option>
            {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {!!attention?.items.length && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 space-y-1" role="status" data-testid="academics-attention">
          {attention.items.map((i) => (
            <p key={i.key} className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2"><AlertTriangle size={14} /> {i.message}</p>
          ))}
        </div>
      )}

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 cursor-pointer ${tab === t.key ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isSuperAdmin && !school && (tab === 'programmes' || tab === 'cohorts' || tab === 'placement' || tab === 'responsibility')
        ? <p className="text-sm text-slate-500">Select an institution to manage its programmes and cohorts.</p>
        : (
          <div role="tabpanel">
            {tab === 'calendar' && <TermsPage />}
            {tab === 'programmes' && <MajorsPage schoolId={school?.id} />}
            {tab === 'cohorts' && <CohortsPage school={school} />}
            {tab === 'levels' && <LevelsPage />}
            {tab === 'course-links' && <CourseAssignmentsPage />}
            {tab === 'pipelines' && <ProgramsPage />}
            {tab === 'placement' && <PlacementQueue schoolId={school?.id} />}
            {tab === 'responsibility' && <ResponsibilityMatrix schoolId={isSuperAdmin ? school?.id : undefined} />}
          </div>
        )}
    </div>
  );
}

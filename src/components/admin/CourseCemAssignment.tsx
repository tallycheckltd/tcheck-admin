import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { X, UserPlus } from 'lucide-react';
import type { Course, User } from '../../types';

/**
 * Assigns/removes a Client Experience Manager directly on a course — the missing counterpart to
 * Cohort.assignedCemId (a CEM was previously only reachable via a Cohort, with no way to hand
 * them one specific course/"programme" outright — the exec-ed-suite gap explicitly reported for
 * SBS/School of Communication-style departments). Backed by `PUT/DELETE /courses/:id/cem/:userId`
 * (adds/removes one row, independent of any other course's assignment for that same CEM — unlike
 * `PATCH /users/:id/staff-courses`, which replaces a CEM's *entire* course list). Shared by the
 * "All Courses" edit modal (CoursesPage.tsx) and the Course Assignments page
 * (CourseAssignmentsPage.tsx) so the two surfaces can't drift apart.
 */
export function CourseCemAssignment({ course, onChanged }: { course: Course; onChanged: (assignments: NonNullable<Course['staffAssignments']>) => void }) {
  // Unscoped for SUPER_ADMIN (platform-wide), auto-scoped to the caller's own school otherwise —
  // same query shape CoursesPage.tsx's own "Assign Lecturer" dropdown already uses. Filtered
  // client-side to this course's own school regardless, since a SUPER_ADMIN's course may belong
  // to a school other than their own (they have none).
  const { data: cems } = useApi<User[]>('/users?role=CLIENT_EXPERIENCE_MANAGER&status=APPROVED');
  const { mutate: assign, loading: assigning } = useMutation<NonNullable<Course['staffAssignments']>>('put');
  const { mutate: unassign, loading: unassigning } = useMutation<NonNullable<Course['staffAssignments']>>('delete');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const assigned = course.staffAssignments ?? [];
  const assignedIds = new Set(assigned.map((a) => a.userId));
  const available = (cems ?? []).filter((c) => c.schoolId === course.schoolId && !assignedIds.has(c.id));

  const handleAssign = async () => {
    if (!selected) return;
    setError('');
    try {
      const result = await assign(`/courses/${course.id}/cem/${selected}`);
      if (result) onChanged(result);
      setSelected('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign this CEM.');
    }
  };

  const handleRemove = async (userId: string) => {
    setError('');
    try {
      const result = await unassign(`/courses/${course.id}/cem/${userId}`);
      if (result) onChanged(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove this CEM.');
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-800 dark:text-gray-300">Client Experience Manager</label>
      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assigned.map((a) => (
            <span
              key={a.userId}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300"
            >
              {a.user.firstName} {a.user.lastName}
              <button
                onClick={() => handleRemove(a.userId)}
                disabled={unassigning}
                className="p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-red-500 cursor-pointer"
                title="Remove"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-xl px-3 py-2 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-950 dark:text-white"
        >
          <option value="">{available.length ? 'Select CEM to add…' : 'No more CEMs at this school'}</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={!selected || assigning}
          className="px-3 py-2 rounded-xl text-sm bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 flex-shrink-0"
        >
          <UserPlus size={14} /> Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

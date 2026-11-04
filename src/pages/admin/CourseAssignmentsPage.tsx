import { Fragment, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Can } from '../../components/shared/Can';
import { useApi, useMutation } from '../../hooks/useApi';
import { usePagination } from '../../hooks/usePagination';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination, RowNumberHead, RowNumberCell } from '../../components/ui/Pagination';
import {
  Link2, Search, BookOpen, Users, GraduationCap, Edit2, Trash2, Sparkles,
  School as SchoolIcon, Settings, UserCog, ChevronRight, ArrowUpRight, AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { clsx } from 'clsx';
import type { Beacon, Course, User } from '../../types';
import { CourseCemAssignment } from '../../components/admin/CourseCemAssignment';

/** Quick filters — each one is a setup gap an admin usually wants to close. */
type GapFilter = 'all' | 'noCem' | 'noSensor' | 'noStudents';
const GAP_LABEL: Record<GapFilter, string> = {
  all: 'All courses', noCem: 'No CEM', noSensor: 'No sensor', noStudents: 'No students',
};
const hasCem = (c: Course) => (c.staffAssignments?.length ?? 0) > 0;
const matchesGap = (c: Course, f: GapFilter) =>
  f === 'all' ? true
    : f === 'noCem' ? !hasCem(c)
      : f === 'noSensor' ? !c.beacon
        : (c._count?.enrollments ?? 0) === 0;

const thClass = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400';

/** One small labelled value in a row's expanded detail panel. */
function DetailItem({ label, icon: Icon, children }: { label: string; icon: ElementType; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        <Icon size={12} /> {label}
      </p>
      <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}

/** "Unassigned" placeholder that doubles as the shortcut to assign it. */
function Unassigned({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:border-white/15 dark:hover:border-blue-400/60 dark:hover:text-blue-300 transition-colors cursor-pointer"
    >
      Unassigned
    </button>
  );
}

export function CourseAssignmentsPage() {
  const navigate = useNavigate();
  const { data: courses, refetch: refetchCourses } = useApi<Course[]>('/courses');
  const { data: lecturers } = useApi<User[]>('/users?role=LECTURER&status=APPROVED');
  const { data: students } = useApi<User[]>('/users?role=STUDENT&status=APPROVED');
  const { data: beacons } = useApi<Beacon[]>('/beacons?isActive=true');
  const [search, setSearch] = useState('');

  // Reassign lecturer modal
  const [reassignModal, setReassignModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [newLecturerId, setNewLecturerId] = useState('');
  const { mutate: updateCourse, loading: updating } = useMutation('put');

  // Edit course details modal (name/code/room) — the one thing this page couldn't actually edit;
  // lecturer/beacon/enrollments already had their own actions below.
  const [editModal, setEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', room: '' });
  const { mutate: saveEdit, loading: savingEdit } = useMutation('put');

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setEditForm({ name: course.name, code: course.code, room: course.room ?? '' });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCourse || !editForm.name.trim() || !editForm.code.trim()) return;
    await saveEdit(`/courses/${editingCourse.id}`, {
      name: editForm.name.trim(),
      code: editForm.code.trim(),
      room: editForm.room.trim() || undefined,
    });
    setEditModal(false);
    setEditingCourse(null);
    refetchCourses();
  };

  // Enroll student modal
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null);
  const [enrollCourseDetail, setEnrollCourseDetail] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Beacon assignment modal
  const [beaconModal, setBeaconModal] = useState(false);
  const [beaconCourse, setBeaconCourse] = useState<Course | null>(null);
  const [selectedBeaconId, setSelectedBeaconId] = useState('');
  const [assigningBeacon, setAssigningBeacon] = useState(false);

  // CEM assignment modal — the exec-ed-suite gap (SBS/School of Communication-style departments):
  // a CEM was previously only reachable via a Cohort, with no way to hand them one specific
  // course/"programme" outright.
  const [cemModal, setCemModal] = useState(false);
  const [cemCourse, setCemCourse] = useState<Course | null>(null);
  const openCemModal = (course: Course) => {
    setCemCourse(course);
    setCemModal(true);
  };

  const openReassign = (course: Course) => {
    setSelectedCourse(course);
    setNewLecturerId(course.lecturerId);
    setReassignModal(true);
  };

  const handleReassign = async () => {
    if (!selectedCourse || !newLecturerId) return;
    await updateCourse(`/courses/${selectedCourse.id}`, { lecturerId: newLecturerId });
    setReassignModal(false);
    setSelectedCourse(null);
    refetchCourses();
  };

  const openEnroll = async (course: Course) => {
    setEnrollCourse(course);
    setEnrollCourseDetail(null);
    setStudentSearch('');
    setEnrollModal(true);
    // Fetch full course details including enrollments
    try {
      const detail = await api.get(`/courses/${course.id}`);
      setEnrollCourseDetail(detail as Course);
    } catch { /* ignore */ }
  };

  // Refresh course detail when enrollments change
  const refreshEnrollCourseDetail = async () => {
    if (!enrollCourse) return;
    try {
      const detail = await api.get(`/courses/${enrollCourse.id}`);
      setEnrollCourseDetail(detail as Course);
    } catch { /* ignore */ }
  };

  const handleEnroll = async (studentId: string) => {
    if (!enrollCourse) return;
    setEnrolling(true);
    try {
      await api.post('/courses/enroll', { userId: studentId, courseId: enrollCourse.id });
      await refreshEnrollCourseDetail();
      refetchCourses();
    } catch { /* ignore */ }
    setEnrolling(false);
  };

  const handleUnenroll = async (studentId: string, courseId: string) => {
    try {
      await api.delete(`/courses/enroll/${studentId}/${courseId}`);
      await refreshEnrollCourseDetail();
      refetchCourses();
    } catch { /* ignore */ }
  };

  // Beacon assignment
  const openBeaconModal = (course: Course) => {
    setBeaconCourse(course);
    setSelectedBeaconId(course.beaconId || '');
    setBeaconModal(true);
  };

  const handleAssignBeacon = async () => {
    if (!beaconCourse) return;
    setAssigningBeacon(true);
    try {
      await api.put(`/courses/${beaconCourse.id}`, { beaconId: selectedBeaconId || null });
      setBeaconModal(false);
      setBeaconCourse(null);
      refetchCourses();
    } catch { /* ignore */ }
    setAssigningBeacon(false);
  };

  const [gap, setGap] = useState<GapFilter>('all');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // One school list built from the courses themselves — the filter only appears when there's
  // actually more than one to choose between.
  const schoolOptions = Array.from(
    new Map((courses ?? []).filter((c) => c.school).map((c) => [c.school!.id, c.school!.name])).entries(),
  ).sort((x, y) => x[1].localeCompare(y[1]));
  const multiSchool = schoolOptions.length > 1;

  const searched = courses?.filter((c) => {
    if (schoolFilter && c.school?.id !== schoolFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      `${c.lecturer?.firstName} ${c.lecturer?.lastName}`.toLowerCase().includes(q)
    );
  }) || [];
  const gapCount = (f: GapFilter) => searched.filter((c) => matchesGap(c, f)).length;
  // Sorted by school then name so the school group rows below stay contiguous across pages.
  const filtered = searched
    .filter((c) => matchesGap(c, gap))
    .sort((x, y) => (x.school?.name ?? '').localeCompare(y.school?.name ?? '') || x.name.localeCompare(y.name));
  const pager = usePagination(filtered, { initialPageSize: 25, resetKey: `${search}|${gap}|${schoolFilter}` });
  const colCount = 8;

  const enrolledStudentIds = new Set(enrollCourseDetail?.enrollments?.map((e) => e.user.id) || []);
  const filteredStudents = students?.filter((s) => {
    if (enrolledStudentIds.has(s.id)) return false;
    if (!studentSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase()) || s.studentId?.toLowerCase().includes(studentSearch.toLowerCase());
  }) || [];

  const actionBtn = 'p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer';
  const totalCourses = courses?.length ?? 0;
  const missingCem = courses?.filter((c) => !hasCem(c)).length ?? 0;
  const missingSensor = courses?.filter((c) => !c.beacon).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header — one line of context; the counts that matter live in the filter chips below */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Course Assignments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Who teaches each course, who looks after it, which sensor it uses, and who is enrolled.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><BookOpen size={14} /> <strong className="font-semibold text-gray-900 dark:text-white tabular-nums">{totalCourses}</strong> courses</span>
          <span className="flex items-center gap-1.5"><GraduationCap size={14} /> <strong className="font-semibold text-gray-900 dark:text-white tabular-nums">{lecturers?.length || 0}</strong> lecturers</span>
        </div>
      </div>

      {(missingCem > 0 || missingSensor > 0) && totalCourses > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>
            {missingCem > 0 && <><strong>{missingCem}</strong> {missingCem === 1 ? 'course has' : 'courses have'} no CEM</>}
            {missingCem > 0 && missingSensor > 0 && ' · '}
            {missingSensor > 0 && <><strong>{missingSensor}</strong> {missingSensor === 1 ? 'course has' : 'courses have'} no sensor</>}
            . Use the filters below to find them.
          </p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {/* Toolbar — search, school, and setup-gap filters in one row */}
        <div className="flex flex-col gap-3 border-b border-gray-100 dark:border-white/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="min-w-[240px] flex-1 lg:max-w-sm">
              <SearchInput
                placeholder="Search courses, codes, or lecturers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {multiSchool && (
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white cursor-pointer"
              >
                <option value="">All schools</option>
                {schoolOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100/70 p-1 dark:bg-white/5">
            {(Object.keys(GAP_LABEL) as GapFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setGap(f)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap',
                  gap === f
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-blue-500 dark:text-white'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                {GAP_LABEL[f]}
                <span className={clsx('tabular-nums rounded-full px-1.5 text-[10px]', gap === f ? 'bg-blue-50 dark:bg-white/20' : 'bg-gray-200/70 dark:bg-white/10')}>
                  {gapCount(f)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          totalCourses === 0 ? (
            <EmptyState icon={Link2} title="No courses yet" description="Courses created for this school will appear here, ready to assign lecturers, CEMs and sensors." />
          ) : (
            <EmptyState
              icon={Search}
              title="No courses match these filters"
              description="Try a different search, school or filter."
              action={
                <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setGap('all'); setSchoolFilter(''); }}>
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  <tr>
                    <th className="w-8 px-2" aria-label="Expand" />
                    <RowNumberHead className="pl-0" />
                    <th className={thClass}>Course</th>
                    <th className={thClass}>Lecturer</th>
                    <th className={thClass}>CEM</th>
                    <th className={thClass}>Sensor</th>
                    <th className={clsx(thClass, 'text-right')}>Students</th>
                    <th className={clsx(thClass, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {pager.rows.map((course, i) => {
                    const prevSchool = i > 0 ? pager.rows[i - 1].school?.id : undefined;
                    const showSchoolRow = multiSchool && !schoolFilter && (i === 0 || prevSchool !== course.school?.id);
                    const isOpen = expanded === course.id;
                    return (
                      <Fragment key={course.id}>
                        {showSchoolRow && (
                          <tr className="bg-gray-50/80 dark:bg-white/[0.03]">
                            <td colSpan={colCount} className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                              <span className="inline-flex items-center gap-1.5"><SchoolIcon size={13} className="text-gray-400" /> {course.school?.name ?? 'No school'}</span>
                            </td>
                          </tr>
                        )}
                        <tr
                          onClick={() => setExpanded(isOpen ? null : course.id)}
                          className={clsx('group cursor-pointer transition-colors', isOpen ? 'bg-blue-50/40 dark:bg-blue-500/[0.04]' : 'hover:bg-gray-50/60 dark:hover:bg-white/[0.03]')}
                        >
                          <td className="w-8 px-2 py-3 text-gray-400">
                            <ChevronRight size={15} className={clsx('transition-transform', isOpen && 'rotate-90')} aria-label={isOpen ? 'Collapse' : 'Expand'} />
                          </td>
                          <RowNumberCell n={pager.offset + i + 1} className="pl-0" />
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/${course.id}`); }}
                                className="truncate font-semibold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 cursor-pointer text-left"
                                title="Open course"
                              >
                                {course.name}
                              </button>
                              <Badge color="blue">{course.code}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {course.lecturer ? `${course.lecturer.firstName} ${course.lecturer.lastName}` : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[200px]">
                            {hasCem(course)
                              ? <span className="block truncate">{course.staffAssignments!.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(', ')}</span>
                              : <Unassigned onClick={() => openCemModal(course)} />}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {course.beacon ? course.beacon.name : <Unassigned onClick={() => openBeaconModal(course)} />}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{course._count?.enrollments || 0}</td>
                          <td className="px-4 py-3">
                            <Can perm="MANAGE_COURSES">
                              <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={() => openEnroll(course)} className={clsx(actionBtn, 'hover:text-green-600 dark:hover:text-green-400')} title="Manage students"><Users size={16} /></button>
                                <button type="button" onClick={() => openReassign(course)} className={clsx(actionBtn, 'hover:text-blue-600 dark:hover:text-blue-400')} title="Reassign lecturer"><Edit2 size={16} /></button>
                                <button type="button" onClick={() => openCemModal(course)} className={clsx(actionBtn, 'hover:text-indigo-600 dark:hover:text-indigo-400')} title="Assign Client Experience Manager"><UserCog size={16} /></button>
                                <button type="button" onClick={() => openBeaconModal(course)} className={clsx(actionBtn, 'hover:text-purple-600 dark:hover:text-purple-400')} title="Assign Aura Sensor"><Sparkles size={16} /></button>
                                <button type="button" onClick={() => openEdit(course)} className={clsx(actionBtn, 'hover:text-amber-600 dark:hover:text-amber-400')} title="Edit course details"><Settings size={16} /></button>
                              </div>
                            </Can>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-blue-50/20 dark:bg-white/[0.015]">
                            <td colSpan={colCount} className="px-6 pb-5 pt-2">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-gray-100 bg-white/70 p-4 dark:border-white/5 dark:bg-white/[0.02] md:grid-cols-5">
                                <DetailItem label="Lecturer" icon={GraduationCap}>
                                  {course.lecturer ? (
<p className="font-medium">{course.lecturer.firstName} {course.lecturer.lastName}</p>
                                  ) : '—'}
                                </DetailItem>
                                <DetailItem label="CEM" icon={UserCog}>
                                  {hasCem(course) ? course.staffAssignments!.map((a) => (
                                    <p key={a.user.id} className="font-medium">{a.user.firstName} {a.user.lastName}</p>
                                  )) : <Unassigned onClick={() => openCemModal(course)} />}
                                </DetailItem>
                                <DetailItem label="Sensor" icon={Sparkles}>
                                  {course.beacon ? (
                                    <>
                                      <p className="font-medium">{course.beacon.name}</p>
                                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{course.beacon.uuid.slice(0, 8)}…</p>
                                    </>
                                  ) : <Unassigned onClick={() => openBeaconModal(course)} />}
                                </DetailItem>
                                <DetailItem label="Enrolment" icon={Users}>
                                  <p><span className="font-medium tabular-nums">{course._count?.enrollments || 0}</span> students</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400"><span className="tabular-nums">{course._count?.classes || 0}</span> sessions</p>
                                </DetailItem>
                                <DetailItem label="Room" icon={BookOpen}>
                                  <p className="font-medium">{course.room || 'TBD'}</p>
                                  {course.school && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{course.school.name}</p>}
                                </DetailItem>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/courses/${course.id}`)}>
                                  Open course <ArrowUpRight size={14} className="ml-1" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pager.props} />
          </>
        )}
      </div>

      {/* Reassign Lecturer Modal */}
      <Modal open={reassignModal} onClose={() => setReassignModal(false)} title="Reassign Lecturer">
        <div className="space-y-4">
          {selectedCourse && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Course</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedCourse.name} ({selectedCourse.code})
              </p>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assign to Lecturer</label>
            <div className="relative group">
              <select
                value={newLecturerId}
                onChange={(e) => setNewLecturerId(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
              >
                <option value="" className="dark:bg-zinc-950 text-gray-400">Select lecturer...</option>
                {lecturers?.map((l) => (
                  <option key={l.id} value={l.id} className="dark:bg-zinc-950">
                    {l.firstName} {l.lastName} — {l.email}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-500 transition-colors">
                <Search size={14} />
              </div>
            </div>
          </div>
          <Button onClick={handleReassign} disabled={!newLecturerId || updating} className="w-full">
            {updating ? 'Updating...' : 'Assign Lecturer'}
          </Button>
        </div>
      </Modal>

      {/* Enroll Students Modal */}
      <Modal open={enrollModal} onClose={() => setEnrollModal(false)} title="Manage Students">
        <div className="space-y-4">
          {enrollCourse && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Course</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {enrollCourse.name} ({enrollCourse.code})
              </p>
              <p className="text-xs text-gray-400 mt-1">{enrollCourseDetail?.enrollments?.length || 0} students enrolled</p>
            </div>
          )}

          {/* Current enrollments */}
          {enrollCourseDetail?.enrollments && enrollCourseDetail.enrollments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Enrolled Students</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {enrollCourseDetail.enrollments.map((e) => (
                  <div key={e.user.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {e.user.firstName} {e.user.lastName}
                      {e.user.studentId && <span className="text-gray-400 ml-1.5">({e.user.studentId})</span>}
                    </span>
                    <button
                      onClick={() => handleUnenroll(e.user.id, enrollCourse!.id)}
                      className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                      title="Remove student"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!enrollCourseDetail && enrollCourse && (
            <div className="text-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-gray-400 mt-2">Loading enrollment data...</p>
            </div>
          )}

          {/* Add student */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add Student</p>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredStudents.slice(0, 20).map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleEnroll(s.id)}
                  disabled={enrolling}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {s.firstName} {s.lastName}
                    {s.studentId && <span className="text-gray-400 ml-1.5">({s.studentId})</span>}
                  </span>
                  <span className="text-xs text-blue-500">+ Enroll</span>
                </button>
              ))}
              {filteredStudents.length === 0 && (
                <p className="text-center text-gray-400 py-3 text-xs">
                  {studentSearch ? 'No matching students' : 'All students are already enrolled'}
                </p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Assign CEM Modal */}
      <Modal open={cemModal} onClose={() => setCemModal(false)} title="Assign Client Experience Manager">
        <div className="space-y-4">
          {cemCourse && (
            <>
              <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Course</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {cemCourse.name} ({cemCourse.code})
                </p>
              </div>
              <CourseCemAssignment
                course={cemCourse}
                onChanged={(assignments) => {
                  setCemCourse({ ...cemCourse, staffAssignments: assignments });
                  refetchCourses();
                }}
              />
            </>
          )}
        </div>
      </Modal>

      {/* Edit Course Details Modal — name/code/room, the one thing this page couldn't edit before */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Course Details">
        <div className="space-y-4">
          <Input label="Course name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Course code" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
          <Input label="Room (optional)" placeholder="e.g. A101" value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} />
          <Button onClick={handleSaveEdit} disabled={!editForm.name.trim() || !editForm.code.trim() || savingEdit} className="w-full">
            {savingEdit ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Assign Beacon Modal */}
      <Modal open={beaconModal} onClose={() => setBeaconModal(false)} title="Assign Aura Sensor">
        <div className="space-y-4">
          {beaconCourse && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Course</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {beaconCourse.name} ({beaconCourse.code})
              </p>
              {beaconCourse.beacon && (
                <p className="text-xs text-purple-500 mt-1">
                  Current: {beaconCourse.beacon.name} (ID: {beaconCourse.beacon.uuid.slice(0, 8)}...)
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Sensor</label>
            <div className="relative group">
              <select
                value={selectedBeaconId}
                onChange={(e) => setSelectedBeaconId(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer"
              >
                <option value="" className="dark:bg-zinc-950 text-gray-400">No sensor (remove assignment)</option>
                {beacons?.map((b) => (
                  <option key={b.id} value={b.id} className="dark:bg-zinc-950">
                    {b.name} — {b.uuid.slice(0, 8)}... (Unit: {b.minor})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-purple-500 transition-colors">
                <Sparkles size={14} />
              </div>
            </div>
          </div>

          {selectedBeaconId && (() => {
            const beacon = beacons?.find((b) => b.id === selectedBeaconId);
            if (!beacon) return null;
            return (
              <div className="bg-purple-50 dark:bg-purple-500/5 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">Sensor Details</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <span>Sensor ID: <span className="font-mono text-gray-900 dark:text-white">{beacon.uuid}</span></span>
                  <span>Zone: <span className="font-mono text-gray-900 dark:text-white">{beacon.major}</span></span>
                  <span>Unit: <span className="font-mono text-gray-900 dark:text-white">{beacon.minor}</span></span>
                  <span>RSSI Threshold: <span className="font-mono text-gray-900 dark:text-white">{beacon.rssiThreshold}</span></span>
                  {beacon.location && (
                    <span className="col-span-2">Location: <span className="text-gray-900 dark:text-white">{beacon.location}</span></span>
                  )}
                </div>
              </div>
            );
          })()}

          <Button onClick={handleAssignBeacon} disabled={assigningBeacon} className="w-full">
            {assigningBeacon ? 'Assigning...' : selectedBeaconId ? 'Assign Sensor' : 'Remove Sensor Assignment'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

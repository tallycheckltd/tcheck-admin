import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Link2, Search, BookOpen, Users, GraduationCap, UserCheck, Edit2, Trash2, Bluetooth,
  School as SchoolIcon, Calendar,
} from 'lucide-react';
import { api } from '../../lib/api';
import { clsx } from 'clsx';
import type { Beacon, Course, User } from '../../types';

export function CourseAssignmentsPage() {
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

  const filtered = courses?.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      `${c.lecturer?.firstName} ${c.lecturer?.lastName}`.toLowerCase().includes(q)
    );
  }) || [];

  const enrolledStudentIds = new Set(enrollCourseDetail?.enrollments?.map((e) => e.user.id) || []);
  const filteredStudents = students?.filter((s) => {
    if (enrolledStudentIds.has(s.id)) return false;
    if (!studentSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase()) || s.studentId?.toLowerCase().includes(studentSearch.toLowerCase());
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Course Assignments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage course-lecturer assignments and student enrollments</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1.5"><BookOpen size={14} /> {courses?.length || 0} courses</span>
          <span className="flex items-center gap-1.5"><GraduationCap size={14} /> {lecturers?.length || 0} lecturers</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search courses, codes, or lecturers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* Course cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((course) => (
          <div key={course.id} className="glass-card p-6 flex flex-col group hover:border-blue-500/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{course.name}</h3>
                  <Badge color="blue">{course.code}</Badge>
                </div>
                {course.school && (
                  <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                    <SchoolIcon size={12} /> {course.school.name}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => openBeaconModal(course)}
                  className="p-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-purple-50 dark:hover:bg-purple-500/10 text-gray-400 hover:text-purple-600 transition-all border border-transparent hover:border-purple-100"
                  title="Assign BLE beacon"
                >
                  <Bluetooth size={16} />
                </button>
                <button
                  onClick={() => openReassign(course)}
                  className="p-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
                  title="Reassign lecturer"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => openEnroll(course)}
                  className="p-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-green-50 dark:hover:bg-green-500/10 text-gray-400 hover:text-green-600 transition-all border border-transparent hover:border-green-100"
                  title="Manage students"
                >
                  <Users size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {/* Lecturer */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100/50 dark:border-blue-500/10">
                <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <UserCheck size={16} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] uppercase font-bold text-blue-500/70 tracking-wider">Lecturer</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-blue-100 truncate">
                    {course.lecturer?.firstName} {course.lecturer?.lastName}
                  </p>
                </div>
              </div>

              {/* Beacon */}
              <div className={clsx(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                course.beacon
                  ? 'bg-purple-50/50 dark:bg-purple-500/5 border-purple-100/50 dark:border-purple-500/10'
                  : 'bg-gray-50/50 dark:bg-white/5 border-gray-100 dark:border-white/10 border-dashed hover:border-purple-300'
              )}>
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center shadow-md',
                  course.beacon ? 'bg-purple-500 text-white shadow-purple-500/20' : 'bg-gray-200 dark:bg-white/10 text-gray-400 shadow-none'
                )}>
                  <Bluetooth size={16} />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className={clsx(
                    'text-[10px] uppercase font-bold tracking-wider',
                    course.beacon ? 'text-purple-500/70' : 'text-gray-400'
                  )}>Hardware</p>
                  {course.beacon ? (
                    <p className="text-sm font-bold text-gray-900 dark:text-purple-100 truncate">
                      {course.beacon.name}
                    </p>
                  ) : (
                    <button onClick={() => openBeaconModal(course)} className="text-sm font-bold text-gray-400 hover:text-purple-500 transition-colors">
                      Unassigned
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Footer */}
            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  <Users size={14} className="text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-300">{course._count?.enrollments || 0}</span>
                  <span>Students</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  <BookOpen size={14} className="text-gray-400" />
                  <span className="text-gray-900 dark:text-gray-300">{course._count?.classes || 0}</span>
                  <span>Sessions</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-lg border border-gray-100 dark:border-white/5">
                <Calendar size={12} className="text-gray-400" />
                <span>Room {course.room || 'TBD'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Link2 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-sm text-gray-500">No courses found</p>
        </div>
      )}

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

      {/* Assign Beacon Modal */}
      <Modal open={beaconModal} onClose={() => setBeaconModal(false)} title="Assign BLE Beacon">
        <div className="space-y-4">
          {beaconCourse && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Course</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {beaconCourse.name} ({beaconCourse.code})
              </p>
              {beaconCourse.beacon && (
                <p className="text-xs text-purple-500 mt-1">
                  Current: {beaconCourse.beacon.name} (UUID: {beaconCourse.beacon.uuid.slice(0, 8)}...)
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Beacon</label>
            <div className="relative group">
              <select
                value={selectedBeaconId}
                onChange={(e) => setSelectedBeaconId(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer"
              >
                <option value="" className="dark:bg-zinc-950 text-gray-400">No beacon (remove assignment)</option>
                {beacons?.map((b) => (
                  <option key={b.id} value={b.id} className="dark:bg-zinc-950">
                    {b.name} — {b.uuid.slice(0, 8)}... (Min: {b.minor})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-purple-500 transition-colors">
                <Bluetooth size={14} />
              </div>
            </div>
          </div>

          {selectedBeaconId && (() => {
            const beacon = beacons?.find((b) => b.id === selectedBeaconId);
            if (!beacon) return null;
            return (
              <div className="bg-purple-50 dark:bg-purple-500/5 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">Beacon Details</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <span>UUID: <span className="font-mono text-gray-900 dark:text-white">{beacon.uuid}</span></span>
                  <span>Major: <span className="font-mono text-gray-900 dark:text-white">{beacon.major}</span></span>
                  <span>Minor: <span className="font-mono text-gray-900 dark:text-white">{beacon.minor}</span></span>
                  <span>RSSI Threshold: <span className="font-mono text-gray-900 dark:text-white">{beacon.rssiThreshold}</span></span>
                  {beacon.location && (
                    <span className="col-span-2">Location: <span className="text-gray-900 dark:text-white">{beacon.location}</span></span>
                  )}
                </div>
              </div>
            );
          })()}

          <Button onClick={handleAssignBeacon} disabled={assigningBeacon} className="w-full">
            {assigningBeacon ? 'Assigning...' : selectedBeaconId ? 'Assign Beacon' : 'Remove Beacon Assignment'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

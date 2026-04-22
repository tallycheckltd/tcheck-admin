import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { BookOpen, Users, Calendar, Plus, Trash2, MapPin, Bluetooth, Edit2 } from 'lucide-react';
import type { Course, School, User, Beacon } from '../../types';

export function CoursesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const queryParams = isAdmin ? '' : `?lecturerId=${user?.id}`;
  const { data: courses, refetch } = useApi<Course[]>(`/courses${queryParams}`);
  const { data: schools } = useApi<School[]>('/schools');
  const { data: lecturers } = useApi<User[]>(isAdmin ? '/users?role=LECTURER&status=APPROVED' : null);
  const { data: beacons } = useApi<Beacon[]>('/beacons?isActive=true');
  const { mutate: create } = useMutation('post');
  const { mutate: update } = useMutation('put');
  const { mutate: del } = useMutation('delete');

  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [enrollModal, setEnrollModal] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', schoolId: '', lecturerId: '', room: '', beaconId: '' });
  const [editForm, setEditForm] = useState({ name: '', code: '', schoolId: '', lecturerId: '', room: '', beaconId: '' });
  const [enrollForm, setEnrollForm] = useState({ userId: '', courseId: '' });

  const { data: allStudents } = useApi<User[]>(enrollModal ? '/users?role=STUDENT&status=APPROVED' : null);

  const handleCreate = async () => {
    await create('/courses', {
      ...form,
      lecturerId: isAdmin ? form.lecturerId : user?.id,
      room: form.room || undefined,
      beaconId: form.beaconId || undefined,
    });
    setModal(false);
    setForm({ name: '', code: '', schoolId: '', lecturerId: '', room: '', beaconId: '' });
    refetch();
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setEditForm({
      name: course.name,
      code: course.code,
      schoolId: course.schoolId,
      lecturerId: course.lecturerId,
      room: course.room || '',
      beaconId: course.beaconId || '',
    });
    setEditModal(true);
  };

  const handleEdit = async () => {
    if (!editingCourse) return;
    await update(`/courses/${editingCourse.id}`, {
      ...editForm,
      room: editForm.room || undefined,
      beaconId: editForm.beaconId || null,
    });
    setEditModal(false);
    setEditingCourse(null);
    refetch();
  };

  const handleEnroll = async () => {
    if (!enrollForm.userId || !enrollModal) return;
    await create('/courses/enroll', { userId: enrollForm.userId, courseId: enrollModal });
    setEnrollModal(null);
    setEnrollForm({ userId: '', courseId: '' });
    refetch();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    await del(`/courses/${id}`);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isAdmin ? 'All Courses' : 'My Courses'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{courses?.length || 0} courses</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus size={16} className="mr-1" /> New Course</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {courses?.map((course) => (
          <div key={course.id} className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{course.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color="blue">{course.code}</Badge>
                  {course.school && <span className="text-xs text-gray-400">{course.school.name}</span>}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <BookOpen size={20} className="text-blue-500" />
              </div>
            </div>

            {isAdmin && course.lecturer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Lecturer: {course.lecturer.firstName} {course.lecturer.lastName}
              </p>
            )}

            {(course.room || course.beacon) && (
              <div className="flex items-center gap-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
                {course.room && (
                  <span className="flex items-center gap-1"><MapPin size={12} /> {course.room}</span>
                )}
                {course.beacon && (
                  <Badge color="purple">
                    <span className="flex items-center gap-1"><Bluetooth size={10} /> {course.beacon.name}</span>
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Users size={14} /> {course._count?.enrollments || 0}</span>
                <span className="flex items-center gap-1"><Calendar size={14} /> {course._count?.classes || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(course)} className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer" title="Edit course">
                  <Edit2 size={14} className="text-blue-400" />
                </button>
                <button onClick={() => setEnrollModal(course.id)} className="text-xs text-blue-500 hover:text-blue-600 font-medium cursor-pointer px-2 py-1">
                  Enroll
                </button>
                {isAdmin && (
                  <button onClick={() => deleteCourse(course.id)} className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Course Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create Course">
        <div className="space-y-4">
          <Input label="Course Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Course Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. CS101" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
            <select value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
              <option value="">Select school</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assign Lecturer</label>
              <select value={form.lecturerId} onChange={(e) => setForm({ ...form, lecturerId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                <option value="">Select lecturer</option>
                {lecturers?.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName} ({l.email})</option>)}
              </select>
            </div>
          )}
          <Input label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="e.g. Building A, Room 101" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Beacon</label>
            <select value={form.beaconId} onChange={(e) => setForm({ ...form, beaconId: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
              <option value="">No beacon assigned</option>
              {beacons?.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.uuid.substring(0, 8)}...)</option>
              ))}
            </select>
          </div>
          <Button onClick={handleCreate} className="w-full">Create Course</Button>
        </div>
      </Modal>

      {/* Edit Course Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Course">
        <div className="space-y-4">
          <Input label="Course Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Course Code" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="e.g. CS101" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
            <select value={editForm.schoolId} onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
              <option value="">Select school</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assign Lecturer</label>
              <select value={editForm.lecturerId} onChange={(e) => setEditForm({ ...editForm, lecturerId: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                <option value="">Select lecturer</option>
                {lecturers?.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName} ({l.email})</option>)}
              </select>
            </div>
          )}
          <Input label="Room" value={editForm.room} onChange={(e) => setEditForm({ ...editForm, room: e.target.value })} placeholder="e.g. Building A, Room 101" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Beacon</label>
            <select value={editForm.beaconId} onChange={(e) => setEditForm({ ...editForm, beaconId: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
              <option value="">No beacon assigned</option>
              {beacons?.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.uuid.substring(0, 8)}...)</option>
              ))}
            </select>
          </div>
          <Button onClick={handleEdit} className="w-full">Save Changes</Button>
        </div>
      </Modal>

      {/* Enroll Student Modal */}
      <Modal open={!!enrollModal} onClose={() => setEnrollModal(null)} title="Enroll Student">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Student</label>
            <select value={enrollForm.userId} onChange={(e) => setEnrollForm({ ...enrollForm, userId: e.target.value })}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
              <option value="">Select student</option>
              {allStudents?.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.studentId || s.email})</option>)}
            </select>
          </div>
          <Button onClick={handleEnroll} className="w-full">Enroll Student</Button>
        </div>
      </Modal>
    </div>
  );
}

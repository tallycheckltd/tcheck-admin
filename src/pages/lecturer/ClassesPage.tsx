import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Plus, Radio, Eye, Trash2 } from 'lucide-react';
import type { ClassSession, Course } from '../../types';

export function ClassesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
  const { data: classes, refetch } = useApi<ClassSession[]>('/classes');
  const courseQuery = isAdmin ? '/courses' : `/courses?lecturerId=${user?.id}`;
  const { data: courses } = useApi<Course[]>(courseQuery);
  const { mutate: create } = useMutation('post');
  const { mutate: del } = useMutation('delete');
  const navigate = useNavigate();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    courseId: '', title: '', date: new Date().toISOString().split('T')[0],
    startTime: '', endTime: '', room: '', beaconUUID: '',
    checkInStart: '', checkInEnd: '',
    lateThresholdMinutes: '', extremelyLateThresholdMinutes: '',
  });

  const myClasses = isAdmin
    ? (classes || [])
    : classes?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];

  // Auto-populate room and compute default check-in window when course or times change
  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    setForm((prev) => ({
      ...prev,
      courseId,
      room: course?.room || prev.room,
      beaconUUID: course?.beacon ? course.beacon.uuid : prev.beaconUUID,
    }));
  };

  const handleStartTimeChange = (startTime: string) => {
    setForm((prev) => {
      const dateStr = prev.date;
      let checkInStart = prev.checkInStart;
      if (startTime && dateStr) {
        const st = new Date(`${dateStr}T${startTime}:00`);
        const ciStart = new Date(st.getTime() - 15 * 60 * 1000);
        checkInStart = `${String(ciStart.getHours()).padStart(2, '0')}:${String(ciStart.getMinutes()).padStart(2, '0')}`;
      }
      return { ...prev, startTime, checkInStart };
    });
  };

  const handleEndTimeChange = (endTime: string) => {
    setForm((prev) => ({ ...prev, endTime, checkInEnd: endTime }));
  };

  const getTimezoneOffset = () => {
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? '+' : '-';
    const abs = Math.abs(offset);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  };

  const handleCreate = async () => {
    const dateStr = form.date;
    const tz = getTimezoneOffset();
    await create('/classes', {
      courseId: form.courseId,
      title: form.title,
      date: dateStr,
      startTime: `${dateStr}T${form.startTime}:00${tz}`,
      endTime: `${dateStr}T${form.endTime}:00${tz}`,
      room: form.room || undefined,
      beaconUUID: form.beaconUUID || undefined,
      checkInStart: form.checkInStart ? `${dateStr}T${form.checkInStart}:00${tz}` : undefined,
      checkInEnd: form.checkInEnd ? `${dateStr}T${form.checkInEnd}:00${tz}` : undefined,
      lateThresholdMinutes: form.lateThresholdMinutes ? parseInt(form.lateThresholdMinutes) : undefined,
      extremelyLateThresholdMinutes: form.extremelyLateThresholdMinutes ? parseInt(form.extremelyLateThresholdMinutes) : undefined,
    });
    setModal(false);
    setForm({
      courseId: '', title: '', date: new Date().toISOString().split('T')[0],
      startTime: '', endTime: '', room: '', beaconUUID: '',
      checkInStart: '', checkInEnd: '',
      lateThresholdMinutes: '', extremelyLateThresholdMinutes: '',
    });
    refetch();
  };

  const deleteClass = async (id: string) => {
    if (!confirm('Delete this class?')) return;
    await del(`/classes/${id}`);
    refetch();
  };

  const fmt = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Classes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{myClasses.length} classes</p>
        </div>
        <Button onClick={() => setModal(true)}><Plus size={16} className="mr-1" /> New Class</Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm gradient-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Course</th>
              <th>Date</th>
              <th>Time</th>
              <th>Room</th>
              <th>Check-ins</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 dark:text-gray-300">
            {myClasses.map((cls) => (
              <tr key={cls.id}>
                <td className="font-medium text-gray-900 dark:text-white">{cls.title}</td>
                <td>{cls.course?.name || '-'} <span className="text-gray-400">({cls.course?.code})</span></td>
                <td>{fmtDate(cls.date)}</td>
                <td>{fmt(cls.startTime)} - {fmt(cls.endTime)}</td>
                <td>{cls.room || '-'}</td>
                <td className="font-medium">{cls._count?.attendances || 0}</td>
                <td>
                  <Badge color={cls.isActive ? 'green' : 'gray'}>
                    <span className="flex items-center gap-1">
                      {cls.isActive && <Radio size={10} className="animate-pulse" />}
                      {cls.isActive ? 'Active' : 'Ended'}
                    </span>
                  </Badge>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigate(`/attendance/${cls.id}`)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer" title="View Attendance">
                      <Eye size={15} className="text-gray-500" />
                    </button>
                    {user?.role !== 'LECTURER' && (
                      <button onClick={() => deleteClass(cls.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete">
                        <Trash2 size={15} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {myClasses.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No classes found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create Class">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Course</label>
            <select value={form.courseId} onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
              <option value="">Select course</option>
              {courses?.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Week 1 Lecture" />
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" value={form.startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
            <Input label="End Time" type="time" value={form.endTime} onChange={(e) => handleEndTimeChange(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Check-in Opens" type="time" value={form.checkInStart} onChange={(e) => setForm({ ...form, checkInStart: e.target.value })} />
            <Input label="Check-in Closes" type="time" value={form.checkInEnd} onChange={(e) => setForm({ ...form, checkInEnd: e.target.value })} />
          </div>
          <Input label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Late Threshold (min)" type="number" value={form.lateThresholdMinutes} onChange={(e) => setForm({ ...form, lateThresholdMinutes: e.target.value })} placeholder="e.g. 10" />
            <Input label="Very Late Threshold (min)" type="number" value={form.extremelyLateThresholdMinutes} onChange={(e) => setForm({ ...form, extremelyLateThresholdMinutes: e.target.value })} placeholder="e.g. 20" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Beacon UUID</label>
            <input
              value={form.beaconUUID}
              readOnly
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400"
              placeholder="Auto-populated from course beacon"
            />
            <p className="text-xs text-gray-400">Auto-populated from course beacon. Left blank if no beacon assigned.</p>
          </div>
          <Button onClick={handleCreate} className="w-full">Create Class</Button>
        </div>
      </Modal>
    </div>
  );
}

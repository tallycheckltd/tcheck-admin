import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, BookOpen, Users, UserCheck, Sparkles, School as SchoolIcon, Calendar, MapPin } from 'lucide-react';
import type { Course } from '../../types';
import { formatClassCalendarDate, formatClassTimeLocal } from '../../utils/classDateDisplay';

/**
 * "click a course -> proper data for that particular course" — reuses the exact same
 * `GET /courses/:id` CourseAssignmentsPage already calls for its enroll modal (course.service.ts's
 * getCourse already returns lecturer, beacon, the full enrollment list AND every class/session),
 * just surfaced as a real page instead of only inside a small modal.
 */
export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data: course, loading } = useApi<Course>(courseId ? `/courses/${courseId}` : null);

  if (loading || !course) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const classes = [...(course.classes ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const enrollments = course.enrollments ?? [];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/course-assignments')} className="flex items-center gap-2 text-sm text-slate-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer">
        <ArrowLeft size={16} /> Back to Course Assignments
      </button>

      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{course.name}</h1>
              <Badge color="blue">{course.code}</Badge>
            </div>
            {course.school && (
              <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <SchoolIcon size={14} /> {course.school.name}
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-950 dark:text-white">{enrollments.length}</p>
              <p className="text-xs text-slate-500">Students</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-950 dark:text-white">{classes.length}</p>
              <p className="text-xs text-slate-500">Sessions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100/50 dark:border-blue-500/10">
            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0"><UserCheck size={16} /></div>
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase font-bold text-blue-500/70 tracking-wider">Lecturer</p>
              <p className="text-sm font-bold text-gray-900 dark:text-blue-100 truncate">{course.lecturer?.firstName} {course.lecturer?.lastName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100/50 dark:border-purple-500/10">
            <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center shrink-0"><Sparkles size={16} /></div>
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase font-bold text-purple-500/70 tracking-wider">Aura Sensor</p>
              <p className="text-sm font-bold text-gray-900 dark:text-purple-100 truncate">{course.beacon?.name ?? 'Unassigned'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg bg-gray-400 text-white flex items-center justify-center shrink-0"><MapPin size={16} /></div>
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Room</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{course.room || 'TBD'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Users size={18} className="text-blue-500" /> Enrolled Students
          </h2>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No students enrolled yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-96 overflow-y-auto">
              {enrollments.map((e) => (
                <li key={e.user.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
                  <span className="text-sm text-gray-800 dark:text-gray-200">{e.user.firstName} {e.user.lastName}</span>
                  {e.user.studentId && <span className="text-xs text-gray-400 font-mono">{e.user.studentId}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar size={18} className="text-blue-500" /> Sessions
          </h2>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No sessions scheduled yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-96 overflow-y-auto">
              {classes.map((c) => (
                <li key={c.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      {c.title}
                      {!c.isActive && <Badge color="gray">Cancelled</Badge>}
                      {c.isOnline && <Badge color="blue">Online</Badge>}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <BookOpen size={12} /> {c._count?.attendances ?? 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatClassCalendarDate(c.date)} · {formatClassTimeLocal(c.startTime)}–{formatClassTimeLocal(c.endTime)}
                    {c.room ? ` · ${c.room}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

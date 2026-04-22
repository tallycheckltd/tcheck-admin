import { BookOpen, Users, Calendar, TrendingUp } from 'lucide-react';
import { BarChartCard } from '../../components/charts/BarChartCard';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import type { Course, ClassSession, ClassAttendanceStat } from '../../types';

export function LecturerDashboard() {
  const { user } = useAuth();
  const { data: courses } = useApi<Course[]>(`/courses?lecturerId=${user?.id}`);
  const { data: todayClasses } = useApi<ClassSession[]>('/classes?date=' + new Date().toISOString().split('T')[0]);
  const { data: classStats } = useApi<ClassAttendanceStat[]>(`/attendance/class-stats?lecturerId=${user?.id}`);

  const totalEnrolled = courses?.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0) || 0;
  const myClasses = todayClasses?.filter((c) => courses?.some((co) => co.id === c.courseId)) || [];
  const avgRate = classStats?.length
    ? Math.round(classStats.reduce((sum, s) => sum + s.attendanceRate, 0) / classStats.length)
    : 0;

  const statCards = [
    { title: 'My Courses', value: courses?.length || 0, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { title: 'Enrolled Students', value: totalEnrolled, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { title: "Today's Classes", value: myClasses.length, icon: Calendar, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { title: 'Avg Attendance', value: `${avgRate}%`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
  ];

  const courseData = courses?.map((c) => {
    const courseStats = classStats?.filter((s) => s.course.id === c.id) || [];
    const avg = courseStats.length ? Math.round(courseStats.reduce((sum, s) => sum + s.attendanceRate, 0) / courseStats.length) : 0;
    return { name: c.code, value: avg };
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back, {user?.firstName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon size={24} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartCard title="Avg Attendance by Course (%)" data={courseData} />

        <div className="glass-card p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Schedule</h3>
          <div className="space-y-3">
            {myClasses.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{cls.title}</p>
                  <p className="text-xs text-gray-500">{cls.course?.name} {cls.room ? `- ${cls.room}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {new Date(cls.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls.isActive ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400'}`}>
                    {cls._count?.attendances || 0} check-ins
                  </span>
                </div>
              </div>
            ))}
            {myClasses.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No classes scheduled today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

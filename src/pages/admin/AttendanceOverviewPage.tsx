import { ClipboardList } from 'lucide-react';

export function AttendanceOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Overview</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">High-level view of attendance across all courses</p>
      </div>
      <div className="glass-card p-12 text-center">
        <ClipboardList size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Coming Soon</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">View attendance summaries, rates by course, and identify at-risk students.</p>
      </div>
    </div>
  );
}

import { UserCheck } from 'lucide-react';

export function LecturerPresencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lecturer Presence</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Monitor lecturer attendance and class session delivery</p>
      </div>
      <div className="glass-card p-12 text-center">
        <UserCheck size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Coming Soon</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track lecturer presence, class session delivery rates, and punctuality metrics.</p>
      </div>
    </div>
  );
}

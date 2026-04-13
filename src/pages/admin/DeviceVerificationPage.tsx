import { Smartphone } from 'lucide-react';

export function DeviceVerificationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Device Verification</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Review and approve student device registrations</p>
      </div>
      <div className="glass-card p-12 text-center">
        <Smartphone size={48} className="mx-auto text-slate-400 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-2">Coming Soon</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verify and manage student devices to prevent attendance fraud.</p>
      </div>
    </div>
  );
}

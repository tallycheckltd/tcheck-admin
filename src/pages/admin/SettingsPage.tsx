import { useState, useEffect } from 'react';
import { CheckoutPolicyCard } from '../../components/attendance/CheckoutPolicyCard';
import { Can } from '../../components/shared/Can';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Slider } from '../../components/ui/Slider';
import { Settings, UserCheck, School as SchoolIcon } from 'lucide-react';
import type { School } from '../../types';

const emptyForm = {
  lateThresholdMinutes: 10,
  extremelyLateThresholdMinutes: 20,
  attendanceThreshold: 80,
  allowManualLecturerOverride: true,
  /** SBS Phase 9 — '' = the default (Africa/Nairobi). */
  timezone: '',
};

/** Every IANA zone the browser knows, with the common ones for this deployment first. */
const TIMEZONES: string[] = (() => {
  const common = ['Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Africa/Kigali', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London', 'UTC'];
  const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return [...common, ...all.filter((z) => !common.includes(z))];
})();

function FeatureToggle({
  icon: Icon, title, description, checked, onChange,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span className="flex items-start gap-2">
        <Icon size={18} className="text-slate-500 dark:text-gray-400 mt-0.5 shrink-0" />
        <span>
          <span className="block text-sm font-medium text-gray-900 dark:text-white">{title}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</span>
        </span>
      </span>
      <span
        onClick={() => onChange(!checked)}
        className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-white/15'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </label>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: schools } = useApi<School[]>(isSuperAdmin ? '/schools' : null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  const schoolId = isSuperAdmin ? selectedSchoolId : user?.schoolId || '';
  const { data: school, refetch } = useApi<School>(schoolId ? `/schools/${schoolId}` : null);
  const { mutate: update, loading } = useMutation('put');

  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (school) {
      setForm({
        lateThresholdMinutes: school.lateThresholdMinutes ?? 10,
        extremelyLateThresholdMinutes: school.extremelyLateThresholdMinutes ?? 20,
        attendanceThreshold: school.attendanceThreshold ?? 80,
        allowManualLecturerOverride: school.allowManualLecturerOverride ?? true,
        timezone: school.timezone ?? '',
      });
    }
  }, [school]);

  const handleSave = async () => {
    if (!schoolId) return;
    await update(`/schools/${schoolId}`, { ...form, timezone: form.timezone || null });
    refetch();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isSuperAdmin ? 'Pick a school to configure its attendance rules and features.' : 'Attendance rules and features for your school.'}
        </p>
      </div>

      <div className="max-w-xl space-y-6">
        {isSuperAdmin && (
          <GlassCard>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Institution</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                <option value="">Select an institution…</option>
                {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </GlassCard>
        )}

        {schoolId && school && (
          <>
            <GlassCard>
              <div className="flex items-center gap-3 mb-4">
                <Settings size={20} className="text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance Thresholds</h2>
              </div>
              <div className="space-y-4">
                <Slider
                  label="Late Threshold"
                  min={0}
                  max={60}
                  step={1}
                  unit=" min"
                  value={form.lateThresholdMinutes}
                  onChange={(v) => setForm({ ...form, lateThresholdMinutes: v })}
                  helpText="Minutes after class start before a check-in counts as late."
                />

                <Slider
                  label="Extremely Late Threshold"
                  min={0}
                  max={90}
                  step={1}
                  unit=" min"
                  value={form.extremelyLateThresholdMinutes}
                  onChange={(v) => setForm({ ...form, extremelyLateThresholdMinutes: v })}
                  helpText="Minutes after class start before a check-in counts as extremely late."
                />

                <Slider
                  label="Minimum Attendance for Eligibility"
                  min={50}
                  max={100}
                  step={5}
                  unit="%"
                  value={form.attendanceThreshold}
                  onChange={(v) => setForm({ ...form, attendanceThreshold: v })}
                  helpText="Overall attendance % required for exam eligibility and 'On Track' status."
                />
              </div>
            </GlassCard>

            <GlassCard>
              <div className="space-y-1">
                <label htmlFor="school-timezone" className="block text-sm font-medium text-gray-900 dark:text-white">Time zone</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Used for the times shown in emails and for when the weekly CEM digest goes out (Monday 07:00 local).</p>
                <select
                  id="school-timezone"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                >
                  <option value="">Default (Africa/Nairobi)</option>
                  {TIMEZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="space-y-4">
                <FeatureToggle
                  icon={UserCheck}
                  title="Manual check-in override"
                  description="Lets lecturers mark students present by hand (dead battery, hardware exceptions) from the live session dashboard."
                  checked={form.allowManualLecturerOverride}
                  onChange={(v) => setForm({ ...form, allowManualLecturerOverride: v })}
                />
              </div>
            </GlassCard>

            {user?.role === 'SCHOOL_ADMIN' && school && <CheckoutPolicyCard school={school as never} onSaved={refetch} />}

            <Can perm="MANAGE_SCHOOL_SETTINGS" newForLecturer>
              <Button onClick={handleSave} size="lg" disabled={loading}>
                {saved ? 'Saved!' : loading ? 'Saving…' : 'Save Settings'}
              </Button>
            </Can>
          </>
        )}

        {isSuperAdmin && !schoolId && (
          <GlassCard>
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              <SchoolIcon size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              Select an institution above to configure its settings.
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

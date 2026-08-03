import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Slider } from '../../components/ui/Slider';
import {
  Settings, UserCheck, MessageSquareOff, ShieldCheck, Megaphone, ScanFace, Timer, Scale,
  ChevronRight, School as SchoolIcon,
} from 'lucide-react';
import type { School, SchoolFeatures } from '../../types';

const defaultFeatures: Required<SchoolFeatures> = {
  anonymousChat: true,
  biometricStrictMode: false,
  broadcasts: true,
  faceIdCheckIn: true,
  dwellTimeTracking: true,
};

const emptyForm = {
  lateThresholdMinutes: 10,
  extremelyLateThresholdMinutes: 20,
  allowManualLecturerOverride: true,
  features: defaultFeatures,
};

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
        allowManualLecturerOverride: school.allowManualLecturerOverride ?? true,
        features: { ...defaultFeatures, ...school.features },
      });
    }
  }, [school]);

  const handleSave = async () => {
    if (!schoolId) return;
    await update(`/schools/${schoolId}`, form);
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                <option value="">Select a school…</option>
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

            <GlassCard>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Features Configuration</h3>
              <div className="space-y-4">
                <FeatureToggle
                  icon={MessageSquareOff}
                  title="Anonymous Chat"
                  description="Lets students post anonymously in Campus/Session Chat rooms."
                  checked={form.features.anonymousChat}
                  onChange={(v) => setForm({ ...form, features: { ...form.features, anonymousChat: v } })}
                />
                <FeatureToggle
                  icon={ShieldCheck}
                  title="Biometric Strict Mode"
                  description="Blocks the selfie fallback — students without biometric hardware can't check in."
                  checked={form.features.biometricStrictMode}
                  onChange={(v) => setForm({ ...form, features: { ...form.features, biometricStrictMode: v } })}
                />
                <FeatureToggle
                  icon={Megaphone}
                  title="Broadcasts"
                  description="Lets admins send announcements to this school's students and lecturers."
                  checked={form.features.broadcasts}
                  onChange={(v) => setForm({ ...form, features: { ...form.features, broadcasts: v } })}
                />
                <FeatureToggle
                  icon={ScanFace}
                  title="Face ID Check-In"
                  description="Requires identity verification (Face ID, selfie, or device binding) to check in. Off falls back to a plain tap-to-check-in/out."
                  checked={form.features.faceIdCheckIn}
                  onChange={(v) => setForm({ ...form, features: { ...form.features, faceIdCheckIn: v } })}
                />
                <FeatureToggle
                  icon={Timer}
                  title="Dwell Time Tracking"
                  description="Requires ~10s of sustained beacon presence before a BLE check-in is accepted. Off allows an instant tap the moment the beacon is detected."
                  checked={form.features.dwellTimeTracking}
                  onChange={(v) => setForm({ ...form, features: { ...form.features, dwellTimeTracking: v } })}
                />
              </div>
            </GlassCard>

            <Button onClick={handleSave} size="lg" disabled={loading}>
              {saved ? 'Saved!' : loading ? 'Saving…' : 'Save Settings'}
            </Button>
          </>
        )}

        {isSuperAdmin && !schoolId && (
          <GlassCard>
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              <SchoolIcon size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              Select a school above to configure its settings.
            </div>
          </GlassCard>
        )}

        <Link
          to="/legal"
          className="flex items-center justify-between gap-3 p-4 rounded-2xl glass-card hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Scale size={18} className="text-slate-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Privacy Policy &amp; Terms</span>
          </span>
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Shield, Clock, Wifi } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import type { School } from '../../types';

export function SettingsPage() {
  const { data: schools, refetch } = useApi<School[]>('/schools');
  const { mutate: updateSchool } = useMutation('put');
  const [rssi, setRssi] = useState('-75');
  const [autoCheckout, setAutoCheckout] = useState('120');
  const [saved, setSaved] = useState(false);

  // Per-school settings
  const [schoolSettings, setSchoolSettings] = useState<Record<string, {
    lateThresholdMinutes: string;
    extremelyLateThresholdMinutes: string;
    allowManualLecturerOverride: boolean;
  }>>({});

  useEffect(() => {
    if (schools) {
      const settings: typeof schoolSettings = {};
      for (const s of schools) {
        settings[s.id] = {
          lateThresholdMinutes: String(s.lateThresholdMinutes ?? 10),
          extremelyLateThresholdMinutes: String(s.extremelyLateThresholdMinutes ?? 20),
          allowManualLecturerOverride: s.allowManualLecturerOverride !== false,
        };
      }
      setSchoolSettings(settings);
    }
  }, [schools]);

  const handleSave = async () => {
    // Save per-school settings
    for (const [schoolId, settings] of Object.entries(schoolSettings)) {
      await updateSchool(`/schools/${schoolId}`, {
        lateThresholdMinutes: parseInt(settings.lateThresholdMinutes) || 10,
        extremelyLateThresholdMinutes: parseInt(settings.extremelyLateThresholdMinutes) || 20,
        allowManualLecturerOverride: settings.allowManualLecturerOverride,
      });
    }
    setSaved(true);
    refetch();
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSchoolSetting = (schoolId: string, key: string, value: string | boolean) => {
    setSchoolSettings((prev) => ({
      ...prev,
      [schoolId]: { ...prev[schoolId], [key]: value },
    }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="max-w-xl space-y-6">
        {/* Global BLE Settings */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-4">
            <Wifi size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">BLE Settings</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="RSSI Threshold (dBm)"
              type="number"
              value={rssi}
              onChange={(e) => setRssi(e.target.value)}
            />
            <p className="text-xs text-gray-500">Minimum signal strength for check-in (-100 to 0). Default: -75</p>

            <Input
              label="Auto-checkout Timer (minutes)"
              type="number"
              value={autoCheckout}
              onChange={(e) => setAutoCheckout(e.target.value)}
            />
            <p className="text-xs text-gray-500">Auto checkout students after this many minutes. Default: 120</p>
          </div>
        </GlassCard>

        {/* Per-school settings */}
        {schools?.map((school) => {
          const settings = schoolSettings[school.id];
          if (!settings) return null;

          return (
            <GlassCard key={school.id}>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-5 h-5 rounded-md"
                  style={{ backgroundColor: school.color || '#3B82F6' }}
                />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{school.name}</h2>
              </div>

              <div className="space-y-4">
                {/* Tardiness Thresholds */}
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Clock size={14} className="text-yellow-500" />
                  Punctuality Thresholds
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Late (minutes)"
                    type="number"
                    value={settings.lateThresholdMinutes}
                    onChange={(e) => updateSchoolSetting(school.id, 'lateThresholdMinutes', e.target.value)}
                  />
                  <Input
                    label="Extremely Late (minutes)"
                    type="number"
                    value={settings.extremelyLateThresholdMinutes}
                    onChange={(e) => updateSchoolSetting(school.id, 'extremelyLateThresholdMinutes', e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Students arriving after the &quot;Late&quot; threshold are marked LATE. After &quot;Extremely Late&quot; they&apos;re marked EXTREMELY LATE.
                </p>

                {/* Manual Override Toggle */}
                <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Shield size={14} className="text-green-500" />
                    Lecturer Permissions
                  </div>
                  <label className="flex items-center justify-between cursor-pointer py-2">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">Allow Manual Lecturer Override</p>
                      <p className="text-xs text-gray-500">Let lecturers manually mark students as present (bypassing BLE requirement)</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.allowManualLecturerOverride}
                        onChange={(e) => updateSchoolSetting(school.id, 'allowManualLecturerOverride', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
                    </div>
                  </label>
                </div>
              </div>
            </GlassCard>
          );
        })}

        <Button onClick={handleSave} size="lg">
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

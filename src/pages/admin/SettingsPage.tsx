import { useState } from 'react';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Settings } from 'lucide-react';

export function SettingsPage() {
  const [rssi, setRssi] = useState('-75');
  const [autoCheckout, setAutoCheckout] = useState('120');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div className="max-w-xl space-y-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-4">
            <Settings size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance Settings</h2>
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

        <Button onClick={handleSave} size="lg">
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

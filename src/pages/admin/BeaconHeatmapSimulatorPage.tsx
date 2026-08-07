import { useState } from 'react';
import { Radar, Save } from 'lucide-react';
import { useApi, useMutation } from '../../hooks/useApi';
import { Slider } from '../../components/ui/Slider';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/GlassCard';
import { HeatmapCanvas } from '../../components/admin/heatmap/HeatmapCanvas';
import { SimulatedPhoneWidget } from '../../components/admin/heatmap/SimulatedPhoneWidget';
import { TX_POWER_OPTIONS_DBM, suggestedRssiAt1m } from '../../lib/rfPhysics';
import type { Beacon } from '../../types';

const PATH_LOSS_OPTIONS = [
  { value: 2.0, label: 'Empty Room (n = 2.0)' },
  { value: 2.5, label: 'Desk-Filled Room (n = 2.5)' },
  { value: 3.0, label: 'Concrete-Heavy (n = 3.0)' },
];

const LEGEND = [
  { color: 'rgb(217, 27, 27)', label: 'Strong · -40 to -55 dBm' },
  { color: 'rgb(255, 214, 10)', label: 'Medium · -56 to -75 dBm' },
  { color: 'rgb(30, 45, 150)', label: 'Weak · -76 to -100 dBm' },
];

/**
 * Section 1-3 — 3D-aware BLE signal propagation simulator. Lets an admin drag a virtual Minew E9
 * around a to-scale room floor plan, see the resulting RF heatmap, and tune the exact RSSI
 * threshold the mobile app's dwell-time gate will enforce for that room — *before* hardware is
 * physically mounted. Grounded in the app's real config surface: the threshold tuned here saves
 * straight to a real `Beacon.rssiThreshold` row via the same PUT /beacons/:id endpoint
 * BLEBeaconPage uses, rather than being a disconnected toy.
 */
export function BeaconHeatmapSimulatorPage() {
  const { data: beacons } = useApi<Beacon[]>('/beacons');
  const { mutate: updateBeacon, loading: saving } = useMutation<Beacon>('put');

  const [roomWidthM, setRoomWidthM] = useState(8);
  const [roomLengthM, setRoomLengthM] = useState(10);
  const [ceilingHeightM, setCeilingHeightM] = useState(3.0);
  const [beaconHeightM, setBeaconHeightM] = useState(3.0);
  const [phoneHeightM, setPhoneHeightM] = useState(1.0);
  const [txPowerDbm, setTxPowerDbm] = useState<number>(0);
  const [rssiAt1m, setRssiAt1m] = useState(-59);
  const [advertisingIntervalMs, setAdvertisingIntervalMs] = useState(350);
  const [pathLossExponent, setPathLossExponent] = useState(2.0);
  const [threshold, setThreshold] = useState(-90);

  const [beaconXY, setBeaconXY] = useState({ x: 4, y: 5 });
  const [testPhoneXY, setTestPhoneXY] = useState<{ x: number; y: number } | null>(null);
  const [selectedBeaconId, setSelectedBeaconId] = useState('');

  // Clamping happens right in these handlers (not a reactive useEffect) so a resize can't leave
  // the beacon or test-phone pin floating outside the new grid, without cascading extra renders.
  const handleRoomWidthChange = (width: number) => {
    setRoomWidthM(width);
    setBeaconXY((prev) => ({ ...prev, x: Math.min(prev.x, width) }));
    setTestPhoneXY((prev) => (prev ? { ...prev, x: Math.min(prev.x, width) } : null));
  };

  const handleRoomLengthChange = (length: number) => {
    setRoomLengthM(length);
    setBeaconXY((prev) => ({ ...prev, y: Math.min(prev.y, length) }));
    setTestPhoneXY((prev) => (prev ? { ...prev, y: Math.min(prev.y, length) } : null));
  };

  const handleTxPowerChange = (value: number) => {
    setTxPowerDbm(value);
    setRssiAt1m(suggestedRssiAt1m(value));
  };

  const handleLoadBeacon = (id: string) => {
    setSelectedBeaconId(id);
    const beacon = beacons?.find((b) => b.id === id);
    if (beacon) setThreshold(beacon.rssiThreshold);
  };

  const handleSaveThreshold = async () => {
    if (!selectedBeaconId) return;
    await updateBeacon(`/beacons/${selectedBeaconId}`, { rssiThreshold: Math.round(threshold) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-950 dark:text-white">
          <Radar size={22} className="text-blue-500" /> BLE Heatmap Simulator
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Model Minew E9 signal propagation across a room and pre-configure the check-in threshold before deploying hardware.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_1fr_300px]">
        {/* Control panel */}
        <GlassCard className="space-y-5">
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Classroom Dimensions</h2>
            <div className="grid grid-cols-3 gap-2">
              <Input label="Width X (m)" type="number" min={1} step={0.5} value={String(roomWidthM)} onChange={(e) => handleRoomWidthChange(parseFloat(e.target.value) || 1)} />
              <Input label="Length Y (m)" type="number" min={1} step={0.5} value={String(roomLengthM)} onChange={(e) => handleRoomLengthChange(parseFloat(e.target.value) || 1)} />
              <Input label="Ceiling Z (m)" type="number" min={2} step={0.1} value={String(ceilingHeightM)} onChange={(e) => setCeilingHeightM(parseFloat(e.target.value) || 2)} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Device Heights</h2>
            <div className="space-y-3">
              <Slider label="Beacon Mount Height" min={0.5} max={Math.max(ceilingHeightM, 0.5)} step={0.1} unit=" m" value={beaconHeightM} onChange={setBeaconHeightM} />
              <Slider label="Student Phone Height" min={0} max={2} step={0.1} unit=" m" value={phoneHeightM} onChange={setPhoneHeightM} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Minew E9 Radio</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">TX Power</label>
                <select
                  value={txPowerDbm}
                  onChange={(e) => handleTxPowerChange(Number(e.target.value))}
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                >
                  {TX_POWER_OPTIONS_DBM.map((v) => (
                    <option key={v} value={v}>{v > 0 ? `+${v}` : v} dBm</option>
                  ))}
                </select>
              </div>
              <Slider
                label="RSSI @ 1m Reference"
                min={-80} max={-30} step={1} unit=" dBm"
                value={rssiAt1m} onChange={setRssiAt1m}
                helpText="Auto-suggested from TX power above — override if this beacon's calibrated measured power differs."
              />
              <Slider label="Advertising Interval" min={100} max={2000} step={50} unit=" ms" value={advertisingIntervalMs} onChange={setAdvertisingIntervalMs} />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Path Loss Exponent</label>
                <select
                  value={pathLossExponent}
                  onChange={(e) => setPathLossExponent(Number(e.target.value))}
                  className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                >
                  {PATH_LOSS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Check-In Threshold</h2>
            <Slider
              min={-100} max={-30} step={1} unit=" dBm"
              value={threshold} onChange={setThreshold}
              marks={[{ value: -100, label: 'Far' }, { value: -30, label: 'Close' }]}
              helpText="The minimum top-3-average RSSI a student's phone must see to pass — this is the exact value stored as the beacon's rssiThreshold."
            />
          </div>

          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Apply to a Real Beacon</h2>
            <div className="space-y-2">
              <select
                value={selectedBeaconId}
                onChange={(e) => handleLoadBeacon(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
              >
                <option value="">Select a beacon to tune…</option>
                {beacons?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.rssiThreshold} dBm)</option>
                ))}
              </select>
              <Button onClick={handleSaveThreshold} disabled={!selectedBeaconId || saving} className="w-full">
                <Save size={14} className="mr-1.5" /> {saving ? 'Saving…' : `Save ${Math.round(threshold)} dBm to Beacon`}
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Heatmap canvas */}
        <GlassCard className="flex flex-col items-center gap-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Drag the white beacon marker to reposition it. Click anywhere else to drop a test phone.
            </p>
            <div className="flex flex-wrap gap-3">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <HeatmapCanvas
            roomWidthM={roomWidthM}
            roomLengthM={roomLengthM}
            beaconXY={beaconXY}
            beaconHeightM={beaconHeightM}
            phoneHeightM={phoneHeightM}
            rssiAt1m={rssiAt1m}
            pathLossExponent={pathLossExponent}
            onBeaconMove={setBeaconXY}
            testPhoneXY={testPhoneXY}
            onDropTestPhone={setTestPhoneXY}
          />
        </GlassCard>

        {/* Simulated phone widget */}
        <GlassCard>
          <SimulatedPhoneWidget
            testPhoneXY={testPhoneXY}
            beaconXY={beaconXY}
            beaconHeightM={beaconHeightM}
            phoneHeightM={phoneHeightM}
            rssiAt1m={rssiAt1m}
            pathLossExponent={pathLossExponent}
            advertisingIntervalMs={advertisingIntervalMs}
            threshold={threshold}
          />
        </GlassCard>
      </div>
    </div>
  );
}

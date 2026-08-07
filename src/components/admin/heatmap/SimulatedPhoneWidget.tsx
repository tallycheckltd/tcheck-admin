import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Smartphone } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { gaussianNoiseDb, idealRSSIAt, topNAverage, type RSSISample } from '../../../lib/rfPhysics';

const WINDOW_MS: Record<'checkin' | 'checkout', number> = { checkin: 10_000, checkout: 3_000 };
const MIN_REQUIRED_PACKETS = 3;
const TOP_N = 3;

interface Props {
  testPhoneXY: { x: number; y: number } | null;
  beaconXY: { x: number; y: number };
  beaconHeightM: number;
  phoneHeightM: number;
  rssiAt1m: number;
  pathLossExponent: number;
  advertisingIntervalMs: number;
  threshold: number;
}

/**
 * Section 3.2 — a browser-side replica of the mobile app's real dwell-time gate
 * (StudentAttendance/Managers/BeaconDwellScanner.swift): fires packets at the configured
 * advertising interval, adds Gaussian noise per packet, keeps a running top-3-strongest average,
 * and only reports a result once the window has closed with enough valid packets. It also freezes
 * the moment the window completes — mirroring the fix for the mobile app's "ghost success" bug,
 * where a scanner that kept accepting samples past its window could flip a failed attempt to a
 * pass minutes later. An admin tuning a threshold here is testing the exact same algorithm the
 * phone runs, not an approximation of it.
 */
export function SimulatedPhoneWidget({
  testPhoneXY,
  beaconXY,
  beaconHeightM,
  phoneHeightM,
  rssiAt1m,
  pathLossExponent,
  advertisingIntervalMs,
  threshold,
}: Props) {
  const [mode, setMode] = useState<'checkin' | 'checkout'>('checkin');
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<RSSISample[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const windowMs = WINDOW_MS[mode];
  const windowComplete = startedAt !== null && elapsedMs >= windowMs;

  const start = () => {
    setSamples([]);
    setElapsedMs(0);
    setStartedAt(Date.now());
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setStartedAt(null);
    setElapsedMs(0);
    setSamples([]);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  };

  // UI-only refresh so the elapsed/countdown readout is smooth regardless of a slow advertising
  // interval — Date.now() is read inside the effect's interval callback (a legitimate side-effect
  // site), never during render, so this stays a pure computation from state on every re-render.
  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  // Actual packet sampling, cadenced by the admin's configured advertising interval — this is the
  // control that's supposed to matter physically, so it drives the real sample-arrival rate.
  useEffect(() => {
    if (!running || !testPhoneXY || startedAt === null) return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= windowMs) {
        window.clearInterval(id);
        return;
      }
      const ideal = idealRSSIAt(
        { x: beaconXY.x, y: beaconXY.y, z: beaconHeightM },
        { x: testPhoneXY.x, y: testPhoneXY.y, z: phoneHeightM },
        rssiAt1m,
        pathLossExponent,
      );
      const noisy = ideal + gaussianNoiseDb();
      setSamples((prev) => [...prev, { timestamp: Date.now(), rssi: noisy }]);
    }, advertisingIntervalMs);
    intervalRef.current = id;
    return () => window.clearInterval(id);
  }, [running, testPhoneXY, startedAt, windowMs, advertisingIntervalMs, beaconXY, beaconHeightM, phoneHeightM, rssiAt1m, pathLossExponent]);

  const average = topNAverage(samples, TOP_N);
  const sufficientSamples = !windowComplete || samples.length >= MIN_REQUIRED_PACKETS;
  const passed = windowComplete && sufficientSamples && average !== null && average >= threshold;
  const top3 = [...samples].map((s) => s.rssi).sort((a, b) => b - a).slice(0, TOP_N);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <Smartphone size={16} className="text-blue-500" /> Simulated Student Phone
        </h3>
        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-white/5 p-0.5 text-xs">
          {(['checkin', 'checkout'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); reset(); }}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                mode === m ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {m === 'checkin' ? 'Check-In (10s)' : 'Check-Out (3s)'}
            </button>
          ))}
        </div>
      </div>

      {!testPhoneXY ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Click anywhere on the heatmap to drop a test phone, then start the scan — exactly like a
          student standing still while the app verifies their presence.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Test phone at ({testPhoneXY.x.toFixed(1)}m, {testPhoneXY.y.toFixed(1)}m)
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={start}
              disabled={running && !windowComplete}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Play size={13} /> {windowComplete || !running ? 'Start Scan' : 'Scanning…'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          {startedAt !== null && (
            <div className="space-y-3 rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-100"
                  style={{ width: `${Math.min(100, (elapsedMs / windowMs) * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Packets</div>
                  <div className="font-mono font-semibold text-slate-950 dark:text-white">
                    {samples.length} {samples.length < MIN_REQUIRED_PACKETS ? `(need ${MIN_REQUIRED_PACKETS})` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Top-3 Average</div>
                  <div className="font-mono font-semibold text-slate-950 dark:text-white">
                    {average !== null ? `${average.toFixed(1)} dBm` : '—'}
                  </div>
                </div>
              </div>

              {top3.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {top3.map((r, i) => (
                    <span key={i} className="rounded bg-white dark:bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                      {r.toFixed(1)}
                    </span>
                  ))}
                </div>
              )}

              {windowComplete && (
                <Badge color={passed ? 'green' : 'red'}>
                  {!sufficientSamples ? 'FAIL — too few packets' : passed ? 'PASS — would check in' : 'FAIL — signal too weak'}
                </Badge>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

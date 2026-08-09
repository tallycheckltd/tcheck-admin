/**
 * 3D RF propagation model for the Minew E9 heatmap simulator (BeaconHeatmapSimulatorPage).
 * Pure, UI-free math so it can be unit-tested and reused by both the canvas renderer and the
 * "Simulated Student Phone" widget without either owning the formulas.
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Full Nordic nRF52-series TX power steps the Minew E9 exposes. */
export const TX_POWER_OPTIONS_DBM = [4, 3, 0, -4, -8, -12, -16, -20, -30, -40] as const;
export type TxPowerDbm = (typeof TX_POWER_OPTIONS_DBM)[number];

/**
 * TX power isn't a separate multiplier in the log-distance formula below — physically it's baked
 * into the beacon's calibrated "RSSI @ 1m" value (a lower TX power means a weaker measured power at
 * 1m). This lookup gives a reasonable starting RSSI@1m for each TX step so the two controls feel
 * connected instead of the TX dropdown being inert; the admin can still override RSSI@1m by hand
 * afterward since it stays an independent input. Anchored at the spec's own default (0 dBm TX ->
 * -59 dBm @1m) with a rough 1:1 dB-for-dB slope, matching how measured power actually scales.
 */
export function suggestedRssiAt1m(txPowerDbm: number): number {
  const anchorTx = 0;
  const anchorRssiAt1m = -59;
  return anchorRssiAt1m + (txPowerDbm - anchorTx);
}

/** Section 2.1 — true 3D Euclidean distance between beacon and phone, in meters. */
export function distance3D(beacon: Point3D, phone: Point3D): number {
  return Math.sqrt((phone.x - beacon.x) ** 2 + (phone.y - beacon.y) ** 2 + (phone.z - beacon.z) ** 2);
}

/**
 * Section 2.2 — log-distance path loss model: RSSI = RSSI_1m - 10*n*log10(d).
 * Distance is floored at 1m before the log so a phone directly under/against the beacon can't push
 * log10(d) negative and report a signal stronger than the calibrated 1m reference (the spec's
 * "positive infinity glitch" guard, generalized: log10(d<1) is negative, not infinite, but it still
 * produces a physically nonsensical RSSI hotter than the 1m calibration point).
 */
export function pathLossRSSI(distanceMeters: number, rssiAt1m: number, pathLossExponent: number): number {
  const d = Math.max(distanceMeters, 1);
  return rssiAt1m - 10 * pathLossExponent * Math.log10(d);
}

/** Convenience: ideal (noise-free) RSSI a phone at `phone` would see from a beacon at `beacon`. */
export function idealRSSIAt(beacon: Point3D, phone: Point3D, rssiAt1m: number, pathLossExponent: number): number {
  return pathLossRSSI(distance3D(beacon, phone), rssiAt1m, pathLossExponent);
}

/**
 * Algebraic inverse of `pathLossRSSI` — turns a real recorded RSSI back into an estimated distance
 * from the beacon: d = 10^((RSSI_1m - RSSI) / (10*n)). This is the ONLY thing a single RSSI
 * reading can honestly reconstruct — it gives no bearing/direction, so RoomSignalMap.tsx renders
 * it as a distance ring around the beacon rather than pretending to know an exact (x,y) spot.
 */
export function distanceFromRSSI(rssi: number, rssiAt1m: number, pathLossExponent: number): number {
  return Math.pow(10, (rssiAt1m - rssi) / (10 * pathLossExponent));
}

/**
 * Section 3.1 — Gaussian noise per packet, mimicking human bodies/multipath fading. A true Gaussian
 * sample (Box-Muller) is used rather than a flat uniform random so clustering near 0 dB (small,
 * frequent jitters) with occasional larger swings looks like real RF noise, not a sawtooth — then
 * clamped to the spec's explicit +/-3 dBm envelope so a rare extreme sample can't blow past what a
 * body actually does to a signal at these distances.
 */
export function gaussianNoiseDb(maxAbsDb = 3): number {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  const standardNormal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  // ~1 std dev = maxAbsDb/3 keeps the vast majority of samples inside the envelope before clamping.
  const scaled = standardNormal * (maxAbsDb / 3);
  return Math.max(-maxAbsDb, Math.min(maxAbsDb, scaled));
}

export interface RSSISample {
  timestamp: number;
  rssi: number;
}

/**
 * Mirrors the mobile app's BeaconDwellScanner exactly (StudentAttendance/Managers/BeaconDwellScanner.swift):
 * sort samples strongest-to-weakest, average the top N, and only report "sufficient" once the
 * window has closed with at least `minRequiredPackets` collected. Kept as a pure function (not a
 * class) here since the simulator widget already owns the sample array as React state.
 */
export function topNAverage(samples: RSSISample[], topN = 3): number | null {
  if (samples.length === 0) return null;
  const strongestFirst = [...samples].map((s) => s.rssi).sort((a, b) => b - a);
  const top = strongestFirst.slice(0, topN);
  return top.reduce((sum, v) => sum + v, 0) / top.length;
}

/** Color gradient stops for the heatmap, in dBm -> RGB. Interpolated linearly between neighbors. */
const COLOR_STOPS: { dbm: number; rgb: [number, number, number] }[] = [
  { dbm: -40, rgb: [217, 27, 27] }, // hottest red
  { dbm: -55, rgb: [255, 130, 20] }, // hot/warm boundary — red edging toward orange
  { dbm: -56, rgb: [255, 214, 10] }, // warm starts — yellow
  { dbm: -75, rgb: [46, 175, 90] }, // warm ends — green
  { dbm: -76, rgb: [50, 130, 210] }, // cold starts — mid blue
  { dbm: -100, rgb: [30, 45, 150] }, // deep cold
];

/** Section 1.2 — maps a simulated RSSI reading to the Red(hot)/Yellow-Green(warm)/Blue(cold) scale. */
export function rssiToColor(rssi: number): string {
  if (rssi >= COLOR_STOPS[0].dbm) return rgbToCss(COLOR_STOPS[0].rgb);
  if (rssi <= COLOR_STOPS[COLOR_STOPS.length - 1].dbm) return rgbToCss(COLOR_STOPS[COLOR_STOPS.length - 1].rgb);

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const upper = COLOR_STOPS[i];
    const lower = COLOR_STOPS[i + 1];
    if (rssi <= upper.dbm && rssi >= lower.dbm) {
      const span = upper.dbm - lower.dbm;
      const t = span === 0 ? 0 : (upper.dbm - rssi) / span;
      const rgb: [number, number, number] = [
        Math.round(upper.rgb[0] + (lower.rgb[0] - upper.rgb[0]) * t),
        Math.round(upper.rgb[1] + (lower.rgb[1] - upper.rgb[1]) * t),
        Math.round(upper.rgb[2] + (lower.rgb[2] - upper.rgb[2]) * t),
      ];
      return rgbToCss(rgb);
    }
  }
  return rgbToCss(COLOR_STOPS[COLOR_STOPS.length - 1].rgb);
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function qualitativeSignalLabel(rssi: number): 'Strong' | 'Medium' | 'Weak' {
  if (rssi >= -55) return 'Strong';
  if (rssi >= -76) return 'Medium';
  return 'Weak';
}

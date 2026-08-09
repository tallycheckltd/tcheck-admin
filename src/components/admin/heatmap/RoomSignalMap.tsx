import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { HeatmapCanvas } from './HeatmapCanvas';
import { distanceFromRSSI, rssiToColor } from '../../../lib/rfPhysics';
import type { AttendanceRecord, ClassAttendanceDetail } from '../../../types';

interface Props {
  beacon: ClassAttendanceDetail['classInfo']['beacon'];
  attendances: AttendanceRecord[];
}

// Not stored per-beacon (a phone's height is a property of the student, not the room) — matches
// the Heatmap Simulator's own default so a saved layout renders identically in both places.
const STUDENT_PHONE_HEIGHT_M = 1.0;

/**
 * The real, non-simulated counterpart to BeaconHeatmapSimulatorPage — renders whatever room
 * layout an admin actually saved for this class's beacon, with a dashed distance ring per
 * checked-in student positioned using their real recorded RSSI (see rfPhysics.distanceFromRSSI).
 * A single RSSI reading only reveals distance, never direction, so this is deliberately a ring,
 * not a fabricated (x,y) drop point.
 */
export function RoomSignalMap({ beacon, attendances }: Props) {
  if (!beacon) {
    return (
      <div className="glass-card p-6 text-center text-sm text-slate-600 dark:text-slate-400">
        No beacon is linked to this class's room — nothing to map yet.
      </div>
    );
  }

  const isPlaced =
    beacon.roomWidthM != null && beacon.roomLengthM != null && beacon.ceilingHeightM != null &&
    beacon.xPosition != null && beacon.yPosition != null && beacon.rssiAt1m != null && beacon.pathLossExponent != null;

  if (!isPlaced) {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          "{beacon.name}" hasn't been physically placed in a room yet, so there's no real layout to show here.
        </p>
        <Link
          to={`/admin/beacon-heatmap?beaconId=${beacon.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <MapPin size={14} /> Configure this beacon's room layout
        </Link>
      </div>
    );
  }

  // Group checked-in students by rounded distance so the map stays legible for a large roster —
  // several students standing at roughly the same spot collapse into one labeled ring instead of
  // a dozen overlapping, unreadable circles.
  const groups = new Map<number, { names: string[]; rssi: number }>();
  for (const a of attendances) {
    const rssi = a.avgRssi ?? a.beaconRSSI;
    if (rssi == null) continue;
    const distanceM = distanceFromRSSI(rssi, beacon.rssiAt1m!, beacon.pathLossExponent!);
    const bucket = Math.round(distanceM * 5) / 5; // nearest 0.2m
    const name = a.user ? `${a.user.firstName} ${a.user.lastName.charAt(0)}.` : 'Unknown';
    const existing = groups.get(bucket);
    if (existing) existing.names.push(name);
    else groups.set(bucket, { names: [name], rssi });
  }

  const distanceRings = Array.from(groups.entries()).map(([distanceM, { names, rssi }]) => ({
    distanceM,
    color: rssiToColor(rssi),
    label: names.length === 1 ? names[0] : `${names.length} students`,
  }));

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Room Signal Map — {beacon.name}</h3>
        <Link to={`/admin/beacon-heatmap?beaconId=${beacon.id}`} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Edit layout
        </Link>
      </div>
      <div className="flex justify-center">
        <HeatmapCanvas
          interactive={false}
          roomWidthM={beacon.roomWidthM!}
          roomLengthM={beacon.roomLengthM!}
          beaconXY={{ x: beacon.xPosition!, y: beacon.yPosition! }}
          beaconHeightM={beacon.ceilingHeightM!}
          phoneHeightM={STUDENT_PHONE_HEIGHT_M}
          rssiAt1m={beacon.rssiAt1m!}
          pathLossExponent={beacon.pathLossExponent!}
          testPhoneXY={null}
          distanceRings={distanceRings}
        />
      </div>
      {distanceRings.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">No checked-in students with a recorded signal yet.</p>
      )}
    </div>
  );
}

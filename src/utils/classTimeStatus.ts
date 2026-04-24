/**
 * Derive session state from wall-clock start/end (API returns ISO datetimes).
 * Prefer this over Class.isActive — that flag is not currently toggled when a session ends.
 */
export type ClassTimeStatus = 'upcoming' | 'live' | 'completed' | 'invalid';

export function getClassTimeStatus(
  startTime: string,
  endTime: string,
  now: Date = new Date()
): ClassTimeStatus {
  const s = new Date(startTime).getTime();
  const e = new Date(endTime).getTime();
  const t = now.getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 'invalid';
  if (t < s) return 'upcoming';
  if (t > e) return 'completed';
  return 'live';
}

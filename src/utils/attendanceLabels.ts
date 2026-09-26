import type { CheckOutState, Punctuality } from '../types';

/**
 * SBS Phase 4 — one place for how derived lateness / check-out state read in the dashboard.
 * Both are computed server-side (utils/attendanceWindows.ts); Attendance.status is untouched,
 * so a late arrival is still PRESENT everywhere counts and rates are computed.
 */
export const PUNCTUALITY_LABEL: Record<Punctuality, string> = {
  ON_TIME: 'On time',
  LATE: 'Late',
  EXTREMELY_LATE: 'Very late',
  MANUAL: 'Manual',
};

export const PUNCTUALITY_COLOR: Record<Punctuality, 'green' | 'yellow' | 'red' | 'gray'> = {
  ON_TIME: 'green',
  LATE: 'yellow',
  EXTREMELY_LATE: 'red',
  MANUAL: 'gray',
};

export function punctualityLabel(p?: string | null): string {
  return p && p in PUNCTUALITY_LABEL ? PUNCTUALITY_LABEL[p as Punctuality] : '—';
}

export function punctualityColor(p?: string | null): 'green' | 'yellow' | 'red' | 'gray' {
  return p && p in PUNCTUALITY_COLOR ? PUNCTUALITY_COLOR[p as Punctuality] : 'gray';
}

/** Export/CSV wording for the check-out column's state. */
export function checkOutStateLabel(s?: CheckOutState | null): string {
  if (s === 'MISSING') return 'Missing check-out';
  if (s === 'OPEN') return 'Not yet';
  if (s === 'CHECKED_OUT') return 'Checked out';
  return '';
}

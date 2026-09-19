import type { CheckInType } from '../types';

/**
 * The underlying `CheckInType` value stays `'BLE'` (real API/DB contract, unchanged) — this only
 * controls what's *displayed*. Product-wide term for the automatic proximity check-in: "Aura
 * Check-In", never "BLE", "Beacon", "TB", or "Bluetooth" in any user-facing copy — the whole point
 * is that a client looking at the dashboard can't tell what the underlying tech is.
 */
const LABELS: Record<CheckInType, string> = {
  BLE: 'Aura Check-In',
  QR: 'QR',
  MANUAL: 'Manual',
  ONLINE: 'Online',
};

/** Short form for table headers/compact badges where the full label doesn't fit — same rule. */
const SHORT_LABELS: Record<CheckInType, string> = {
  BLE: 'Aura',
  QR: 'QR',
  MANUAL: 'Manual',
  ONLINE: 'Online',
};

export function formatCheckInType(type: CheckInType | string): string {
  return LABELS[type as CheckInType] ?? type;
}

export function formatCheckInTypeShort(type: CheckInType | string): string {
  return SHORT_LABELS[type as CheckInType] ?? type;
}

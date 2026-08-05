import type { CheckInType } from '../types';

/**
 * The underlying `CheckInType` value stays `'BLE'` (real API/DB contract, unchanged) — this only
 * controls what's *displayed*, so the proximity-beacon mechanism isn't named in the product UI.
 */
const LABELS: Record<CheckInType, string> = {
  BLE: 'TB',
  QR: 'QR',
  MANUAL: 'Manual',
  ONLINE: 'Online',
};

export function formatCheckInType(type: CheckInType | string): string {
  return LABELS[type as CheckInType] ?? type;
}

/**
 * Visitors (2026-11-13) — the shapes the /visitors API returns (server/src/services/visitor.service.ts)
 * and small display helpers shared by the Visitors pages.
 */

export type InviteStatus = 'PENDING' | 'USED' | 'CANCELLED' | 'EXPIRED';

export interface VisitorInvite {
  id: string;
  visitorId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationalId: string | null;
  purpose: string | null;
  validFrom: string;
  validUntil: string;
  code: string;
  qrToken: string;
  status: InviteStatus;
  hostId: string;
  hostName: string | null;
  createdAt: string;
  cancelledAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  guestCompany: string | null;
}

export interface AdminVisit {
  id: string;
  visitorId: string;
  name: string;
  phone: string;
  nationalId: string | null;
  company: string | null;
  hostName: string | null;
  hostId: string | null;
  purpose: string | null;
  tagNumber: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  checkOutMethod: 'GUARD' | 'AUTO' | 'BARRIER' | null;
  /** The gate tablet that checked them in / out (its name at the time); null when it wasn't a tablet. */
  checkInGate: string | null;
  checkOutGate: string | null;
  invited: boolean;
  minutesOnSite: number;
  overstay: boolean;
}

export interface VisitorProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  nationalId: string | null;
  company: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  inviteCount: number;
  lastInvitedAt: string | null;
  lastInvitedBy: string | null;
}

export interface VisitorAnalytics {
  from: string;
  to: string;
  total: number;
  invited: number;
  walkIn: number;
  averageMinutesOnSite: number | null;
  perDay: { day: string; count: number }[];
  perHour: { hour: number; count: number }[];
  topHosts: { name: string; count: number }[];
}

export interface VisitorSettings {
  whoCanInvite: string[];
  defaultVisitHours: number;
  earlyArrivalMinutes: number;
  overstayHours: number;
  idRequiredAtGate: boolean;
  emailHostOnArrival: boolean;
  retentionDays: number;
}

export interface VisitorSettingsResponse {
  settings: VisitorSettings;
  inviterRoles: { role: string; label: string }[];
}

/** A past guest, for "Invite again" (GET /visitors/guests). The ID number is only ever masked here. */
export interface GuestEntry {
  visitorId: string;
  name: string;
  email: string | null;
  phone: string;
  company: string | null;
  nationalIdMasked: string | null;
  hasNationalId: boolean;
  isBlocked: boolean;
  timesInvited: number;
  lastInvitedAt: string | null;
  lastPurpose: string | null;
  lastValidFrom: string | null;
  lastValidUntil: string | null;
  lastInvitedBy: string | null;
  visits: number;
  lastVisitAt: string | null;
}

/** A guest entry from what another page already has (an invitation or a profile), for "Invite again". */
export function guestFrom(x: { visitorId?: string | null; id?: string; name?: string; guestName?: string; email?: string | null; guestEmail?: string; phone?: string; guestPhone?: string; company?: string | null; guestCompany?: string | null; purpose?: string | null; validFrom?: string; validUntil?: string; nationalId?: string | null }): GuestEntry | null {
  const visitorId = x.visitorId ?? x.id;
  if (!visitorId) return null;
  return {
    visitorId, name: x.guestName ?? x.name ?? '', email: x.guestEmail ?? x.email ?? null, phone: x.guestPhone ?? x.phone ?? '',
    company: x.guestCompany ?? x.company ?? null, nationalIdMasked: x.nationalId ? `***${x.nationalId.slice(-3)}` : null, hasNationalId: !!x.nationalId,
    isBlocked: false, timesInvited: 1, lastInvitedAt: null, lastPurpose: x.purpose ?? null,
    lastValidFrom: x.validFrom ?? null, lastValidUntil: x.validUntil ?? null, lastInvitedBy: null, visits: 0, lastVisitAt: null,
  };
}

export const STATUS_BADGE: Record<InviteStatus, ['green' | 'blue' | 'gray' | 'red', string]> = {
  PENDING: ['blue', 'Expected'],
  USED: ['green', 'Arrived'],
  CANCELLED: ['gray', 'Cancelled'],
  EXPIRED: ['red', 'Expired'],
};

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** "Mon 16 Nov, 09:00 – 13:00" (or both days when the window crosses midnight). */
export function windowLabel(from: string, until: string): string {
  const sameDay = new Date(from).toDateString() === new Date(until).toDateString();
  return sameDay ? `${day(from)}, ${time(from)} – ${time(until)}` : `${day(from)} ${time(from)} – ${day(until)} ${time(until)}`;
}

export const stamp = (iso: string | null) => (iso ? `${day(iso)} ${time(iso)}` : '—');

export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

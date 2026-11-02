import { api } from './api';

/* Moi Pilot analytics — response shapes for the backend's /pilot-analytics routes, plus the
   plain-English labels the page shows a non-technical admin. Kept here rather than in
   src/types since the whole feature only exists on the moi-pilot branch. SUPER_ADMIN may pass
   `?schoolId=` on every detail route; omitted, the backend defaults to the Student ID (PIN)
   school. Everyone else is pinned to their own school server-side, so they never pass it. */

export interface PilotKpis {
  students: number;
  signedIn: number;
  signedInToday: number;
  termsAccepted: number;
  baselineCaptured: number;
  pendingDeviceChanges: number;
  pinLockedNow: number;
  closedAccounts: number;
  checkInsToday: number;
  checkInsPeriod: number;
  /** 0–1, or null when there were no check-ins to measure against. */
  checkOutRate: number | null;
  signInsOkToday: number;
  signInsFailedToday: number;
  /* Check-in outcomes, counted per student-and-class: "first try" got in with no failure before,
     "retried" failed then got in, "gave up" failed and never got in. */
  checkInFailedAttemptsToday: number;
  checkInFailedAttemptsPeriod: number;
  checkInFirstTryPeriod: number;
  checkInRetriedPeriod: number;
  checkInGaveUpPeriod: number;
  /** 0–1, or null — share of students-per-class who tried and got in. */
  checkInSuccessRate: number | null;
}

export interface PilotClass {
  id: string;
  startTime: string;
  endTime: string;
  course: string | null;
  title: string | null;
  room: string | null;
  rssiThreshold: number | null;
  checkins: number;
  checkouts: number;
  failedAttempts: number;
  gaveUp: number;
}

export interface PilotAnalytics {
  generatedAt: string;
  school: { id: string; code: string; name: string } | null;
  days: number;
  kpis: PilotKpis;
  checkInsByDay: { day: string; present: number; late: number; other: number; withCheckout: number }[];
  signInsByDay: { day: string; ok: number; failed: number }[];
  checkInOutcomesByDay: { day: string; checkedIn: number; firstTry: number; retriedThenIn: number; gaveUp: number; failedAttempts: number }[];
  /** `reason` is the server's own failure message (e.g. "Beacon signal too weak…"), not a code. */
  checkInFailureReasons: { reason: string; channel: string; count: number; students: number }[];
  failureReasons: { reason: string; count: number }[];
  classes: PilotClass[];
  rssiBuckets: { rssi: number; count: number }[];
  deviceModels: { model: string; count: number }[];
  lockedStudents: { id: string; studentId: string; name: string; lockedUntil: string | null; failedAttempts: number }[];
  closedAccounts: { id: string; studentId: string; name: string; status: string; updatedAt: string }[];
  deviceEvents: {
    id: string; type: string; createdAt: string; studentId: string | null; name: string | null;
    deviceModel: string | null; otherStudentId: string | null; reason: string | null;
  }[];
  tickets: { id: string; status: string; subject: string; createdAt: string; studentId: string | null; name: string | null }[];
  escalations: { status: string; reason: string; count: number }[];
}

export interface PilotAuditEvent {
  id: string;
  type: string;
  createdAt: string;
  studentIdTyped: string | null;
  userId: string | null;
  studentId: string | null;
  name: string | null;
  ip: string | null;
  deviceModel: string | null;
  /** Failure reason code (SIGNIN_FAILED only) — same codes as failureReasons. */
  reason?: string | null;
  detail: unknown;
}

export interface PilotAuditPage {
  events: PilotAuditEvent[];
  nextBefore: string | null;
}

/** SUPER_ADMIN's cross-school roll-up — one row of headline numbers per school. */
export interface PilotSchoolRow {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  students: number;
  signedIn: number;
  staff: number;
  courses: number;
  classesThisWeek: number;
  checkInsToday: number;
  checkInsThisWeek: number;
  activeStudentsThisWeek: number;
  signInsToday: number;
  failedSignInsToday: number;
  failedCheckInsToday: number;
  failedCheckInsThisWeek: number;
  gaveUpThisWeek: number;
  openTickets: number;
  lastCheckInAt: string | null;
}

export interface PilotSchoolsSummary {
  generatedAt: string;
  schools: PilotSchoolRow[];
}

/** Only ever called for SUPER_ADMIN — the route 403s for everyone else. */
export const PILOT_SCHOOLS_PATH = '/pilot-analytics/schools';

const schoolQs = (schoolId?: string | null) => (schoolId ? `schoolId=${encodeURIComponent(schoolId)}` : '');

export const pilotAnalyticsPath = (days: number, schoolId?: string | null) =>
  `/pilot-analytics?days=${days}${schoolId ? `&${schoolQs(schoolId)}` : ''}`;

export function fetchPilotAudit(opts: { type?: string; q?: string; before?: string | null; limit?: number; schoolId?: string | null }) {
  const params = new URLSearchParams();
  if (opts.schoolId) params.set('schoolId', opts.schoolId);
  if (opts.type) params.set('type', opts.type);
  if (opts.q) params.set('q', opts.q);
  params.set('limit', String(opts.limit ?? 50));
  if (opts.before) params.set('before', opts.before);
  return api.get<PilotAuditPage>(`/pilot-analytics/audit?${params.toString()}`);
}

/** Clears the wrong-PIN lock only — the student keeps whatever PIN they had. */
export const unlockStudentPin = (userId: string, schoolId?: string | null) =>
  api.post<{ ok: true }>(`/pilot-analytics/students/${encodeURIComponent(userId)}/unlock-pin${schoolId ? `?${schoolQs(schoolId)}` : ''}`);

/** Puts the PIN back to the shared pilot PIN (123456) and clears the lock. */
export const resetStudentPin = (userId: string, schoolId?: string | null) =>
  api.post<{ ok: true }>(`/pilot-analytics/students/${encodeURIComponent(userId)}/reset-pin${schoolId ? `?${schoolQs(schoolId)}` : ''}`);

/* ---- Plain-English labels — every map falls back to the raw code at the call site, so a code
   the backend adds later still renders instead of crashing the page. ---- */

export const FAILURE_REASON_LABEL: Record<string, string> = {
  NO_MATCH: 'Student ID not found',
  WRONG_PIN: 'Wrong PIN',
  LOCKED: 'Locked after 5 wrong PINs',
  AMBIGUOUS: 'Student ID matches more than one account',
  NOT_PIN_SCHOOL: 'School does not use PIN sign-in',
  DEVICE_MISMATCH: 'Signed in from a different phone',
  ACCOUNT_CLOSED: 'Account deleted or deactivated',
  RATE_LIMITED: 'Too many attempts',
};

export const AUDIT_EVENT_LABEL: Record<string, string> = {
  SIGNIN_OK: 'Signed in',
  SIGNIN_FAILED: 'Sign-in failed',
  PIN_LOCKED: 'Locked out (too many wrong PINs)',
  PIN_CHANGED: 'Changed own PIN',
  PIN_RESET_BY_ADMIN: 'PIN reset by admin',
  PIN_UNLOCKED_BY_ADMIN: 'Unlocked by admin',
  ACCOUNT_DELETED: 'Deleted own account',
  ACCOUNT_DEACTIVATED: 'Account deactivated',
};

export const DEVICE_EVENT_LABEL: Record<string, string> = {
  CONFLICT_BLOCKED: 'Blocked: one phone tried to sign into two accounts',
  CHANGE_REQUESTED: 'Asked to switch to a new phone',
  APPROVED: 'Phone approved',
  DENIED: 'Phone request denied / reset',
  TAMPER_DEMOTION: 'Fingerprint/face settings changed — moved to camera check',
};

export const CHECKIN_CHANNEL_LABEL: Record<string, string> = {
  BLE: 'Beacon',
  QR: 'QR code',
  ONLINE: 'Online class',
  CHECKOUT: 'Check-out',
};

export const DEVICE_CHANGE_REASON_LABEL: Record<string, string> = {
  LOST_PHONE: 'Lost phone',
  NEW_PHONE: 'Upgraded phone',
  DAMAGED: 'Phone damaged',
  STOLEN: 'Phone stolen',
  OTHER: 'Other',
};

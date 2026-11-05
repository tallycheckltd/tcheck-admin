import { api } from './api';

/* School analytics (11-05, ported from the Moi pilot) — response shapes for the backend's
   /school-analytics (School Admin, own school) and /platform/school-analytics (Super Admin, any
   school with ?schoolId=; omitted, the backend picks the school with the most students), plus the
   plain-English labels the page shows a non-technical admin. `capabilities` says what this backend
   and this viewer can show: no sign-in audit trail on the main platform, and no rows about people
   for the platform (P10) — the page hides those parts instead of showing empty ones. */

export interface AnalyticsCapabilities {
  /** Sign-in attempts are logged. False on this backend: sign-in charts and numbers are hidden. */
  signInAudit: boolean;
  /** Names / student IDs are included. False for the platform owner (aggregates only). */
  personRows: boolean;
  /** The viewer can clear a wrong-PIN lock (School Admin in an ID + PIN school). */
  pinUnlock: boolean;
  /** The server can send email ("Email PDF"). */
  email: boolean;
}

export interface AnalyticsKpis {
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

export interface AnalyticsClass {
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

export interface SchoolAnalytics {
  generatedAt: string;
  school: { id: string; code: string; name: string } | null;
  days: number;
  /** Absent on an older backend — treated as everything available. */
  capabilities?: AnalyticsCapabilities;
  kpis: AnalyticsKpis;
  checkInsByDay: { day: string; present: number; late: number; other: number; withCheckout: number }[];
  signInsByDay: { day: string; ok: number; failed: number }[];
  checkInOutcomesByDay: { day: string; checkedIn: number; firstTry: number; retriedThenIn: number; gaveUp: number; failedAttempts: number }[];
  /** `reason` is the server's own failure message (e.g. "Beacon signal too weak…"), not a code. */
  checkInFailureReasons: { reason: string; channel: string; count: number; students: number }[];
  failureReasons: { reason: string; count: number }[];
  classes: AnalyticsClass[];
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
  /* ---- Trends (backend 2026-11-04; absent on an older backend, so every one is optional) ---- */
  /** Per day: classes that started, seats expected (enrolled students per class), check-ins to those classes. */
  attendanceByDay?: { day: string; classes: number; expected: number; attended: number; students: number; emptyClasses: number }[];
  /** ISO weekday (1 = Monday) × hour of day, EAT. */
  checkInsByHour?: { dow: number; hour: number; count: number }[];
  failuresByHour?: { hour: number; count: number }[];
  /** Minutes after the class start: early, 0-5, 5-10, 10-15, 15-30, 30-60, 60+. */
  lateness?: { bucket: string; count: number }[];
  courses?: AnalyticsCourse[];
  /** Every enrolled student with a class held in the period, lowest attendance first. */
  students?: AnalyticsStudent[];
  failureReasonsByDay?: { day: string; reason: string; count: number }[];
  signInFailuresByDay?: { day: string; reason: string; count: number }[];
  rssiByDay?: { day: string; avg: number | null; min: number | null; max: number | null; failAvg: number | null }[];
  onboardingByDay?: { day: string; signedIn: number; terms: number; baseline: number }[];
  onboardingBefore?: { signedIn: number; terms: number; baseline: number };
  previousPeriod?: { checkIns: number; checkOuts: number; expected: number; attended: number; failedAttempts: number; signInsOk: number; signInsFailed: number };
}

export interface AnalyticsCourse {
  id: string; code: string; name: string; lecturer: string; enrolled: number; classesHeld: number;
  checkins: number; late: number; checkouts: number; avgRssi: number | null;
  failedAttempts: number; studentsFailing: number; gaveUp: number;
}

export interface AnalyticsStudent {
  id: string; studentId: string | null; name: string; signedIn: boolean; baseline: boolean; phone: string | null; pinLocked: boolean;
  expected: number; attended: number; lastCheckInAt: string | null; failedAttempts: number; lastFailReason: string | null;
}

/** SUPER_ADMIN's cross-school roll-up — one row of headline numbers per school. */
export interface AnalyticsSchoolRow {
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
  /** Absent on this backend (no sign-in audit trail). */
  signInsToday?: number;
  failedSignInsToday?: number;
  failedCheckInsToday: number;
  failedCheckInsThisWeek: number;
  gaveUpThisWeek: number;
  openTickets: number;
  lastCheckInAt: string | null;
}

export interface AnalyticsSchoolsSummary {
  generatedAt: string;
  capabilities?: { signInAudit: boolean };
  schools: AnalyticsSchoolRow[];
}

/** The platform's routes for a Super Admin, the school's own for everyone else (the backend pins them). */
const base = (platform: boolean) => (platform ? '/platform/school-analytics' : '/school-analytics');

/** Only ever called for SUPER_ADMIN — the route 403s for everyone else. */
export const ANALYTICS_SCHOOLS_PATH = '/platform/school-analytics/schools';

export const schoolAnalyticsPath = (platform: boolean, days: number, schoolId?: string | null) =>
  `${base(platform)}?days=${days}${platform && schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`;

/** Clears the wrong-PIN lock only — the student keeps whatever PIN they had. School Admin only. */
export const unlockStudentPin = (userId: string) =>
  api.post<{ ok: true }>(`/school-analytics/students/${encodeURIComponent(userId)}/unlock-pin`);

/** The PDF report to one address. Errors carry the server's message (e.g. email not set up). */
export const emailAnalyticsReport = (platform: boolean, body: { to: string; schoolId?: string; days: number; filename: string; pdfBase64: string; note?: string }) =>
  api.post<{ sent: true }>(`${base(platform)}/report-email`, body);

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

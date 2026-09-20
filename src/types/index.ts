export type Role =
  | 'SUPER_ADMIN' | 'SUB_ADMIN' | 'LECTURER' | 'STUDENT' | 'INVIGILATOR'
  // Enterprise hierarchy tiers (additive) — see server/prisma/schema.prisma Role enum comment.
  | 'VC' | 'DVC' | 'REGISTRAR_ACADEMIC' | 'REGISTRAR_ADMIN' | 'DEAN' | 'HOD' | 'DEPUTY_HOD' | 'ICT_ADMIN'
  // Guaranteed first account per School, and the front-of-house mobile/dashboard staff persona —
  // see server/prisma/schema.prisma's Role enum comment for both.
  | 'SCHOOL_ADMIN' | 'CLIENT_EXPERIENCE_MANAGER';

/** See server/prisma/schema.prisma's Permission enum comment — a permission means the same thing
 * regardless of which surface (mobile or dashboard) the holder is on. */
export type Permission =
  | 'MOBILE_ACCESS' | 'DASHBOARD_ACCESS'
  | 'MANAGE_USERS' | 'MANAGE_SCHOOL_SETTINGS' | 'MANAGE_COURSES' | 'MANAGE_ANNOUNCEMENTS' | 'VIEW_ANALYTICS' | 'MANAGE_TICKETS'
  | 'VIEW_BIRTHDAYS' | 'VIEW_BLE_CHECKINS' | 'VIEW_MANUAL_CHECKINS' | 'MANUAL_CHECK_IN' | 'MESSAGING'
  | 'BROADCAST_STUDENTS_APPROVED' | 'BROADCAST_CLASS_SCHEDULE'
  // Executive onboarding journey (School.features.onboardingJourney) — program-start welcome,
  // materials-ready, free-form updates, and on-demand feedback requests.
  | 'BROADCAST_PROGRAM_WELCOME' | 'BROADCAST_MATERIALS_READY' | 'BROADCAST_UPDATE' | 'REQUEST_FEEDBACK'
  | 'VIEW_ANALYTICS_DEMOGRAPHICS'
  | 'MANAGE_MATERIALS'
  // Sidebar-scoped view/manage pairs — see server's Permission enum comment for each.
  | 'VIEW_LIVE_ATTENDANCE' | 'VIEW_REPORTS'
  | 'VIEW_ESCALATIONS' | 'MANAGE_ESCALATIONS'
  | 'VIEW_FACILITIES' | 'MANAGE_FACILITY_TICKETS'
  | 'VIEW_INVIGILATION' | 'MANAGE_INVIGILATION'
  | 'VIEW_DEVICE_VERIFICATION' | 'MANAGE_DEVICE_VERIFICATION'
  | 'VIEW_FRAUD_DETECTION';

/** A school-defined named bundle of Permissions — see server's CustomRole model doc comment.
 * Editing `permissions` here changes what every holder can do immediately. */
export interface CustomRole {
  id: string;
  schoolId: string;
  name: string;
  permissions: Permission[];
  /** UI hint only — which account type this role is meant for (LECTURER or
   * CLIENT_EXPERIENCE_MANAGER), or null/undefined for "either". Narrows the "New User" form's
   * custom-role dropdown to roles that actually make sense for the account type just picked. */
  appliesTo?: 'LECTURER' | 'CLIENT_EXPERIENCE_MANAGER' | null;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
}

export interface StaffCourseAssignment {
  id: string;
  userId: string;
  courseId: string;
  course?: Pick<Course, 'id' | 'name' | 'code'>;
}

export type ScopeLevel = 'UNIVERSITY' | 'DIVISION' | 'SCHOOL' | 'DEPARTMENT' | 'SUB_DEPARTMENT' | 'INDIVIDUAL';
export type OrgUnitLevel = 'DIVISION' | 'FACULTY' | 'DEPARTMENT' | 'SUB_DEPARTMENT';

export interface OrgUnit {
  id: string;
  schoolId: string;
  parentId: string | null;
  parent?: Pick<OrgUnit, 'id' | 'name' | 'level'> | null;
  level: OrgUnitLevel;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { children: number; users: number };
}
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEACTIVATED' | 'DELETED';
export type CheckInType = 'BLE' | 'QR' | 'MANUAL' | 'ONLINE';

export interface SchoolFeatures {
  anonymousChat?: boolean;
  biometricStrictMode?: boolean;
  broadcasts?: boolean;
  faceIdCheckIn?: boolean;
  dwellTimeTracking?: boolean;
  messaging?: boolean;
  execEdSuite?: boolean;
  onboardingJourney?: boolean;
  /** Opt-out — the "Tell Us About You" progressive-profiling prompt (gender/DOB/etc.) students
   * are asked once after baseline capture. Off stops asking students who haven't answered yet;
   * already-answered students are untouched. */
  profileCompletionPrompt?: boolean;
}

export type AttendanceMode = 'CALENDAR_BASED' | 'STAGE_BASED';

export interface School {
  id: string;
  name: string;
  code: string;
  color: string;
  lateThresholdMinutes?: number;
  extremelyLateThresholdMinutes?: number;
  attendanceThreshold?: number;
  allowManualLecturerOverride?: boolean;
  features?: SchoolFeatures;
  // Parent institution name (e.g. "Strathmore University" for SBS). Schools sharing this value
  // are grouped on mobile into a university → tenant-grid picker (SchoolSelectionView), but only
  // once at least one of them has execEdSuite on — see execEdInstitutions there. Otherwise purely
  // informational.
  institutionName?: string | null;
  // Calendar-scheduled (default) vs. stage-based progression (Program/Module pipeline, no
  // calendar at all — see Program/Module below).
  attendanceMode?: AttendanceMode;
  // Set only for schools on isolated, separately-provisioned backend infrastructure (e.g. the
  // Moi Pilot). Null/undefined means this school lives on the default shared backend.
  apiBaseUrl?: string | null;
  createdAt: string;
}

export type ProgramTemplate = 'COFFEE_ONLY' | 'BARTENDING_ONLY' | 'COMBINED';
export type ModuleStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED';

export interface Program {
  id: string;
  name: string;
  schoolId: string;
  template: ProgramTemplate;
  theoryCourseId?: string | null;
  theoryCourse?: Pick<Course, 'id' | 'name' | 'code'> | null;
  coffeeCourseId?: string | null;
  coffeeCourse?: Pick<Course, 'id' | 'name' | 'code'> | null;
  bartendingCourseId?: string | null;
  bartendingCourse?: Pick<Course, 'id' | 'name' | 'code'> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { enrollments: number };
}

export interface ProgramModule {
  id: string;
  programEnrollmentId: string;
  name: string;
  sequenceOrder: number;
  status: ModuleStatus;
  beaconUUID: string;
  beaconMajor: number;
  beaconMinor: number;
  rssiThreshold: number;
  sessionsTarget: number;
  classId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentModules {
  program: Pick<Program, 'id' | 'name' | 'template'>;
  modules: ProgramModule[];
}

export interface Term {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface Major {
  id: string;
  name: string;
  code: string;
  schoolId: string;
  school?: School;
}

export interface Cohort {
  id: string;
  name: string;
  year: number;
  schoolId: string;
  school?: School;
  /** execEdSuite-only Client Experience Manager assignment (SBS Comms & Concierge plan). */
  assignedCemId?: string | null;
  assignedCem?: User | null;
}

export interface Level {
  id: string;
  name: string;
  schoolId: string;
  school?: School;
}

/// A physical room a Beacon can be assigned to — see server's Classroom model doc comment.
export interface Classroom {
  id: string;
  name: string;
  schoolId: string;
  school?: School;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { beacons: number };
}

export interface User {
  id: string;
  email: string;
  /** True until the account has accepted the *current* terms version (QA plan Phase 21). */
  termsRequired?: boolean;
  currentTermsVersion?: string;
  termsAcceptedAt?: string | null;
  firstName: string;
  lastName: string;
  studentId?: string;
  role: Role;
  status: UserStatus;
  avatarUrl?: string;
  schoolId?: string;
  school?: School;
  createdAt: string;
  updatedAt?: string;
  deactivatedAt?: string | null;
  /** LECTURER only — grants exam-QR-scanner access without a separate INVIGILATOR account. */
  canInvigilate?: boolean;
  /** Always the *effective* set — a CustomRole, if assigned, wins outright over these (see
   * server's resolveEffectivePermissions). Empty for every role that predates this feature. */
  permissions?: Permission[];
  customRoleId?: string | null;
  customRoleName?: string | null;
  /** Executive onboarding journey (School.features.onboardingJourney) — 25/50/75/100, derived
   * server-side from status/baselineCapturedAt/profileCompletedAt. Only meaningful for STUDENT;
   * only worth displaying when the school has the feature on. */
  onboardingProgress?: number;
  /** Enterprise hierarchy tiers only — undefined/default for every legacy role. */
  scopeLevel?: ScopeLevel;
  orgUnitId?: string | null;
  isActingHod?: boolean;
  /** Executive Ed progressive profiling — captured once via a post-baseline-capture mobile
   * prompt (STUDENT only), never a signup-time requirement. All optional even for accounts that
   * have completed the prompt, since every field can be skipped individually. */
  gender?: string | null;
  nationality?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  dateOfBirth?: string | null;
  profileCompletedAt?: string | null;
  /** True when gender/nationality read null only because the viewer's tier can't see them (see
   * server's maskDemographics), not because the student never shared them — only ever set on the
   * /users/:id detail response. */
  demographicsMasked?: boolean;
  _count?: {
    enrollments: number;
    attendances: number;
    taughtCourses: number;
  };
}

export interface UserDetail extends User {
  enrollments?: {
    courseId: string;
    course: Course;
  }[];
  taughtCourses?: (Course & { termId: string | null; termName: string | null; termStatus: 'ACTIVE' | 'ARCHIVED' | null; attendanceRate: number })[];
  attendances?: AttendanceRecord[];
  courseStats?: {
    courseId: string;
    courseName: string;
    total: number;
    attended: number;
    percentage: number;
  }[];
  biometricLockEnabled?: boolean;
  biometricLockInvalidatedAt?: string | null;
  boundDeviceId?: string | null;
  boundDeviceModel?: string | null;
  deviceBoundAt?: string | null;
  pendingDeviceId?: string | null;
  pendingDeviceModel?: string | null;
  pendingDeviceRegisteredAt?: string | null;
  pendingDeviceReason?: DeviceChangeReason | null;
  pendingDeviceNote?: string | null;
  /** The set that actually governs access — CustomRole wins outright over `permissions` when
   * assigned (see resolveEffectivePermissions). Only ever populated on this detail response. */
  effectivePermissions?: Permission[];
  orgUnit?: { id: string; name: string; level: string } | null;
  externalIdentifiers?: { provider: 'CANVAS' | 'MOODLE' | 'SALESFORCE'; externalId: string; createdAt: string }[];
  // Security/compliance fields — every scalar on User comes through this endpoint already;
  // these are the ones not otherwise surfaced anywhere in the dashboard yet.
  tamperFlag?: boolean;
  tamperFlaggedAt?: string | null;
  termsAccepted?: boolean;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
  authMode?: 'UNENROLLED' | 'BIOMETRIC_LOCK' | 'LIVE_SELFIE' | 'DEVICE_BOUND' | string;
  claimedAt?: string | null;
  requiresBaselineRetake?: boolean;
  baselineCapturedAt?: string | null;
  fcmToken?: string | null;
}

export type DeviceChangeReason = 'LOST_PHONE' | 'NEW_PHONE' | 'DAMAGED' | 'STOLEN' | 'OTHER';

export interface PendingDeviceBinding {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
  deviceId: string;
  deviceModel: string;
  createdAt: string;
  reason: DeviceChangeReason | null;
  note: string | null;
  /** Present only for change requests (student already had a device bound before this one). */
  currentDeviceModel: string | null;
}

export interface DeviceSecurityEvent {
  id: string;
  type: 'CONFLICT_BLOCKED' | 'CHANGE_REQUESTED' | 'APPROVED' | 'DENIED' | 'TAMPER_DEMOTION';
  deviceId: string | null;
  deviceModel: string | null;
  reason: DeviceChangeReason | null;
  note: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; studentId: string | null };
  conflictingUser: { id: string; firstName: string; lastName: string; studentId: string | null } | null;
}

export interface SchoolStats {
  id: string;
  name: string;
  code: string;
  color: string;
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  pendingApprovals: number;
  pendingDeviceRequests: number;
  todayCheckins: number;
  openTickets: number;
}

export interface Beacon {
  id: string;
  uuid: string;
  name: string;
  major: number;
  minor: number;
  rssiThreshold: number;
  location?: string;
  description?: string;
  isActive: boolean;
  schoolId?: string | null;
  school?: School | null;
  classroomId?: string | null;
  classroom?: Pick<Classroom, 'id' | 'name'> | null;
  batteryLevel?: number | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
  courses?: Pick<Course, 'id' | 'name' | 'code'>[];
  // Physical room layout + RF calibration — set once via the admin Heatmap Simulator's "Apply to
  // a Real Beacon" action. Null on any of these means this beacon has never been placed.
  roomWidthM?: number | null;
  roomLengthM?: number | null;
  ceilingHeightM?: number | null;
  xPosition?: number | null;
  yPosition?: number | null;
  rssiAt1m?: number | null;
  pathLossExponent?: number | null;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  schoolId: string;
  school?: School;
  lecturerId: string;
  lecturer?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  room?: string;
  beaconId?: string;
  beacon?: Pick<Beacon, 'id' | 'uuid' | 'name' | 'major' | 'minor' | 'rssiThreshold'>;
  /// Full multi-beacon set (large room, weak single-beacon coverage) — independent of the legacy
  /// single beaconId/beacon above.
  courseBeacons?: { beacon: Pick<Beacon, 'id' | 'uuid' | 'name' | 'major' | 'minor' | 'rssiThreshold'> }[];
  orgUnitId?: string | null;
  orgUnit?: Pick<OrgUnit, 'id' | 'name' | 'level'> | null;
  _count?: { enrollments: number; classes: number };
  enrollments?: { user: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'> }[];
  classes?: ClassSession[];
  majors?: { major: Major }[];
  cohorts?: { cohort: Cohort }[];
  levels?: { level: Level }[];
}

export interface ClassSession {
  id: string;
  courseId: string;
  course?: Course;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  beaconUUID: string;
  beaconMajor: number;
  beaconMinor: number;
  rssiThreshold: number;
  checkInStart?: string;
  checkInEnd?: string;
  isActive: boolean;
  isOnline?: boolean;
  _count?: { attendances: number };
  attendances?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'>;
  classId: string;
  class?: ClassSession;
  checkInAt: string;
  checkOutAt?: string;
  beaconRSSI?: number;
  // Dwell-averaged reading (AttendanceVerification.avgRssi) — more accurate than the single-point
  // beaconRSSI above for placing this student's real signal on the Room Signal Map; null for
  // QR/manual/online check-ins, which never touch a beacon.
  avgRssi?: number | null;
  // This student's most recent FAILED attempt's avgRssi before they eventually checked in, if
  // any — deliberately just the one most recent reading (not every tap) to keep the roster
  // readable. Null if they never had a failed attempt logged.
  lastFailedAvgRssi?: number | null;
  checkInType: CheckInType;
  checkedInBy?: string;
  status: string;
  punctuality?: 'ON_TIME' | 'LATE' | 'EXTREMELY_LATE';
  deltaMinutes?: number;
}

export interface CourseAttendanceSession {
  classId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  isOnline: boolean;
  attended: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInType: string | null;
  status: string;
  deviceId: string | null;
  deviceModel: string | null;
  deviceOSVersion: string | null;
  verificationMethod: string | null;
}

/** GET /users/:id/courses/:courseId/attendance — session-by-session drill-down for one student. */
export interface CourseAttendanceDetail {
  student: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'>;
  course: { id: string; name: string; code: string };
  totalSessions: number;
  attended: number;
  percentage: number;
  sessions: CourseAttendanceSession[];
}

export interface ClassAttendanceDetail {
  classInfo: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
    courseName: string;
    courseCode: string;
    allowManualLecturerOverride: boolean;
    isOnline?: boolean;
    // The specific physical Beacon backing this class's check-ins, resolved server-side by
    // matching (uuid, major, minor) — null if no matching Beacon row exists (e.g. an ad-hoc
    // class beacon that was never registered in the Beacon Manager).
    beacon?: Pick<
      Beacon,
      'id' | 'name' | 'roomWidthM' | 'roomLengthM' | 'ceilingHeightM' | 'xPosition' | 'yPosition' | 'rssiThreshold' | 'rssiAt1m' | 'pathLossExponent'
    > | null;
    // Present only when this class is a stage-based Program's Module — lets the roster show a
    // "Promote to Next Stage" action for that module's one enrolled student.
    module?: { id: string; status: ModuleStatus; sequenceOrder: number; studentId: string } | null;
  };
  totalEnrolled: number;
  totalCheckedIn: number;
  attendances: AttendanceRecord[];
  absentStudents: (Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'> & { lastFailedAvgRssi?: number | null })[];
}

/** A logged weak-signal or rejected check-in attempt — see server CheckInGateAttempt. */
export interface GateAttempt {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'>;
  classId: string | null;
  channel: 'BLE' | 'QR' | 'ONLINE' | 'CHECKOUT';
  reason: string;
  avgRssi?: number | null;
  sampleCount?: number | null;
  dwellSeconds?: number | null;
  createdAt: string;
}

export interface ClassPingResponse {
  id: string;
  pingId: string;
  userId: string;
  rssi: number | null;
  respondedAt: string;
}

export interface ClassPing {
  id: string;
  classId: string;
  initiatedById: string;
  createdAt: string;
  expiresAt: string;
  responses?: ClassPingResponse[];
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdByName: string;
  school: { id: string; name: string } | null;
  course: { id: string; name: string; code: string } | null;
  major: { id: string; name: string; code: string } | null;
  /** Executive Ed Phase 7 — cohort-scoped targeting, alongside course/major. */
  cohort: { id: string; name: string; year: number } | null;
  /** Delivery channels this broadcast fanned out to — defaults to ['IN_APP'] server-side. */
  channels?: ('IN_APP' | 'EMAIL')[];
  resourceUrl: string | null;
  resourceLabel: string | null;
  createdAt: string;
  isRead: boolean;
}

/** "Request Feedback" — a cohort-wide ad hoc survey, distinct from Broadcast (announcement, no
 * response expected) and from the attendance-scoped NPS engine. See server/src/services/
 * feedbackRequest.service.ts. */
export interface FeedbackRequest {
  id: string;
  title: string;
  prompt: string;
  createdByName: string;
  cohort: { id: string; name: string; year: number };
  school: { id: string; name: string };
  createdAt: string;
  recipientCount: number;
  responseCount: number;
}

export interface FeedbackRequestResponseRow {
  id: string;
  studentName: string;
  npsScore: number;
  comment: string | null;
  createdAt: string;
}

export interface FeedbackRequestResults {
  id: string;
  title: string;
  prompt: string;
  cohort: { id: string; name: string; year: number };
  createdAt: string;
  recipientCount: number;
  avgScore: number | null;
  responses: FeedbackRequestResponseRow[];
}

/** One row from GET /attendance/course-records (CSV export). */
export interface CourseAttendanceExportRow {
  classTitle: string;
  classDate: string;
  room?: string | null;
  studentId?: string | null;
  firstName: string;
  lastName: string;
  checkInAt: string;
  checkOutAt: string | null;
  checkInType: CheckInType | string;
  punctuality: string;
}

export interface ClassAttendanceStat {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  course: {
    id: string;
    name: string;
    code: string;
    lecturer: Pick<User, 'id' | 'firstName' | 'lastName'>;
  };
  totalEnrolled: number;
  totalCheckedIn: number;
  attendanceRate: number;
  checkInBreakdown: {
    BLE: number;
    QR: number;
    MANUAL: number;
  };
}

/** GET /attendance/campus-analytics — admin matte analytics bento bundle */
/** Row from GET /feedback/analytics/participation-by-gender (Executive Ed Phase 9) — one row per
 * course x gender, already aggregated server-side (v_module_participation_by_gender view), so no
 * demographic masking needed on this shape. Raw snake_case column names, matching the SQL view. */
export interface NpsParticipationByGenderRow {
  course_id: string;
  course_name: string;
  course_code: string;
  gender: string | null;
  enrolled_count: number;
  class_count: number;
  possible_checkins: number;
  present_checkins: number;
  participation_rate_pct: number;
}

/** Row from GET /feedback/analytics/nps-by-lecturer (Executive Ed Phase 9) — one row per class
 * session with its average NPS score (v_module_nps_by_lecturer view). */
export interface NpsByLecturerRow {
  course_id: string;
  course_name: string;
  course_code: string;
  lecturer_id: string;
  lecturer_name: string;
  class_id: string;
  class_title: string;
  class_date: string;
  avg_nps: number | null;
  response_count: number;
}

export interface CampusAnalytics {
  fetchedAtIso: string;
  scopedSchoolId: string | null;
  attendanceThreshold: number;
  overallAttendancePct: number;
  overallTrendSparkline: { label: string; date: string; value: number }[];
  attendanceDecayByWeek: {
    weekLabel: string;
    pct: number;
    volumePresent: number;
    volumeEligible: number;
  }[];
  blockedGateAttemptsBle: number;
  blockedGateAttemptsQr: number;
  atRiskStudentCount: number;
  atRiskStudents: { id: string; studentId: string; displayName: string; attendancePct: number }[];
  trafficHeatmapCells: { dayIdx: number; hour: number; intensity: number; dayLabel: string }[];
  trafficHeatmapMax: number;
  hourRange: { start: number; end: number };
  roomUtilization: {
    room: string;
    enrolledTotal: number;
    checkedInTotal: number;
    utilizationPct: number;
  }[];
  unloggedSessions: {
    id: string;
    title: string;
    courseCode: string;
    lecturerName: string;
    dateIso: string;
    enrolled: number;
  }[];
  sessionCount: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalLecturers: number;
  totalCourses: number;
  totalClasses: number;
  todayAttendances: number;
  pendingApprovals: number;
  recentAttendances: AttendanceRecord[];
  attendanceByDay: { date: string; count: number }[];
  attendanceThreshold: number;
  biometricFlagsCount: number;
}

export interface ExecutiveSummary {
  activeTermName: string | null;
  campusAttendanceRate: number;
  totalBiometricFlags: number;
  hardwareHealthPct: number;
  beaconsOnline: number;
  beaconsTotal: number;
  lowestPerformingFaculty: { name: string; attendanceRate: number } | null;
}

export interface Conversation {
  id: string;
  otherUser: Pick<User, 'id' | 'firstName' | 'lastName' | 'role' | 'avatarUrl'>;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface AnalyticsStat {
  courseId: string;
  courseName: string;
  total: number;
  attended: number;
  percentage: number;
}

export interface RoomTargets {
  schoolId: string | null;
  courses: { id: string; name: string; code: string }[];
}

export interface RoomMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  sender: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  content: string;
  isAnonymous: boolean | null;
  isMine: boolean;
  createdAt: string;
}

export interface RoomMessagesResponse {
  messages: RoomMessage[];
  isAnonymousEnabled: boolean;
}

export interface ContactGroup {
  courseId: string;
  courseName: string;
  courseCode: string;
  contacts: (Pick<User, 'id' | 'firstName' | 'lastName' | 'role' | 'avatarUrl'> & { email?: string })[];
}

export interface ConversationRoomInfo {
  id: string;
  title?: string; // Class room (legacy)
  name?: string;  // School room, or Course room
  code?: string;  // Course room
  course?: { name: string; code: string }; // Class room's parent course
}

export interface AdminConversation {
  id: string;
  kind: 'DIRECT' | 'CLASS' | 'COURSE' | 'SCHOOL';
  user1: (Pick<User, 'id' | 'firstName' | 'lastName' | 'role' | 'avatarUrl'> & { email?: string }) | null;
  user2: (Pick<User, 'id' | 'firstName' | 'lastName' | 'role' | 'avatarUrl'> & { email?: string }) | null;
  room: ConversationRoomInfo | null;
  lastMessage?: Message;
  messageCount: number;
  hasPendingFlags: boolean;
  pendingFlagCount: number;
  /** COURSE/SCHOOL rooms only — resolved effective value (null for DIRECT/CLASS). */
  isAnonymousEnabled: boolean | null;
  updatedAt: string;
  createdAt: string;
}

export interface AdminConversationDetail {
  conversation: {
    id: string;
    kind: 'DIRECT' | 'CLASS' | 'COURSE' | 'SCHOOL';
    user1: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null;
    user2: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null;
    room: ConversationRoomInfo | null;
  };
  messages: (Message & {
    sender?: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'>;
    isAnonymous?: boolean;
    flags?: MessageFlag[];
  })[];
}

export interface MessageFlag {
  id: string;
  conversationId: string;
  messageId?: string;
  message?: Pick<Message, 'id' | 'content' | 'createdAt' | 'senderId'>;
  flaggedById: string;
  flaggedBy?: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'>;
  reason: string;
  status: string;
  resolvedById?: string;
  resolvedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  resolvedNote?: string;
  conversation?: {
    id: string;
    kind?: 'DIRECT' | 'CLASS' | 'COURSE' | 'SCHOOL';
    user1: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null;
    user2: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'> | null;
    room?: ConversationRoomInfo | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'MESSAGE' | 'ATTENDANCE' | 'FLAG' | 'SYSTEM' | 'TICKET' | 'FACILITY_TICKET' | 'FACILITY_TICKET_ACKNOWLEDGED';
  title: string;
  body: string;
  read: boolean;
  metadata?: string;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  sender?: Pick<User, 'id' | 'firstName' | 'lastName' | 'role'>;
  content: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  schoolId: string;
  school?: Pick<School, 'id' | 'name' | 'code' | 'color'>;
  createdById: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assignedToId?: string | null;
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  messages?: TicketMessage[];
  _count?: { messages: number };
  createdAt: string;
  updatedAt: string;
}

/** SBS Comms & Concierge plan, Phase 3 — Facilities Escalation Engine. Deliberately its own type,
 * not reusing `Ticket` — a distinct model server-side (`FacilityTicket`), different lifecycle
 * (acknowledge/resolve vs the platform-support ticket's IN_PROGRESS/CLOSED), and its own SLA
 * timer (`slaBreachedAt`). */
export type FacilityTicketPreset = 'AC_TOO_COLD' | 'AV_ISSUE' | 'CATERING' | 'OTHER';

export interface FacilityTicketMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: Pick<User, 'id' | 'firstName' | 'lastName'> & { role?: Role };
}

export interface FacilityTicket {
  id: string;
  schoolId: string;
  school?: Pick<School, 'id' | 'name' | 'code' | 'color'>;
  classId?: string | null;
  class?: { id: string; title: string; room?: string | null } | null;
  createdById: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  presetType: FacilityTicketPreset;
  detail?: string | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  priority: 'NORMAL' | 'URGENT';
  assignedToId?: string | null;
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  slaBreachedAt?: string | null;
  messages?: FacilityTicketMessage[];
  _count?: { messages: number };
  createdAt: string;
  updatedAt: string;
}

export interface Escalation {
  id: string;
  studentId: string;
  student?: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'> & { biometricLockInvalidatedAt?: string | null };
  classId: string;
  class?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    course: { id: string; name: string; code: string; lecturerId: string };
  };
  schoolId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  resolvedById?: string | null;
  resolvedBy?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type IntegrationProvider = 'CANVAS' | 'MOODLE' | 'SALESFORCE';

export interface IntegrationSyncSummary {
  coursesMatched?: number;
  coursesUnmatched?: { externalId: string; name: string; code: string }[];
  enrollmentsCreated?: number;
  usersUnmatched?: string[];
  recordsConsidered?: number;
  pushed?: number;
  errors?: string[];
}

export interface IntegrationConnection {
  id: string;
  schoolId: string;
  provider: IntegrationProvider;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  lastSyncError: string | null;
  lastSyncSummary: IntegrationSyncSummary | null;
  createdAt: string;
  updatedAt: string;
}

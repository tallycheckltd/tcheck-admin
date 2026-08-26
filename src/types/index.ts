export type Role =
  | 'SUPER_ADMIN' | 'SUB_ADMIN' | 'LECTURER' | 'STUDENT' | 'INVIGILATOR'
  // Enterprise hierarchy tiers (additive) — see server/prisma/schema.prisma Role enum comment.
  | 'VC' | 'DVC' | 'REGISTRAR_ACADEMIC' | 'REGISTRAR_ADMIN' | 'DEAN' | 'HOD' | 'DEPUTY_HOD' | 'ICT_ADMIN';

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
}

export interface Level {
  id: string;
  name: string;
  schoolId: string;
  school?: School;
}

export interface User {
  id: string;
  email: string;
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
  /** Enterprise hierarchy tiers only — undefined/default for every legacy role. */
  scopeLevel?: ScopeLevel;
  orgUnitId?: string | null;
  isActingHod?: boolean;
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
  resourceUrl: string | null;
  resourceLabel: string | null;
  createdAt: string;
  isRead: boolean;
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
  type: 'MESSAGE' | 'ATTENDANCE' | 'FLAG' | 'SYSTEM' | 'TICKET';
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

export interface Escalation {
  id: string;
  studentId: string;
  student?: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'>;
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

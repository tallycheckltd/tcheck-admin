export type Role = 'SUPER_ADMIN' | 'SUB_ADMIN' | 'LECTURER' | 'STUDENT' | 'INVIGILATOR';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEACTIVATED' | 'DELETED';
export type CheckInType = 'BLE' | 'QR' | 'MANUAL' | 'ONLINE';

export interface SchoolFeatures {
  anonymousChat?: boolean;
  biometricStrictMode?: boolean;
  broadcasts?: boolean;
  faceIdCheckIn?: boolean;
  dwellTimeTracking?: boolean;
}

export interface School {
  id: string;
  name: string;
  code: string;
  color: string;
  lateThresholdMinutes?: number;
  extremelyLateThresholdMinutes?: number;
  allowManualLecturerOverride?: boolean;
  features?: SchoolFeatures;
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
  taughtCourses?: Course[];
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
  type: 'CONFLICT_BLOCKED' | 'CHANGE_REQUESTED' | 'APPROVED' | 'DENIED';
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
  createdAt: string;
  updatedAt: string;
  courses?: Pick<Course, 'id' | 'name' | 'code'>[];
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
  };
  totalEnrolled: number;
  totalCheckedIn: number;
  attendances: AttendanceRecord[];
  absentStudents: Pick<User, 'id' | 'firstName' | 'lastName' | 'studentId'>[];
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
  overallAttendancePct: number;
  overallTrendSparkline: { label: string; value: number }[];
  attendanceDecayByWeek: {
    weekLabel: string;
    pct: number;
    volumePresent: number;
    volumeEligible: number;
  }[];
  blockedGateAttemptsBle: number;
  blockedGateAttemptsQr: number;
  atRiskStudentCount: number;
  atRiskStudents: { studentId: string; displayName: string; attendancePct: number }[];
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

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

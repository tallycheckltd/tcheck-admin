import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RequireSuperAdmin } from './components/guards/RequireSuperAdmin';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { OverviewPage } from './pages/admin/OverviewPage';
import { SchoolsPage } from './pages/admin/SchoolsPage';
import { CohortsPage } from './pages/admin/CohortsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UserDetailPage } from './pages/admin/UserDetailPage';
import { CourseAttendanceDetailPage } from './pages/admin/CourseAttendanceDetailPage';
import { AttendanceAnalyticsPage } from './pages/admin/AttendanceAnalyticsPage';
import { NpsAnalyticsPage } from './pages/admin/NpsAnalyticsPage';
import { AllStudentsPage } from './pages/admin/AllStudentsPage';
import { AllLecturersPage } from './pages/admin/AllLecturersPage';
import { BLEBeaconPage } from './pages/admin/BLEBeaconPage';
import { ClassroomsPage } from './pages/admin/ClassroomsPage';
import { BeaconHeatmapSimulatorPage } from './pages/admin/BeaconHeatmapSimulatorPage';
import { BeaconHealthPage } from './pages/admin/BeaconHealthPage';
import { DeviceVerificationPage } from './pages/admin/DeviceVerificationPage';
import { InvigilationPage } from './pages/admin/InvigilationPage';
import { LecturerPresencePage } from './pages/admin/LecturerPresencePage';
import { AttendanceOverviewPage } from './pages/admin/AttendanceOverviewPage';
import { LecturerDashboard } from './pages/lecturer/LecturerDashboard';
import { CoursesPage } from './pages/lecturer/CoursesPage';
import { ClassesPage } from './pages/lecturer/ClassesPage';
import { ClassAttendancePage } from './pages/lecturer/ClassAttendancePage';
import { LiveAttendancePage } from './pages/lecturer/LiveAttendancePage';
import { ReportsPage } from './pages/lecturer/ReportsPage';
import { MessagesPage } from './pages/lecturer/MessagesPage';
import { AnnouncementsPage } from './pages/lecturer/AnnouncementsPage';
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage';
import { FraudDetectionPage } from './pages/admin/FraudDetectionPage';
import { SchoolAdminsPage } from './pages/admin/SchoolAdminsPage';
import { OrgUnitsPage } from './pages/admin/OrgUnitsPage';
import { SetupWizardPage } from './pages/admin/SetupWizardPage';
import { TermsPage } from './pages/admin/TermsPage';
import { ProgramsPage } from './pages/admin/ProgramsPage';
import { LevelsPage } from './pages/admin/LevelsPage';
import { MajorsPage } from './pages/admin/MajorsPage';
import { CourseAssignmentsPage } from './pages/admin/CourseAssignmentsPage';
import { SystemAnnouncementsPage } from './pages/admin/SystemAnnouncementsPage';
import { RequestFeedbackPage } from './pages/admin/RequestFeedbackPage';
import { FeedbackRedirectPage } from './pages/public/FeedbackRedirectPage';
import { SupportPage } from './pages/admin/SupportPage';
import { EscalationsPage } from './pages/admin/EscalationsPage';
import { FacilitiesQueuePage } from './pages/admin/FacilitiesQueuePage';
import { RolesPermissionsPage } from './pages/admin/RolesPermissionsPage';
import { IntegrationsPage } from './pages/admin/IntegrationsPage';
import { StaffViewPage } from './pages/admin/StaffViewPage';
import { LegalPage } from './pages/LegalPage';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <RouteErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* Unauthenticated — the email CTA in sendFeedbackRequestEmail links here. Students
                aren't dashboard users; this page's only job is bouncing into the mobile app's
                tcheck://feedback deep link (see FeedbackRedirectPage.tsx). */}
            <Route path="/feedback/:requestId" element={<FeedbackRedirectPage />} />
            <Route element={<DashboardLayout />}>
              {/* Admin routes (SUPER_ADMIN + SUB_ADMIN) */}
              <Route path="/admin" element={<OverviewPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:id" element={<UserDetailPage />} />
              <Route path="/admin/users/:id/courses/:courseId" element={<CourseAttendanceDetailPage />} />
              <Route path="/admin/attendance-analytics" element={<AttendanceAnalyticsPage />} />
              <Route path="/admin/nps-analytics" element={<NpsAnalyticsPage />} />
              <Route path="/admin/students" element={<AllStudentsPage />} />
              <Route path="/admin/lecturers" element={<AllLecturersPage />} />
              <Route path="/admin/lecturer-presence" element={<LecturerPresencePage />} />
              <Route path="/admin/attendance-overview" element={<AttendanceOverviewPage />} />
              <Route path="/admin/fraud-detection" element={<FraudDetectionPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/admin/system-announcements" element={<SystemAnnouncementsPage />} />
              <Route path="/admin/request-feedback" element={<RequestFeedbackPage />} />
              <Route path="/admin/support" element={<SupportPage />} />
              {/* SUB_ADMIN is scoped to their own school's beacons; SUPER_ADMIN sees/manages all (beacon.service.ts enforces this) */}
              <Route path="/admin/beacons" element={<BLEBeaconPage />} />
              {/* Same school-scoping as beacons above (academic.service.ts's listClassrooms) */}
              <Route path="/admin/classrooms" element={<ClassroomsPage />} />
              {/* Same beacon-scoping rules as above — the simulator loads/saves via the same /beacons endpoints */}
              <Route path="/admin/beacon-heatmap" element={<BeaconHeatmapSimulatorPage />} />
              <Route path="/admin/beacon-health" element={<BeaconHealthPage />} />
              {/* SUB_ADMIN sees/adds co-admins for their own school only; SUPER_ADMIN sees/manages all (user.controller.ts + user.service.ts enforce this) */}
              <Route path="/admin/school-admins" element={<SchoolAdminsPage />} />
              <Route path="/admin/roles-permissions" element={<RolesPermissionsPage />} />
              <Route path="/staff" element={<StaffViewPage />} />
              <Route path="/admin/org-units" element={<OrgUnitsPage />} />
              <Route path="/admin/setup-wizard" element={<SetupWizardPage />} />
              <Route path="/admin/terms" element={<TermsPage />} />
              <Route path="/admin/programs" element={<ProgramsPage />} />
              {/* Previously built but unrouted (QA plan Phase 15) — same school-admin tier as the backend routes they call. */}
              <Route path="/admin/levels" element={<LevelsPage />} />
              <Route path="/admin/majors" element={<MajorsPage />} />
              <Route path="/admin/course-assignments" element={<CourseAssignmentsPage />} />
              {/* SUPER_ADMIN + SCHOOL_ADMIN (integration.routes.ts enforces this; a school admin is scoped to their own school) */}
              <Route path="/admin/integrations" element={<IntegrationsPage />} />

              {/* SUPER_ADMIN-only routes */}
              <Route element={<RequireSuperAdmin />}>
                <Route path="/admin/schools" element={<SchoolsPage />} />
                <Route path="/admin/cohorts" element={<CohortsPage />} />
                <Route path="/admin/messages" element={<AdminMessagesPage />} />
              </Route>

              {/* Lecturer dashboard */}
              <Route path="/lecturer" element={<LecturerDashboard />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />

              {/* Shared routes (admin and lecturer) */}
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/attendance" element={<ClassAttendancePage />} />
              <Route path="/attendance/course/:courseId" element={<ClassAttendancePage />} />
              <Route path="/attendance/:classId" element={<ClassAttendancePage />} />
              <Route path="/live" element={<LiveAttendancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              {/* SUPER_ADMIN + LECTURER (device.routes.ts enforces this on the backend; a lecturer is scoped to their own students) */}
              <Route path="/admin/device-verification" element={<DeviceVerificationPage />} />
              {/* SUPER_ADMIN + SUB_ADMIN + LECTURER (attendance.routes.ts enforces this; a lecturer is scoped to their own students) */}
              <Route path="/admin/invigilation" element={<InvigilationPage />} />
              {/* SUPER_ADMIN + SUB_ADMIN + LECTURER (escalation.routes.ts enforces this; a lecturer is scoped to their own classes) */}
              <Route path="/admin/escalations" element={<EscalationsPage />} />
              {/* SUPER_ADMIN + SUB_ADMIN + SCHOOL_ADMIN + LECTURER (facilityTicket.routes.ts enforces
                  this; a lecturer sees their own claim + unclaimed tickets at their school) */}
              <Route path="/admin/facilities" element={<FacilitiesQueuePage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/settings/compliance" element={<LegalPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </RouteErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

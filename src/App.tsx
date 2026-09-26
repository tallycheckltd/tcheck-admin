import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RequireSuperAdmin } from './components/guards/RequireSuperAdmin';
import { RequireRole } from './components/guards/RequireRole';
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
import { FeedbackIntelligencePage } from './pages/shared/FeedbackIntelligencePage';
import { ReportsIntelligencePage } from './pages/shared/ReportsIntelligencePage';
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
import { CemDashboardPage } from './pages/cem/CemDashboardPage';
import { CemCohortDetailPage } from './pages/cem/CemCohortDetailPage';
import { CemCohortPanelPage } from './pages/cem/CemCohortPanelPage';
import { CemFacilitiesPage } from './pages/cem/CemFacilitiesPage';
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
import { SetupWizardPage } from './pages/admin/SetupWizardPage';
import { TermsPage } from './pages/admin/TermsPage';
import { ProgramsPage } from './pages/admin/ProgramsPage';
import { LevelsPage } from './pages/admin/LevelsPage';
import { MajorsPage } from './pages/admin/MajorsPage';
import { CourseAssignmentsPage } from './pages/admin/CourseAssignmentsPage';
import { CourseDetailPage } from './pages/admin/CourseDetailPage';
import { SystemAnnouncementsPage } from './pages/admin/SystemAnnouncementsPage';
import { RequestFeedbackPage } from './pages/admin/RequestFeedbackPage';
import { FeedbackRedirectPage } from './pages/public/FeedbackRedirectPage';
import { EmailPreferencesPage } from './pages/public/EmailPreferencesPage';
import { EmailActivityPage } from './pages/admin/EmailActivityPage';
import { SupportPage } from './pages/admin/SupportPage';
import { EscalationsPage } from './pages/admin/EscalationsPage';
import { FacilitiesQueuePage } from './pages/admin/FacilitiesQueuePage';
import { PeopleOrganizationPage } from './pages/admin/PeopleOrganizationPage';
import { IntegrationsPage } from './pages/admin/IntegrationsPage';
import { StaffViewPage } from './pages/admin/StaffViewPage';
import { CemReportsPage } from './pages/admin/CemReportsPage';
import { AdminProgramDetailPage } from './pages/admin/AdminProgramDetailPage';
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
            {/* SBS Phase 9 — the link in optional emails; the token in the URL is the only credential. */}
            <Route path="/email-preferences" element={<EmailPreferencesPage />} />
            <Route element={<DashboardLayout />}>
              {/* Admin routes (SUPER_ADMIN + SUB_ADMIN) */}
              <Route path="/admin" element={<OverviewPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:id" element={<UserDetailPage />} />
              <Route path="/admin/users/:id/courses/:courseId" element={<CourseAttendanceDetailPage />} />
              <Route path="/admin/attendance-analytics" element={<AttendanceAnalyticsPage />} />
              <Route path="/admin/nps-analytics" element={<NpsAnalyticsPage />} />
              {/* SBS Phase 5 — role-scoped server-side; not under /feedback/* (that's the public deep-link redirect). */}
              <Route path="/insights/feedback" element={<FeedbackIntelligencePage />} />
              {/* SBS Phase 6 — Reports & Executive Intelligence (role-scoped server-side). */}
              <Route path="/insights/reports" element={<ReportsIntelligencePage />} />
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
              <Route path="/admin/people" element={<PeopleOrganizationPage />} />
              {/* Cross-CEM oversight — server-side gate (cem.routes.ts) is the source of truth:
                  SUPER_ADMIN, SUB_ADMIN, SCHOOL_ADMIN, DEAN, VC, DVC, HOD. */}
              <Route path="/admin/cem-reports" element={<CemReportsPage />} />
              {/* "Click a programme, see everything about it" — same server-side gate as
                  GET /cem/programs/:cohortId (cem.routes.ts). */}
              <Route path="/admin/programs/:cohortId" element={<AdminProgramDetailPage />} />
              {/* The two old pages were merged (QA plan Phase 11) — keep their URLs working. */}
              <Route path="/admin/roles-permissions" element={<Navigate to="/admin/people" replace />} />
              <Route path="/staff" element={<StaffViewPage />} />
              <Route path="/admin/org-units" element={<Navigate to="/admin/people" replace />} />
              <Route path="/admin/setup-wizard" element={<SetupWizardPage />} />
              <Route path="/admin/terms" element={<TermsPage />} />
              <Route path="/admin/programs" element={<ProgramsPage />} />
              {/* Previously built but unrouted (QA plan Phase 15) — same school-admin tier as the backend routes they call. */}
              <Route path="/admin/levels" element={<LevelsPage />} />
              <Route path="/admin/majors" element={<MajorsPage />} />
              <Route path="/admin/course-assignments" element={<CourseAssignmentsPage />} />
              <Route path="/admin/courses/:courseId" element={<CourseDetailPage />} />
              {/* SUPER_ADMIN + SCHOOL_ADMIN (integration.routes.ts enforces this; a school admin is scoped to their own school) */}
              <Route path="/admin/integrations" element={<IntegrationsPage />} />
              <Route path="/admin/email-activity" element={<EmailActivityPage />} />

              {/* SUPER_ADMIN-only routes */}
              <Route element={<RequireSuperAdmin />}>
                <Route path="/admin/schools" element={<SchoolsPage />} />
                <Route path="/admin/cohorts" element={<CohortsPage />} />
              </Route>

              {/* FIXED: was grouped under RequireSuperAdmin above, but message.routes.ts's
                  /admin/conversations, /flags etc. use requireRole('SUB_ADMIN', 'SCHOOL_ADMIN') and
                  deliberately EXCLUDE SUPER_ADMIN ("the platform must never read tenant message
                  content" — message.routes.ts) — the page was unreachable by anyone: SUPER_ADMIN
                  could load it but every API call 403'd, and SUB_ADMIN/SCHOOL_ADMIN (who the
                  backend allows) were redirected away before reaching it. No sidebar link existed
                  either (see Sidebar.tsx's new SUB_ADMIN/SCHOOL_ADMIN entry). */}
              <Route element={<RequireRole roles={['SUB_ADMIN', 'SCHOOL_ADMIN']} />}>
                <Route path="/admin/messages" element={<AdminMessagesPage />} />
              </Route>

              {/* Lecturer dashboard */}
              <Route path="/lecturer" element={<LecturerDashboard />} />
              {/* Outline B3 — CEM's own dashboard, first sidebar item and post-login landing page */}
              <Route path="/cem" element={<CemDashboardPage />} />
              <Route path="/cem/facilities" element={<CemFacilitiesPage />} />
              <Route path="/cem/cohorts/:cohortId" element={<CemCohortDetailPage />} />
              <Route path="/cem/cohorts/:cohortId/:panel" element={<CemCohortPanelPage />} />
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

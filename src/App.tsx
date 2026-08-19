import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RequireSuperAdmin } from './components/guards/RequireSuperAdmin';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { OverviewPage } from './pages/admin/OverviewPage';
import { SchoolsPage } from './pages/admin/SchoolsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UserDetailPage } from './pages/admin/UserDetailPage';
import { CourseAttendanceDetailPage } from './pages/admin/CourseAttendanceDetailPage';
import { AttendanceAnalyticsPage } from './pages/admin/AttendanceAnalyticsPage';
import { AllStudentsPage } from './pages/admin/AllStudentsPage';
import { AllLecturersPage } from './pages/admin/AllLecturersPage';
import { BLEBeaconPage } from './pages/admin/BLEBeaconPage';
import { BeaconHeatmapSimulatorPage } from './pages/admin/BeaconHeatmapSimulatorPage';
import { DeviceVerificationPage } from './pages/admin/DeviceVerificationPage';
import { InvigilationPage } from './pages/admin/InvigilationPage';
import { LecturerPresencePage } from './pages/admin/LecturerPresencePage';
import { AttendanceOverviewPage } from './pages/admin/AttendanceOverviewPage';
import { AlertsPage } from './pages/AlertsPage';
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
import { TermsPage } from './pages/admin/TermsPage';
import { ProgramsPage } from './pages/admin/ProgramsPage';
import { SystemAnnouncementsPage } from './pages/admin/SystemAnnouncementsPage';
import { SupportPage } from './pages/admin/SupportPage';
import { EscalationsPage } from './pages/admin/EscalationsPage';
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
            <Route element={<DashboardLayout />}>
              {/* Admin routes (SUPER_ADMIN + SUB_ADMIN) */}
              <Route path="/admin" element={<OverviewPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:id" element={<UserDetailPage />} />
              <Route path="/admin/users/:id/courses/:courseId" element={<CourseAttendanceDetailPage />} />
              <Route path="/admin/attendance-analytics" element={<AttendanceAnalyticsPage />} />
              <Route path="/admin/students" element={<AllStudentsPage />} />
              <Route path="/admin/lecturers" element={<AllLecturersPage />} />
              <Route path="/admin/lecturer-presence" element={<LecturerPresencePage />} />
              <Route path="/admin/attendance-overview" element={<AttendanceOverviewPage />} />
              <Route path="/admin/fraud-detection" element={<FraudDetectionPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/admin/system-announcements" element={<SystemAnnouncementsPage />} />
              <Route path="/admin/support" element={<SupportPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              {/* SUB_ADMIN is scoped to their own school's beacons; SUPER_ADMIN sees/manages all (beacon.service.ts enforces this) */}
              <Route path="/admin/beacons" element={<BLEBeaconPage />} />
              {/* Same beacon-scoping rules as above — the simulator loads/saves via the same /beacons endpoints */}
              <Route path="/admin/beacon-heatmap" element={<BeaconHeatmapSimulatorPage />} />
              {/* SUB_ADMIN sees/adds co-admins for their own school only; SUPER_ADMIN sees/manages all (user.controller.ts + user.service.ts enforce this) */}
              <Route path="/admin/school-admins" element={<SchoolAdminsPage />} />
              <Route path="/admin/terms" element={<TermsPage />} />
              <Route path="/admin/programs" element={<ProgramsPage />} />

              {/* SUPER_ADMIN-only routes */}
              <Route element={<RequireSuperAdmin />}>
                <Route path="/admin/schools" element={<SchoolsPage />} />
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
              <Route path="/legal" element={<LegalPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </RouteErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { RequireSuperAdmin } from './components/guards/RequireSuperAdmin';
import { LoginPage } from './pages/auth/LoginPage';
import { OverviewPage } from './pages/admin/OverviewPage';
import { SchoolsPage } from './pages/admin/SchoolsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UserDetailPage } from './pages/admin/UserDetailPage';
import { AttendanceAnalyticsPage } from './pages/admin/AttendanceAnalyticsPage';
import { AllStudentsPage } from './pages/admin/AllStudentsPage';
import { BLEBeaconPage } from './pages/admin/BLEBeaconPage';
import { DeviceVerificationPage } from './pages/admin/DeviceVerificationPage';
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
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage';
import { LegalPage } from './pages/LegalPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<DashboardLayout />}>
              {/* Admin routes (SUPER_ADMIN + SUB_ADMIN) */}
              <Route path="/admin" element={<OverviewPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:id" element={<UserDetailPage />} />
              <Route path="/admin/attendance-analytics" element={<AttendanceAnalyticsPage />} />
              <Route path="/admin/students" element={<AllStudentsPage />} />
              <Route path="/admin/lecturer-presence" element={<LecturerPresencePage />} />
              <Route path="/admin/attendance-overview" element={<AttendanceOverviewPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />

              {/* SUPER_ADMIN-only routes */}
              <Route element={<RequireSuperAdmin />}>
                <Route path="/admin/schools" element={<SchoolsPage />} />
                <Route path="/admin/beacons" element={<BLEBeaconPage />} />
                <Route path="/admin/device-verification" element={<DeviceVerificationPage />} />
                <Route path="/admin/messages" element={<AdminMessagesPage />} />
              </Route>

              {/* Lecturer dashboard */}
              <Route path="/lecturer" element={<LecturerDashboard />} />

              {/* Shared routes (admin and lecturer) */}
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/attendance" element={<ClassAttendancePage />} />
              <Route path="/attendance/:classId" element={<ClassAttendancePage />} />
              <Route path="/live" element={<LiveAttendancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/legal" element={<LegalPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

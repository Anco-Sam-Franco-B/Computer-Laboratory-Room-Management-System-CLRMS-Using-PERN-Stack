import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { ProtectedRoute, RoleGuard, PublicOnlyRoute } from '../components/layout/Guards';
import { PageLoader } from '../components/ui/Spinner';

const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('../pages/auth/VerifyEmail'));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const Laboratories = lazy(() => import('../pages/laboratories/Laboratories'));
const Computers = lazy(() => import('../pages/computers/Computers'));
const Equipment = lazy(() => import('../pages/equipment/Equipment'));
const Bookings = lazy(() => import('../pages/bookings/Bookings'));
const Timetable = lazy(() => import('../pages/timetable/Timetable'));
const Attendance = lazy(() => import('../pages/attendance/Attendance'));
const Maintenance = lazy(() => import('../pages/maintenance/Maintenance'));
const Incidents = lazy(() => import('../pages/incidents/Incidents'));
const Visitors = lazy(() => import('../pages/visitors/Visitors'));
const Users = lazy(() => import('../pages/users/Users'));
const Departments = lazy(() => import('../pages/departments/Departments'));
const Reports = lazy(() => import('../pages/reports/Reports'));
const SettingsPage = lazy(() => import('../pages/settings/Settings'));
const Profile = lazy(() => import('../pages/profile/Profile'));
const NotFound = lazy(() => import('../pages/NotFound'));

function SuspenseBoundary({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <SuspenseBoundary>{children}</SuspenseBoundary>
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public / auth — each page is wrapped by its own AuthLayout component */}
        <Route path="/login" element={<PublicOnlyRoute><SuspenseBoundary><Login /></SuspenseBoundary></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><SuspenseBoundary><Register /></SuspenseBoundary></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><SuspenseBoundary><ForgotPassword /></SuspenseBoundary></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<PublicOnlyRoute><SuspenseBoundary><ResetPassword /></SuspenseBoundary></PublicOnlyRoute>} />
        <Route path="/verify-email" element={<SuspenseBoundary><VerifyEmail /></SuspenseBoundary>} />

        {/* App shell */}
        <Route
          path="/app"
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="laboratories" element={<Laboratories />} />
          <Route path="computers" element={<Computers />} />
          <Route path="equipment" element={<Equipment />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="users" element={<RoleGuard roles={['super_admin', 'lab_manager']}><Users /></RoleGuard>} />
          <Route path="departments" element={<Departments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<SuspenseBoundary><NotFound /></SuspenseBoundary>} />
      </Routes>
    </BrowserRouter>
  );
}
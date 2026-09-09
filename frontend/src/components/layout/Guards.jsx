import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { PageLoader } from '../ui/Spinner';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!user) return <PageLoader />;

  return children;
}

export function RoleGuard({ roles, children }) {
  const user = useAuthStore((s) => s.user);
  if (!user?.roleCode || (roles && !roles.includes(user.roleCode))) {
    return <Navigate to="/app" replace />;
  }
  return children;
}

export function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return children;
}
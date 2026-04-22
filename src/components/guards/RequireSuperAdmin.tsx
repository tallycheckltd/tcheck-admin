import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireSuperAdmin() {
  const { user } = useAuth();

  if (user?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

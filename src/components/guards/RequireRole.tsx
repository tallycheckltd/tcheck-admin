import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';

/** Generic role-gated route, for backend role sets that aren't SUPER_ADMIN-only (RequireSuperAdmin
 * covers that narrower case). Mirrors the backend's own requireRole(...) allow-list for whichever
 * route it wraps — pass the exact same roles the backend endpoint admits, not a guess. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

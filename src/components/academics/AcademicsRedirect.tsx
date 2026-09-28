import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** P5 — an old academic page URL: admins go to the matching Academics tab; any other role that
 * reaches the page from its own menu (leadership: Terms, lecturers: Training pipelines) keeps it. */
export function AcademicsRedirect({ tab, fallback }: { tab: string; fallback: ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') return <Navigate to={`/admin/academics?tab=${tab}`} replace />;
  return <>{fallback}</>;
}

/** Same idea for any old admin page: admins go to `to`, other roles keep the page. */
export function AdminRedirect({ to, fallback }: { to: string; fallback: ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN') return <Navigate to={to} replace />;
  return <>{fallback}</>;
}

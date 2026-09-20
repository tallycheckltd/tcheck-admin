import { useAuth } from '../context/AuthContext';
import { can } from '../lib/permissions';
import type { Permission } from '../types';

/** `const canManageCourses = useCan('MANAGE_COURSES')` — mirrors what the server will allow (see lib/permissions.ts). */
export function useCan(perm: Permission | Permission[], opts: { newForLecturer?: boolean } = {}): boolean {
  const { user } = useAuth();
  return can(user, perm, opts);
}

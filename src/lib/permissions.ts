import type { Permission, User } from '../types';

/**
 * Client-side mirror of the backend's permission decision table (server/src/middleware/capability.ts),
 * used ONLY to hide or disable actions the server would refuse — the server stays the real gate.
 * Keep in step with it by hand (the dashboard has no shared build with the backend).
 *
 *   SUPER_ADMIN, SUB_ADMIN          always.
 *   SCHOOL_ADMIN                    every permission except the five MANAGE_* group, which must be held.
 *   LECTURER                        no CustomRole -> unchanged legacy access; on a CustomRole -> must hold it.
 *                                   `newForLecturer`: the route was newly opened to lecturers, so a
 *                                   legacy lecturer does NOT get it either — must hold it.
 *   CLIENT_EXPERIENCE_MANAGER       must hold it — except VIEW_FACILITIES / MANAGE_FACILITY_TICKETS, part of the role.
 *   VC / DVC / DEAN / HOD           MANAGE_COURSES must be held; every other route stays role-only (true here).
 *   everyone else                   true (their page/route access is decided by role, not permission).
 *
 * `user.permissions` is already the effective set (CustomRole wins over direct grants — resolved server-side).
 */
const MANAGE_GROUP: Permission[] = ['MANAGE_USERS', 'MANAGE_SCHOOL_SETTINGS', 'MANAGE_COURSES', 'MANAGE_ANNOUNCEMENTS', 'MANAGE_TICKETS'];
const STRICT_HIERARCHY = ['VC', 'DVC', 'DEAN', 'HOD'];
/** Mirrors the server's ROLE_INHERENT_PERMISSIONS (utils/permissions.ts): facility triage is part of
 * the CEM account type itself. The server also includes these in `user.permissions`; this keeps the
 * UI correct even for a session whose user object predates that. */
const CEM_INHERENT: Permission[] = ['VIEW_FACILITIES', 'MANAGE_FACILITY_TICKETS'];

export function can(
  user: Pick<User, 'role' | 'permissions' | 'customRoleId'> | null | undefined,
  perm: Permission | Permission[],
  opts: { newForLecturer?: boolean } = {},
): boolean {
  if (!user) return false;
  const wanted = Array.isArray(perm) ? perm : [perm];
  const holds = wanted.some((p) => (user.permissions ?? []).includes(p));
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'SUB_ADMIN':
      return true;
    case 'SCHOOL_ADMIN':
      return wanted.some((p) => !MANAGE_GROUP.includes(p)) || holds;
    case 'LECTURER':
      return opts.newForLecturer || user.customRoleId ? holds : true;
    case 'CLIENT_EXPERIENCE_MANAGER':
      return holds || wanted.some((p) => CEM_INHERENT.includes(p));
    default:
      // MANAGE_COURSES: only VC/DVC/DEAN/HOD (with the permission) are admitted among the remaining roles.
      if (wanted.includes('MANAGE_COURSES')) return STRICT_HIERARCHY.includes(user.role) && holds;
      return true;
  }
}

/** Permissions that only control whether a sidebar link shows — no backend route is gated by them. */
export const NAVIGATION_ONLY_PERMISSIONS: Permission[] = ['VIEW_LIVE_ATTENDANCE', 'VIEW_REPORTS'];
/** Permissions no route enforces yet (kept in the catalog so existing roles stay valid). */
export const RESERVED_PERMISSIONS: Permission[] = ['MANAGE_INVIGILATION'];

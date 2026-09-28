import { ORG_SCOPED_ROLES, ROLE_LABEL as TABLE_ROLE_LABEL, canAccessTier as tableCanAccessTier, homeRouteFor as tableHomeRouteFor } from '../shared/roles';
import type { Role } from '../types';

/** P2 — derived from the role table (shared/roles.ts); nothing here is hand-maintained any more. */
export const HIERARCHY_ROLES: Role[] = ORG_SCOPED_ROLES;

export function isHierarchyRole(role: Role | undefined): boolean {
  return !!role && HIERARCHY_ROLES.includes(role);
}

/** Is `role` at or above `minRole` in the hierarchy tier ranking? Only ranked (leadership + ICT) roles. */
export function canAccessTier(role: Role | undefined, minRole: Role): boolean {
  return tableCanAccessTier(role, minRole);
}

export const ROLE_LABEL: Record<Role, string> = TABLE_ROLE_LABEL;

export const STAFF_TIER_ROLES: Role[] = ['LECTURER', 'CLIENT_EXPERIENCE_MANAGER', 'STAFF'];
export function isStaffTierRole(role: Role | undefined): boolean {
  return !!role && STAFF_TIER_ROLES.includes(role);
}

/** QA plan B1/B2, outline Phase 0 — a new, additive helper alongside the 13 existing role lists,
 * not a replacement of any of them. Phase 0a-i's consolidation (outline 10.7/16.10a) is separate,
 * later work; this exists only to fix two concrete bugs now: SCHOOL_ADMIN being silently treated
 * as a plain lecturer on several pages (B1), and login routing everyone but Super/School Admin to
 * /lecturer regardless of role (B2). Do not fold the other 13 lists into this file as part of
 * fixing those two bugs — that migration is 0a-i's job, done once, on its own branch. */
export const SCHOOL_ADMIN_TIER_ROLES: Role[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN'];
export function isSchoolAdminTier(role: Role | undefined): boolean {
  return !!role && SCHOOL_ADMIN_TIER_ROLES.includes(role);
}

/** True for any role that should see its school/unit's data unfiltered by "courses I teach" —
 * the school-admin tier plus every hierarchy role (VC/DVC/Registrars/Dean/HOD/Deputy HOD/ICT
 * Admin). Org-unit-level narrowing for the hierarchy tier (Dean sees only their faculty, etc.) is
 * a server-side concern (scope.service.ts) and is untouched by this helper either way — this only
 * decides whether the *client* should stop pretending a non-lecturer is a lecturer. */
export function seesUnfilteredBySchoolOrUnit(role: Role | undefined): boolean {
  return isSchoolAdminTier(role) || isHierarchyRole(role);
}

/** Where a freshly-logged-in user should land — the role table's `homeRoute`. */
export function homeRouteFor(role: Role | undefined): string {
  return tableHomeRouteFor(role);
}

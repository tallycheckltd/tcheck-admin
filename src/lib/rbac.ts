import type { Role } from '../types';

/** Mirrors server/src/services/scope.service.ts's ROLE_RANK — kept in sync by hand since the
 * frontend has no shared-types build step with the backend. Only the enterprise hierarchy tiers
 * are ranked; legacy roles (SUPER_ADMIN/SUB_ADMIN/LECTURER/STUDENT/INVIGILATOR) are handled by
 * their own existing `role === 'X'` checks throughout the dashboard, not this helper. */
const ROLE_RANK: Partial<Record<Role, number>> = {
  VC: 100,
  DVC: 90,
  REGISTRAR_ACADEMIC: 80,
  REGISTRAR_ADMIN: 80,
  DEAN: 70,
  HOD: 60,
  DEPUTY_HOD: 50,
  ICT_ADMIN: 40,
};

export const HIERARCHY_ROLES: Role[] = ['VC', 'DVC', 'REGISTRAR_ACADEMIC', 'REGISTRAR_ADMIN', 'DEAN', 'HOD', 'DEPUTY_HOD', 'ICT_ADMIN'];

export function isHierarchyRole(role: Role | undefined): boolean {
  return !!role && HIERARCHY_ROLES.includes(role);
}

/** Is `role` at or above `minRole` in the hierarchy tier ranking? Only meaningful when both are
 * hierarchy-tier roles — returns false for any legacy role on either side. */
export function canAccessTier(role: Role | undefined, minRole: Role): boolean {
  if (!role) return false;
  const a = ROLE_RANK[role];
  const b = ROLE_RANK[minRole];
  if (a === undefined || b === undefined) return false;
  return a >= b;
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  // Relabeled from the older "School Admin" now that SCHOOL_ADMIN below is the real, guaranteed
  // one-per-school admin — SUB_ADMIN is the optional co-admin an existing admin may add later.
  SUB_ADMIN: 'Co-Admin',
  LECTURER: 'Lecturer',
  STUDENT: 'Student',
  INVIGILATOR: 'Invigilator',
  VC: 'Vice Chancellor',
  DVC: 'Deputy Vice Chancellor',
  REGISTRAR_ACADEMIC: 'Registrar (Academic)',
  REGISTRAR_ADMIN: 'Registrar (Administration)',
  DEAN: 'Dean',
  HOD: 'Head of Department',
  DEPUTY_HOD: 'Deputy HOD',
  ICT_ADMIN: 'ICT Admin',
  SCHOOL_ADMIN: 'School Admin',
  CLIENT_EXPERIENCE_MANAGER: 'Client Experience Manager',
};

export const STAFF_TIER_ROLES: Role[] = ['LECTURER', 'CLIENT_EXPERIENCE_MANAGER'];
export function isStaffTierRole(role: Role | undefined): boolean {
  return !!role && STAFF_TIER_ROLES.includes(role);
}

/** QA plan B1/B2, outline Phase 0 — a new, additive helper alongside the 13 existing role lists,
 * not a replacement of any of them. Phase 0a-i's consolidation (outline 10.7/16.10a) is separate,
 * later work; this exists only to fix two concrete bugs now: SCHOOL_ADMIN being silently treated
 * as a plain lecturer on several pages (B1), and login routing everyone but Super/Co-Admin to
 * /lecturer regardless of role (B2). Do not fold the other 13 lists into this file as part of
 * fixing those two bugs — that migration is 0a-i's job, done once, on its own branch. */
export const SCHOOL_ADMIN_TIER_ROLES: Role[] = ['SUPER_ADMIN', 'SUB_ADMIN', 'SCHOOL_ADMIN'];
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

/** Where a freshly-logged-in user should land. Mirrors the dashboard's existing route map:
 * every school-admin-tier and hierarchy role already lands on the shared, role-aware /admin
 * overview page (OverviewPage.tsx branches per role itself); CEM gets its own /cem dashboard
 * (outline B3); everyone else (LECTURER, and any role this dashboard doesn't otherwise route)
 * keeps the long-standing /lecturer default. */
export function homeRouteFor(role: Role | undefined): string {
  if (isSchoolAdminTier(role) || isHierarchyRole(role)) return '/admin';
  if (role === 'CLIENT_EXPERIENCE_MANAGER') return '/cem';
  return '/lecturer';
}

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
  SUB_ADMIN: 'School Admin',
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
};

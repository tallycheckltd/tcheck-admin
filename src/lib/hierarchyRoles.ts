import type { OrgUnitLevel, Role, ScopeLevel } from '../types';

/**
 * The ONE place the dashboard maps a staff role to its scope level and to the org-unit level it is
 * assigned into (QA plan Phase 11). It used to live twice — SCOPE_FOR_ROLE / ORG_LEVEL_FOR_ROLE in
 * OrgUnitsPage and DEFAULT_SCOPE / UNIT_BOUND_ROLES in RolesPermissionsPage — and the copies had
 * already drifted (Deputy HOD was unit-bound in one, not in the other). Mirrors the server's
 * SWITCHABLE_ROLES / UNIT_BOUND_ROLES / DEFAULT_SCOPE_LEVEL in server/src/services/user.service.ts.
 */
export const LEVEL_LABEL: Record<OrgUnitLevel, string> = {
  DIVISION: 'Division',
  FACULTY: 'Faculty / School',
  DEPARTMENT: 'Department',
  SUB_DEPARTMENT: 'Sub-Department',
};

export const SCOPE_FOR_ROLE: Record<Role, ScopeLevel> = {
  VC: 'UNIVERSITY',
  DVC: 'DIVISION',
  REGISTRAR_ACADEMIC: 'UNIVERSITY',
  REGISTRAR_ADMIN: 'UNIVERSITY',
  DEAN: 'DEPARTMENT',
  HOD: 'DEPARTMENT',
  DEPUTY_HOD: 'SUB_DEPARTMENT',
  ICT_ADMIN: 'INDIVIDUAL',
  SUPER_ADMIN: 'UNIVERSITY',
  SUB_ADMIN: 'SCHOOL',
  LECTURER: 'INDIVIDUAL',
  STUDENT: 'INDIVIDUAL',
  INVIGILATOR: 'INDIVIDUAL',
  SCHOOL_ADMIN: 'SCHOOL',
  CLIENT_EXPERIENCE_MANAGER: 'INDIVIDUAL',
};

/** Which org-unit level each role is assigned into. Absent = school-wide (VC, Registrars, ICT Admin, lecturers…). */
export const ORG_LEVEL_FOR_ROLE: Partial<Record<Role, OrgUnitLevel>> = {
  DVC: 'DIVISION',
  DEAN: 'FACULTY',
  HOD: 'DEPARTMENT',
  DEPUTY_HOD: 'SUB_DEPARTMENT',
};

/** Roles the server refuses to create without an org unit. A Deputy HOD may be created unassigned and placed later. */
export const UNIT_REQUIRED_ROLES: Role[] = ['DVC', 'DEAN', 'HOD'];

export const roleHasOrgUnit = (role: Role): boolean => !!ORG_LEVEL_FOR_ROLE[role];
export const roleRequiresOrgUnit = (role: Role): boolean => UNIT_REQUIRED_ROLES.includes(role);

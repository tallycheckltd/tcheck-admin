import { ALL_ROLES, ROLE_TABLE, UNIT_BOUND_ROLES } from '../shared/roles';
import type { OrgUnitLevel, Role, ScopeLevel } from '../types';

/**
 * The ONE place the dashboard maps a staff role to its scope level and to the org-unit level it is
 * assigned into (QA plan Phase 11). It used to live twice — SCOPE_FOR_ROLE / ORG_LEVEL_FOR_ROLE in
 * OrgUnitsPage and DEFAULT_SCOPE / UNIT_BOUND_ROLES in RolesPermissionsPage — and the copies had
 * already drifted (Deputy HOD was unit-bound in one, not in the other). Mirrors the server's
 * role table (shared/roles.ts) — P2 made that the single source for both.
 */
export const LEVEL_LABEL: Record<OrgUnitLevel, string> = {
  DIVISION: 'Division',
  FACULTY: 'Faculty / School',
  DEPARTMENT: 'Department',
  SUB_DEPARTMENT: 'Sub-Department',
};

/** The scope level the server stores for each role (shared/roles.ts). The server derives it itself
 * and ignores what the dashboard sends; kept so existing callers still type-check. */
export const SCOPE_FOR_ROLE = Object.fromEntries(ALL_ROLES.map((r) => [r, ROLE_TABLE[r].scopeLevel])) as Record<Role, ScopeLevel>;

/** Which org-unit level each role is assigned into. Absent = school-wide (VC, Registrars, ICT Admin, lecturers…). */
export const ORG_LEVEL_FOR_ROLE = Object.fromEntries(ALL_ROLES.filter((r) => ROLE_TABLE[r].orgUnitLevel).map((r) => [r, ROLE_TABLE[r].orgUnitLevel])) as Partial<Record<Role, OrgUnitLevel>>;

/** Roles the server refuses to create without an org unit. A Deputy HOD may be created unassigned and placed later. */
export const UNIT_REQUIRED_ROLES: Role[] = UNIT_BOUND_ROLES;

export const roleHasOrgUnit = (role: Role): boolean => !!ORG_LEVEL_FOR_ROLE[role];
export const roleRequiresOrgUnit = (role: Role): boolean => UNIT_REQUIRED_ROLES.includes(role);

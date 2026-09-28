/**
 * P2 (A2.1, D-10.8) — THE role table. One row per role; every role list in the backend and the
 * dashboard is derived from it, so adding or changing a role is one edit here instead of thirteen.
 *
 * CANONICAL COPY: server/src/shared/roles.ts. The dashboard carries a byte-identical copy at
 * dashboard/src/shared/roles.ts (the two deploy from separate mirror repos, so neither can import
 * the other); `node scripts/sync-shared.mjs` copies it and routes/rolesTable.test.ts fails if the
 * copies differ. No imports on purpose — plain data both builds can compile.
 *
 * Every role declares BOTH a capability posture (does a permission decide, and how strictly) and a
 * scope posture (whose data it may see) — the two axes D-10.8 found covering opposite halves.
 */

export type RoleName =
  | 'SUPER_ADMIN' | 'SCHOOL_ADMIN'
  | 'VC' | 'DVC' | 'REGISTRAR_ACADEMIC' | 'REGISTRAR_ADMIN' | 'DEAN' | 'HOD' | 'DEPUTY_HOD'
  | 'ICT_ADMIN'
  | 'CLIENT_EXPERIENCE_MANAGER' | 'CEM_MANAGER'
  | 'LECTURER' | 'STAFF' | 'INVIGILATOR'
  | 'STUDENT';

/** Canonical scope names (P2): FACULTY replaces a Dean's misleading DEPARTMENT; TENANT replaces
 * both UNIVERSITY and SCHOOL (one concept, one name). The old values stay in the database enum
 * only as read-time aliases (see normalizeScopeLevel). */
export type CanonicalScopeLevel = 'TENANT' | 'DIVISION' | 'FACULTY' | 'DEPARTMENT' | 'SUB_DEPARTMENT' | 'INDIVIDUAL' | 'PROGRAMME';
export type OrgLevel = 'DIVISION' | 'FACULTY' | 'DEPARTMENT' | 'SUB_DEPARTMENT';

export type RoleTier = 'PLATFORM' | 'INSTITUTION_ADMIN' | 'ACADEMIC_HIERARCHY' | 'INFRASTRUCTURE' | 'EXEC_ED' | 'STAFF' | 'OPERATIONAL_STUDENT';

/**
 * How requireCapability treats the role:
 *   bypass    — never checked (platform / legacy additional school admin).
 *   roleOnly  — the route's requireRole is the whole decision; requireCapability is a no-op unless
 *               the route names the role in `strictRoles`.
 *   admin     — enforced for the school-admin-enforced permissions; softened to a logged would-deny
 *               in PERMISSION_ENFORCEMENT=log mode (had access before the rollout).
 *   legacy    — a LECTURER: must hold the permission (preset ± tweaks); log mode may soften a denial
 *               only on `legacyLecturer: 'allow'` routes (the fallback itself was retired in P4).
 *   strict    — must hold the permission, in both modes (no prior access to soften).
 */
export type CapabilityPosture = 'bypass' | 'roleOnly' | 'admin' | 'legacy' | 'strict';

/**
 * Whose data the role sees:
 *   platform — the watchtower (P10): tenants, billing, support, fleet health and T0 counts; never
 *              tenant records (middleware/platformGate.ts; support access grants for exceptions).
 *   tenant   — its own school.
 *   orgUnit  — its org-unit subtree (scope.service.ts getUserScopeWhere/getCourseScopeWhere).
 *   courses  — courses it teaches or is assigned to.
 *   cohorts  — its assigned cohorts/courses (Head of CEM = tenant-wide CEM).
 *   team     — its CEMs (User.managerId) and their active cohorts (cemTeam.service getCemManagerScope).
 *   infra    — infrastructure only (beacons, rooms, devices), no student data.
 *   self     — itself.
 */
export type ScopePosture = 'platform' | 'tenant' | 'orgUnit' | 'courses' | 'cohorts' | 'team' | 'infra' | 'self';

/** Which dashboard nav set the role gets (the item lists live in Sidebar.tsx; which role gets which set lives here). */
export type NavSet = 'superAdmin' | 'admin' | 'executive' | 'hierarchyOps' | 'registrar' | 'ict' | 'cem' | 'cemManager' | 'lecturer' | 'staff' | 'invigilator' | 'none';

export interface RoleDefinition {
  label: string;
  tier: RoleTier;
  capability: CapabilityPosture;
  scope: ScopePosture;
  /** Hierarchy/org scoping applies (the role is NOT in scope.service's "legacy" pass-through). */
  orgScoped: boolean;
  /** One of the seven academic leadership roles (VC … Deputy HOD) — excludes ICT Admin. */
  hierarchy: boolean;
  /** Floor-scoped to its own school wherever a service widens a SCHOOL_ADMIN-style `{ schoolId }` check. */
  schoolFloor: boolean;
  /** Higher sees further up the chain (canAccessTier); only leadership + ICT are ranked. */
  rank?: number;
  /** Scope level stored for the role — the server derives it from here, never from the request. */
  scopeLevel: CanonicalScopeLevel;
  /** Org-unit level the role is placed into; absent = school-wide. */
  orgUnitLevel?: OrgLevel;
  /** The server refuses to create/switch to the role without an org unit. */
  requiresOrgUnit: boolean;
  /** Can hold a named CustomRole (and direct grants). */
  canHoldCustomRole: boolean;
  /** Staff account types a School Admin may switch a person between. */
  switchable: boolean;
  dashboard: boolean;
  mobile: boolean;
  homeRoute: string;
  nav: NavSet;
}

export const ROLE_TABLE: Record<RoleName, RoleDefinition> = {
  SUPER_ADMIN: {
    label: 'Super Admin', tier: 'PLATFORM', capability: 'bypass', scope: 'platform',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'TENANT',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: false, dashboard: true, mobile: false, homeRoute: '/platform', nav: 'superAdmin',
  },
  SCHOOL_ADMIN: {
    label: 'School Admin', tier: 'INSTITUTION_ADMIN', capability: 'admin', scope: 'tenant',
    orgScoped: false, hierarchy: false, schoolFloor: true, scopeLevel: 'TENANT',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: false, dashboard: true, mobile: true, homeRoute: '/admin', nav: 'admin',
  },
  VC: {
    label: 'Vice Chancellor', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'tenant',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 100, scopeLevel: 'TENANT',
    requiresOrgUnit: false, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'executive',
  },
  DVC: {
    label: 'Deputy Vice Chancellor', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'orgUnit',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 90, scopeLevel: 'DIVISION', orgUnitLevel: 'DIVISION',
    requiresOrgUnit: true, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'executive',
  },
  REGISTRAR_ACADEMIC: {
    label: 'Registrar (Academic)', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'tenant',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 80, scopeLevel: 'TENANT',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'registrar',
  },
  REGISTRAR_ADMIN: {
    label: 'Registrar (Administration)', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'tenant',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 80, scopeLevel: 'TENANT',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'registrar',
  },
  DEAN: {
    label: 'Dean', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'orgUnit',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 70, scopeLevel: 'FACULTY', orgUnitLevel: 'FACULTY',
    requiresOrgUnit: true, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'hierarchyOps',
  },
  HOD: {
    label: 'Head of Department', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'orgUnit',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 60, scopeLevel: 'DEPARTMENT', orgUnitLevel: 'DEPARTMENT',
    requiresOrgUnit: true, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'hierarchyOps',
  },
  DEPUTY_HOD: {
    // May be created unassigned and placed later (the one leadership role not unit-required).
    label: 'Deputy HOD', tier: 'ACADEMIC_HIERARCHY', capability: 'roleOnly', scope: 'orgUnit',
    orgScoped: true, hierarchy: true, schoolFloor: true, rank: 50, scopeLevel: 'SUB_DEPARTMENT', orgUnitLevel: 'SUB_DEPARTMENT',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: false, dashboard: true, mobile: false, homeRoute: '/admin', nav: 'hierarchyOps',
  },
  ICT_ADMIN: {
    label: 'ICT Admin', tier: 'INFRASTRUCTURE', capability: 'roleOnly', scope: 'infra',
    orgScoped: true, hierarchy: false, schoolFloor: false, rank: 40, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: true, dashboard: true, mobile: false, homeRoute: '/admin/beacon-health', nav: 'ict',
  },
  CLIENT_EXPERIENCE_MANAGER: {
    label: 'Client Experience Manager', tier: 'EXEC_ED', capability: 'strict', scope: 'cohorts',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: true, homeRoute: '/cem', nav: 'cem',
  },
  CEM_MANAGER: {
    // P9 (A8.6, D-11.3) — leads a team of CEMs. Dashboard-first (D-15.7); on mobile the apps show
    // their plain staff shell (an unknown role decodes as a String and never crashes).
    label: 'CEM Manager', tier: 'EXEC_ED', capability: 'strict', scope: 'team',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: true, homeRoute: '/cem-team', nav: 'cemManager',
  },
  LECTURER: {
    label: 'Lecturer', tier: 'STAFF', capability: 'legacy', scope: 'courses',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: true, homeRoute: '/lecturer', nav: 'lecturer',
  },
  STAFF: {
    // P2 (A13.1) — a plain staff account with no capability of its own (Dean of Students, Finance,
    // Library, Exams office, front desk): everything comes from a preset or custom role. Its data
    // scope is the courses it is assigned to (StaffCourseAssignment, like a non-head CEM); P17
    // adds programme-scoped STAFF (Programme Coordinator).
    label: 'Staff', tier: 'STAFF', capability: 'strict', scope: 'courses',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: true, switchable: true, dashboard: true, mobile: true, homeRoute: '/staff', nav: 'staff',
  },
  INVIGILATOR: {
    label: 'Invigilator', tier: 'STAFF', capability: 'roleOnly', scope: 'self',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: true, dashboard: true, mobile: true, homeRoute: '/lecturer', nav: 'invigilator',
  },
  STUDENT: {
    label: 'Student', tier: 'OPERATIONAL_STUDENT', capability: 'roleOnly', scope: 'self',
    orgScoped: false, hierarchy: false, schoolFloor: false, scopeLevel: 'INDIVIDUAL',
    requiresOrgUnit: false, canHoldCustomRole: false, switchable: false, dashboard: false, mobile: true, homeRoute: '/login', nav: 'none',
  },
};

export const ALL_ROLES = Object.keys(ROLE_TABLE) as RoleName[];
const where = (pred: (d: RoleDefinition, r: RoleName) => boolean): RoleName[] => ALL_ROLES.filter((r) => pred(ROLE_TABLE[r], r));

// ─── Derived lists (the only definitions; nothing else may hand-maintain a role list) ────────
/** scope.service / attachScopeActor pass-through: no org-unit filter, their own school/role checks apply. */
export const LEGACY_SCOPE_ROLES = where((d) => !d.orgScoped);
/** The seven academic leadership roles (VC … Deputy HOD). */
export const HIERARCHY_ROLES = where((d) => d.hierarchy);
/** Leadership + ICT Admin — the org-scoped "enterprise hierarchy" tiers. */
export const ORG_SCOPED_ROLES = where((d) => d.orgScoped);
export const SCHOOL_FLOOR_ROLES = where((d) => d.schoolFloor);
export const ROLE_ONLY_ROLES = where((d) => d.capability === 'roleOnly');
export const SWITCHABLE_ROLES = where((d) => d.switchable);
export const UNIT_BOUND_ROLES = where((d) => d.requiresOrgUnit);
export const CUSTOM_ROLE_HOLDERS = where((d) => d.canHoldCustomRole);
/** Leadership accounts that may hold grants (a CustomRole or MANAGE_COURSES). */
export const HIERARCHY_GRANT_ROLES = where((d) => d.hierarchy && d.canHoldCustomRole);
export const SCHOOL_ADMIN_TIER = where((d) => d.tier === 'INSTITUTION_ADMIN');
export const ROLE_RANK: Partial<Record<RoleName, number>> = Object.fromEntries(ALL_ROLES.filter((r) => ROLE_TABLE[r].rank !== undefined).map((r) => [r, ROLE_TABLE[r].rank]));
export const ROLE_LABEL = Object.fromEntries(ALL_ROLES.map((r) => [r, ROLE_TABLE[r].label])) as Record<RoleName, string>;

export function roleDef(role: string | null | undefined): RoleDefinition | undefined {
  return role ? ROLE_TABLE[role as RoleName] : undefined;
}
export function homeRouteFor(role: string | null | undefined): string {
  return roleDef(role)?.homeRoute ?? '/lecturer';
}
export function canAccessTier(role: string | null | undefined, minRole: RoleName): boolean {
  const a = roleDef(role)?.rank;
  const b = ROLE_TABLE[minRole].rank;
  return a !== undefined && b !== undefined && a >= b;
}

/**
 * Stored scope → canonical. UNIVERSITY and SCHOOL were two names for "the whole tenant"; a Dean's
 * FACULTY used to be stored as DEPARTMENT. Rows written before the P2 data migration (or by an
 * isolated deployment not yet migrated) still read correctly.
 */
export function normalizeScopeLevel(stored: string | null | undefined, role?: string | null): CanonicalScopeLevel {
  if (stored === 'UNIVERSITY' || stored === 'SCHOOL' || stored === 'TENANT') return 'TENANT';
  if (role === 'DEAN' && stored === 'DEPARTMENT') return 'FACULTY';
  if (stored === 'DIVISION' || stored === 'FACULTY' || stored === 'DEPARTMENT' || stored === 'SUB_DEPARTMENT' || stored === 'PROGRAMME') return stored;
  return 'INDIVIDUAL';
}
export const isTenantWideScope = (stored: string | null | undefined) => normalizeScopeLevel(stored) === 'TENANT';

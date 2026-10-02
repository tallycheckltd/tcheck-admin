/**
 * UAT F6 (2026-09-29) — a platform support session: while the Super Admin is working under an
 * approved, unexpired support grant, every API call carries `X-Support-Grant` (the server's platform
 * gate opens only that grant's routes and audits each action). Kept in sessionStorage — it ends when
 * the tab closes, when the grant's time runs out, or with "End now".
 */
export interface SupportSession {
  grantId: string;
  schoolId: string;
  schoolName: string;
  scope: 'ACCOUNT' | 'SETUP';
  targetUserId: string | null;
  expiresAt: string;
}

const KEY = 'tcheck.supportSession';
export const SUPPORT_SESSION_EVENT = 'app:support-session';

export function getSupportSession(): SupportSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SupportSession;
    if (new Date(s.expiresAt).getTime() <= Date.now()) { sessionStorage.removeItem(KEY); return null; }
    return s;
  } catch { return null; }
}

export function startSupportSession(s: SupportSession) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: the session just won't persist */ }
  window.dispatchEvent(new Event(SUPPORT_SESSION_EVENT));
}

export function endSupportSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  window.dispatchEvent(new Event(SUPPORT_SESSION_EVENT));
}

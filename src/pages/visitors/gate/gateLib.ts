/**
 * Gate access (2026-11-20) — hooks, labels and formatters shared by the Gate access pages and the
 * Super Admin's Gates pages (components live in gateShared.tsx).
 */
import { useEffect, useRef, useState } from 'react';
import { createSocket } from '../../../lib/socket';
import { stamp } from '../visitorsApi';

/** Refetch when the school's gate changes (scan, job, door, alert), at most every 1.5 s. */
export function useGateLive(refetch: () => unknown, kinds?: string[], paused = false) {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (paused) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    const s = createSocket(token);
    const onChange = (m: { what?: string }) => {
      if (kinds && m?.what && !kinds.includes(m.what)) return;
      const wait = Math.max(0, 1500 - (Date.now() - last.current));
      if (timer.current) return;
      timer.current = setTimeout(() => { timer.current = null; last.current = Date.now(); refetch(); }, wait);
    };
    s.on('gate:changed', onChange);
    return () => { s.off('gate:changed', onChange); s.disconnect(); if (timer.current) clearTimeout(timer.current); };
  }, [refetch, kinds, paused]);
}

export function ago(iso: string | null | undefined) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : stamp(iso);
}
export const ms = (v: number | null | undefined) => (v == null ? '—' : v < 1000 ? `${Math.round(v)} ms` : v < 60_000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v / 60_000)} min`);
export const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

export const CREDENTIAL: Record<string, string> = { QR: 'QR code', FINGER: 'Fingerprint', FACE: 'Face', CARD: 'Card / tag', CODE: 'Six-digit code', REMOTE: 'Opened from Tcheck', UNKNOWN: 'Unknown' };
export const PERSON_KIND: Record<string, string> = { PERSON: 'Delegate / staff', VISITOR: 'Visitor', WALKIN: 'Walk-in' };
export const CRED_STATE: Record<string, ['green' | 'blue' | 'red' | 'purple' | 'gray' | 'yellow', string]> = {
  ISSUED: ['yellow', 'Waiting for BioStar'], LIVE: ['green', 'Live'], GRACE: ['blue', 'Grace period'], CONSUMED: ['gray', 'Used'],
  EXPIRED: ['gray', 'Expired'], REVOKED: ['red', 'Revoked'], REMOVED: ['gray', 'Removed'],
};
export const END_REASON: Record<string, string> = {
  OUT_SCAN: 'Scanned out', WINDOW_ENDED: 'Day ended', ROTATED: 'Replaced by a new code', CANCELLED: 'Invite cancelled', REVOKED_BY_ICT: 'Revoked by ICT',
  DEVICE_RESET: 'Pass moved to another phone', BLOCKED: 'Visitor blocked', SUSPENDED: 'Access suspended',
};
export const JOB_KIND: Record<string, string> = {
  SYNC_IDENTITY: 'Update a person in BioStar', OPEN_DOOR: 'Open a barrier', ENROLL_FINGERPRINT: 'Enrol a fingerprint', DELETE_BIOMETRIC: 'Delete fingerprints',
  RECONCILE: 'BioStar check', SELF_TEST: 'Self-test', REVOKE: 'Remove access', GRANT_VISITOR: 'Give a visitor access (old)', GRANT_WALKIN: 'Give a walk-in access (old)', GRANT_DELEGATE: 'Give a delegate access (old)',
};
export const ALERT_KIND: Record<string, string> = {
  SECOND_DEVICE: 'Pass opened on a second phone', USED_PASS_TRIED: 'Used pass tried again', ANTI_PASSBACK: 'Second entry refused', TWO_READERS: 'Same person at two barriers',
  TABLET_CODE_GUESSING: 'Wrong codes at a tablet', CONNECTOR_OFFLINE: 'Connector offline', DOOR_FORCED: 'Forced passage / tailgating',
};
export const DOOR_STATE: Record<string, ['green' | 'blue' | 'red' | 'purple' | 'gray' | 'yellow', string]> = {
  LOCKED: ['green', 'Closed'], UNLOCKED: ['yellow', 'Free passage'], OPEN: ['blue', 'Open'], HELD_OPEN: ['yellow', 'Held open (blocked)'], FORCED_OPEN: ['red', 'Forced passage'], UNKNOWN: ['gray', 'Unknown'],
};
export const REASON: Record<string, string> = { ANTI_PASSBACK: 'Already inside (anti-passback)', INVALID_USER: 'Code not valid now', CREDENTIAL_NOT_FOUND: 'Unknown code', NO_AUTH: 'No access to this lane', UNKNOWN: 'Other' };

export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { return await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); return null; } finally { setBusy(null); }
  };
  return { busy, error, setError, run };
}

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white';
export const selectCls = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white';

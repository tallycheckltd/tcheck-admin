/**
 * The API base URL, validated. `VITE_API_URL` is baked in at build time, and a bad value used to ship
 * silently: a Vercel env var holding the placeholder text "[SENSITIVE]" made every request go to
 * `/[SENSITIVE]/auth/...`, which Vercel answers 405 (login broke). Anything that isn't an absolute
 * http(s) URL or a rooted path is ignored, falling back to `/api` (proxied to the backend by vercel.json's rewrite).
 */
export function resolveApiBase(raw: string | undefined): string {
  const v = (raw ?? '').trim();
  return /^https?:\/\//i.test(v) || v.startsWith('/') ? v.replace(/\/+$/, '') : '/api';
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

/** Socket.IO can't ride the Vercel rewrite, so it needs the backend origin itself; undefined = same origin. */
export const SOCKET_ORIGIN: string | undefined = /^https?:\/\//i.test(API_BASE) ? API_BASE.replace(/\/api$/, '') : undefined;

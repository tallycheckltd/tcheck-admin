import { API_BASE as BASE } from './apiBase';

type RefreshTokens = { accessToken: string; refreshToken: string };

let pendingRefresh: Promise<RefreshTokens | null> | null = null;

/**
 * Runs at most one /auth/refresh at a time. Concurrent 401 handlers await the same work
 * instead of stamping multiple refresh calls (Strict Mode double-mount + parallel useApi hooks).
 */
function refreshAccessTokenSingleton(): Promise<RefreshTokens | null> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = (async (): Promise<RefreshTokens | null> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;
    try {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!refreshRes.ok) return null;
      const data = (await refreshRes.json()) as RefreshTokens;
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return data;
    } catch {
      return null;
    }
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

function mergeHeaders(extra?: HeadersInit): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(typeof extra === 'object' && extra !== null && !(extra instanceof Headers)
      ? (extra as Record<string, string>)
      : {}),
  };
}

export const PERMISSION_DENIED_MESSAGE = "You don't have permission to do this.";
export const PERMISSION_DENIED_EVENT = 'app:permission-denied';
export const TERMS_REQUIRED_EVENT = 'app:terms-required';
export class PermissionDeniedError extends Error {
  constructor(message = PERMISSION_DENIED_MESSAGE) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tryRefresh401 =
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/signup') &&
    path !== '/auth/refresh';

  const runFetch = (accessToken: string | null) => {
    const headers = mergeHeaders(options.headers as HeadersInit | undefined);
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${BASE}${path}`, { ...options, headers, cache: 'no-store' });
  };

  let res = await runFetch(localStorage.getItem('accessToken'));

  if (res.status === 401 && tryRefresh401 && localStorage.getItem('refreshToken')) {
    const tokens = await refreshAccessTokenSingleton();
    if (tokens) {
      res = await runFetch(tokens.accessToken);
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    if (res.status === 403 && err.code === 'TERMS_REQUIRED') {
      // Staff who haven't accepted the current terms — AuthContext shows the acceptance screen.
      window.dispatchEvent(new CustomEvent(TERMS_REQUIRED_EVENT));
      throw new Error(err.error || 'You must accept the Terms & Privacy Policy to continue.');
    }
    if (res.status === 403) {
      // A 403 means "not allowed", never "signed out": no logout, no redirect. The generic server
      // message gets a friendly wording; a specific one (e.g. "Not one of your assigned courses") is kept.
      const generic = !err.error || err.error === 'Insufficient permissions' || err.error === 'Forbidden';
      const message = generic ? PERMISSION_DENIED_MESSAGE : err.error;
      // Only for actions (POST/PUT/PATCH/DELETE): a background GET a role can't read has always failed quietly.
      if ((options.method ?? 'GET').toUpperCase() !== 'GET') window.dispatchEvent(new CustomEvent(PERMISSION_DENIED_EVENT, { detail: { message } }));
      throw new PermissionDeniedError(message);
    }
    throw new Error(err.error || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  // `headers` (optional) — e.g. an Idempotency-Key, so a retried submit replays instead of repeating.
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

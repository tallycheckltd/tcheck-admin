const BASE = import.meta.env.VITE_API_URL || '/api';

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
    throw new Error(err.error || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

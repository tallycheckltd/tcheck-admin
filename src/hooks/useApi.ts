import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export type UseApiOptions = {
  /** If set to a positive number, refetches on this interval (background refresh; does not flash loading). */
  refetchIntervalMs?: number | false;
  /** Refetch when the tab becomes visible again (e.g. returning from another app). */
  refetchWhenVisible?: boolean;
};

export function useApi<T>(path: string | null, options?: UseApiOptions) {
  const refetchIntervalMs = options?.refetchIntervalMs ?? false;
  const refetchWhenVisible = options?.refetchWhenVisible ?? false;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((opts?: { silent?: boolean }) => {
    if (!path) return Promise.resolve(undefined);
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    return api.get<T>(path)
      .then((d) => {
        setData(d);
      })
      .catch((e: unknown) => {
        if (!silent) {
          const msg = e instanceof Error ? e.message : 'Request failed';
          setError(msg);
        }
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) refetch();
    });
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  useEffect(() => {
    if (!path || !refetchIntervalMs || refetchIntervalMs <= 0) return undefined;
    const id = window.setInterval(() => {
      refetch({ silent: true });
    }, refetchIntervalMs);
    return () => window.clearInterval(id);
  }, [path, refetchIntervalMs, refetch]);

  useEffect(() => {
    if (!path || !refetchWhenVisible) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [path, refetchWhenVisible, refetch]);

  return { data, loading, error, refetch, setData };
}

export function useMutation<T, B = unknown>(method: 'post' | 'put' | 'patch' | 'delete') {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (path: string, body?: B): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await api[method]<T>(path, body);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}

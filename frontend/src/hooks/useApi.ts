import { useCallback, useEffect, useState } from 'react';
import { api, asData, ApiError } from '../lib/api';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApi<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const queryKey = JSON.stringify(query || {});

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.get<any>(path, query, controller.signal)
      .then((result) => {
        const value = result && typeof result === 'object' && 'meta' in result ? result : asData<T>(result);
        setData(value as T);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof ApiError ? reason.message : 'Impossible de charger les données.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // queryKey stabilise les paramètres primitifs fournis par les pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, version]);

  return { data, loading, error, reload };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, extractError } from '../lib/api';

/**
 * Generic paginated + searchable list hook.
 */
export function useApiList(url, { searchable = true, defaultParams = {} } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const defaultParamsRef = useRef(defaultParams);
  defaultParamsRef.current = defaultParams;

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        Object.entries({ ...defaultParamsRef.current, ...params }).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') query.set(k, v);
        });
        if (searchable && params.search !== undefined) query.set('search', params.search);
        const { data } = await api.get(`${url}?${query.toString()}`);
        setRows(data.data);
        setPagination(data.pagination);
        setError(null);
      } catch (err) {
        setError(extractError(err));
      } finally {
        setLoading(false);
      }
    },
    [url, searchable]
  );

  useEffect(() => {
    fetchData({ page, search: debouncedSearch });
  }, [page, debouncedSearch, fetchData]);

  const reload = () => fetchData({ page, search: debouncedSearch });

  return { rows, loading, error, page, setPage, search, setSearch, pagination, reload, fetchData };
}

/** Trigger a download from a Blob/report endpoint. */
export async function downloadReport(type, format, params = {}) {
  const query = new URLSearchParams(params);
  const resp = await fetch(`/api/reports/${type}/export?format=${format}&${query.toString()}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.message || 'Export failed');
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-report-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : format}`;
  a.click();
  URL.revokeObjectURL(url);
}
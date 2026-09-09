import { useState } from 'react';

export function useReportsFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = async (params = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') query.set(k, v); });
      const res = await api2.get(`${url}?${query.toString()}`);
      setData(res.data.data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetch };
}

import { api as api2 } from '../lib/api';
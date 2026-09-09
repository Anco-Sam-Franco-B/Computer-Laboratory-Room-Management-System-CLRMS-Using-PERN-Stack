import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL });

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

async function refreshTokens() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
  useAuthStore.getState().setUser({ ...data.data.user, accessToken: data.data.accessToken });
  return data.data.accessToken;
}

// Response interceptor — handle 401 by refreshing once, otherwise logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && !original._retry && !original.url.includes('/auth/login') && !original.url.includes('/auth/refresh')) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || refreshTokens();
        const token = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        if (!['/login', '/forgot-password', '/reset-password', '/verify-email'].includes(window.location.pathname)) {
          window.location.href = '/login';
        }
        refreshPromise = null;
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// tooltip-looking: convenient error message extractor
export function extractError(error, fallback = 'Something went wrong.') {
  return (error?.response?.data?.message) || error?.message || fallback;
}

import { useAuthStore } from '../stores/authStore';

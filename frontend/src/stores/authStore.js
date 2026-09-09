import { create } from 'zustand';
import { api } from '../lib/api';

const userFromStorage = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: userFromStorage(),
  isAuthenticated: !!localStorage.getItem('accessToken'),

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', user.accessToken || localStorage.getItem('accessToken'));
    set({ user, isAuthenticated: true });
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    const payload = data.data;
    localStorage.setItem('accessToken', payload.accessToken);
    localStorage.setItem('refreshToken', payload.refreshToken);
    localStorage.setItem('user', JSON.stringify(payload.user));
    set({ user: payload.user, isAuthenticated: true });
    return payload.user;
  },

  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    const { data } = await api.get('/auth/me');
    set({ user: { ...get().user, ...data.data }, isAuthenticated: true });
    return data.data;
  },

  withRole: (...roles) => {
    const { user } = get();
    return user && roles.includes(user.roleCode);
  },
}));
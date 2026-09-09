import { create } from 'zustand';
import { api } from '../lib/api';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unread: 0,

  init: async () => {
    const [list, count] = await Promise.all([
      api.get('/notifications?limit=30'),
      api.get('/notifications/unread-count'),
    ]);
    set({
      notifications: list.data.data,
      unread: count.data.data.count,
    });
  },

  addIncoming: (payload) => {
    set({
      notifications: [payload, ...get().notifications],
      unread: get().unread + 1,
    });
  },

  markRead: async (id) => {
    await api.patch(`/notifications/${id}/read`);
    set({
      notifications: get().notifications.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      unread: Math.max(0, get().unread - 1),
    });
  },

  markAllRead: async () => {
    await api.patch('/notifications/read-all');
    set({
      notifications: get().notifications.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })),
      unread: 0,
    });
  },
}));
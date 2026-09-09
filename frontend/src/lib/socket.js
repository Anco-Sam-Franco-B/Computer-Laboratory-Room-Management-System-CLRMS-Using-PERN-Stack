import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { toast } from '../stores/toastStore';

let socket = null;

export function connectSocket() {
  if (socket) return socket;
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => console.log('[socket] connected', socket.id));
  socket.on('disconnect', () => console.log('[socket] disconnected'));

  socket.on('notification:new', (payload) => {
    useNotificationStore.getState().addIncoming(payload);
    const typeMap = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
    toast[typeMap[payload.type] || 'info'](payload.message || payload.title);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

// reconnect after login/role changes
export function useSocket() {
  return socket;
}
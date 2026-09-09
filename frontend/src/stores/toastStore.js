import { create } from 'zustand';

let toastCounter = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  push: (message, type = 'info') => {
    const id = ++toastCounter;
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().dismiss(id), 4200);
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// Convenience helpers
export const toast = {
  success: (msg) => useToastStore.getState().push(msg, 'success'),
  error: (msg) => useToastStore.getState().push(msg, 'error'),
  info: (msg) => useToastStore.getState().push(msg, 'info'),
  warning: (msg) => useToastStore.getState().push(msg, 'warning'),
};
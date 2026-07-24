import { create } from 'zustand'
import { randomId } from './format'

// Lichte, niet-gepersisteerde toast-store.
export const useToast = create((set, get) => ({
  toasts: [],
  push(message, type = 'info') {
    const id = randomId('toast')
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3200)
    return id
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

// Handige helper buiten React-componenten.
export const toast = {
  success: (m) => useToast.getState().push(m, 'success'),
  error: (m) => useToast.getState().push(m, 'error'),
  info: (m) => useToast.getState().push(m, 'info'),
  gold: (m) => useToast.getState().push(m, 'gold'),
}

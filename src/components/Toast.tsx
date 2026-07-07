import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info' | 'loading'
  title: string
  message?: string
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => number
  removeToast: (id: number) => void
  updateToast: (id: number, updates: Partial<Omit<Toast, 'id'>>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastIdCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>): number => {
    const id = ++toastIdCounter
    setToasts((prev) => [...prev, { ...toast, id }])

    // Auto-remove non-loading toasts after 5s
    if (toast.type !== 'loading') {
      setTimeout(() => removeToast(id), 5000)
    }

    return id
  }, [removeToast])

  const updateToast = useCallback((id: number, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )

    // Auto-remove after update if no longer loading
    if (updates.type && updates.type !== 'loading') {
      setTimeout(() => removeToast(id), 5000)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ──────────────────────────────────────────────────
//  Toast Container & Item UI
// ──────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const iconMap = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    loading: '⏳',
  }

  const borderMap = {
    success: 'border-accent-500/30',
    error: 'border-red-500/30',
    info: 'border-primary-500/30',
    loading: 'border-amber-500/30',
  }

  return (
    <div
      className={`pointer-events-auto glass p-4 rounded-xl border ${borderMap[toast.type]}
        transition-all duration-300 ease-out cursor-pointer
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      onClick={() => onRemove(toast.id)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className={`text-lg flex-shrink-0 ${toast.type === 'loading' ? 'animate-spin' : ''}`}>
          {iconMap[toast.type]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dark-100">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-dark-400 mt-0.5 break-words">{toast.message}</p>
          )}
        </div>
      </div>
    </div>
  )
}

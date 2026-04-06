'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = crypto.randomUUID()
    const newToast: Toast = { id, message, type, duration }

    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast])
  const error = useCallback((message: string) => showToast(message, 'error', 6000), [showToast])
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast])
  const warning = useCallback((message: string) => showToast(message, 'warning', 5000), [showToast])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-20 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none md:left-auto md:right-4 md:max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      colors: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      iconColor: 'text-emerald-400',
    },
    error: {
      icon: <XCircle className="w-5 h-5" />,
      colors: 'bg-red-500/10 border-red-500/30 text-red-400',
      iconColor: 'text-red-400',
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      colors: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      iconColor: 'text-blue-400',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      colors: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      iconColor: 'text-amber-400',
    },
  }

  const { icon, colors, iconColor } = config[toast.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      role="alert"
      aria-live="assertive"
      className={`
        ${colors}
        backdrop-blur-lg border rounded-xl p-4
        shadow-lg flex items-start gap-3
        pointer-events-auto
      `}
    >
      <span className={iconColor}>{icon}</span>
      <p className="flex-1 text-sm text-white font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-zinc-400 hover:text-white transition-colors p-1 -m-1 rounded-lg hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

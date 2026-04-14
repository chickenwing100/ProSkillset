import { createContext, useCallback, useContext, useMemo, useState } from "react"

const ToastContext = createContext(null)

const TOAST_LIFETIME_MS = 3500

function ToastMessage({ toast, onDismiss }) {
  const stylesByType = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800"
  }

  const tone = stylesByType[toast.type] || stylesByType.info

  return (
    <div className={`w-full max-w-sm rounded-lg border px-4 py-3 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-xs font-semibold opacity-70 hover:opacity-100"
          type="button"
          aria-label="Dismiss notification"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message, type = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((previous) => [...previous, { id, message, type }])

    window.setTimeout(() => {
      dismissToast(id)
    }, TOAST_LIFETIME_MS)
  }, [dismissToast])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[1000] flex w-[min(92vw,24rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

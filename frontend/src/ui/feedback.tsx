import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type AlertType = 'success' | 'error' | 'info' | 'warning'

type AlertItem = {
  id: number
  type: AlertType
  message: string
}

type FeedbackContextType = {
  isLoading: boolean
  showLoader: () => void
  hideLoader: () => void
  withLoader: <T>(fn: () => Promise<T>) => Promise<T>
  showAlert: (message: string, type?: AlertType, ttlMs?: number) => void
}

const FeedbackContext = createContext<FeedbackContextType | null>(null)

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0)
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  const showLoader = useCallback(() => {
    setLoadingCount((value) => value + 1)
  }, [])

  const hideLoader = useCallback(() => {
    setLoadingCount((value) => Math.max(0, value - 1))
  }, [])

  const withLoader = useCallback(async <T,>(fn: () => Promise<T>) => {
    showLoader()
    try {
      return await fn()
    } finally {
      hideLoader()
    }
  }, [showLoader, hideLoader])

  const showAlert = useCallback((message: string, type: AlertType = 'info', ttlMs = 3200) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setAlerts((items) => [...items, { id, type, message }])

    window.setTimeout(() => {
      setAlerts((items) => items.filter((item) => item.id !== id))
    }, ttlMs)
  }, [])

  const contextValue = useMemo(() => ({
    isLoading: loadingCount > 0,
    showLoader,
    hideLoader,
    withLoader,
    showAlert,
  }), [hideLoader, loadingCount, showAlert, showLoader, withLoader])

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      {loadingCount > 0 ? (
        <div className="loader-overlay" role="status" aria-live="polite" aria-label="Loading">
          <div className="loader-spinner" />
          <p>Loading...</p>
        </div>
      ) : null}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {alerts.map((alert) => (
          <div key={alert.id} className={`toast toast-${alert.type}`}>
            {alert.message}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback must be used inside FeedbackProvider')
  }
  return context
}

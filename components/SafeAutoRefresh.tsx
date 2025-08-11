'use client'

import { useEffect, useState, useCallback } from 'react'

export default function SafeAutoRefresh() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [showUpdateNotification, setShowUpdateNotification] = useState(false)

  // Track user activity to prevent refresh during active use
  const updateActivityTime = useCallback(() => {
    setLastActivity(Date.now())
  }, [])

  // Check if user has been idle for more than 15 minutes
  const isIdle = useCallback(() => {
    return Date.now() - lastActivity > 15 * 60 * 1000 // 15 minutes
  }, [lastActivity])

  useEffect(() => {
    // Add activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, updateActivityTime, { passive: true })
    })

    // Service Worker registration and update handling
    if ('serviceWorker' in navigator && process.env.NEXT_PUBLIC_SW !== 'off') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Force immediate update check
        reg.update()
        
        // Check for updates every 10 minutes (less aggressive than before)
        const updateInterval = setInterval(() => {
          reg.update()
        }, 10 * 60 * 1000)

        // Check when app becomes visible but only if idle
        const handleVisibilityChange = () => {
          if (!document.hidden && isIdle()) {
            reg.update()
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Handle service worker updates intelligently
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data?.type === 'SW_UPDATED') {
            console.log('New version available')
            setUpdateAvailable(true)
            setShowUpdateNotification(true)
            
            // Only auto-refresh if user has been idle for >15 minutes
            const checkIdleAndRefresh = () => {
              if (isIdle() && document.visibilityState === 'visible') {
                console.log('Auto-refreshing after idle period')
                window.location.reload()
              } else {
                // Check again in 2 minutes if not idle
                setTimeout(checkIdleAndRefresh, 2 * 60 * 1000)
              }
            }
            
            // Start idle check after 5 seconds
            setTimeout(checkIdleAndRefresh, 5000)
          }
        })

        return () => {
          clearInterval(updateInterval)
          document.removeEventListener('visibilitychange', handleVisibilityChange)
          events.forEach(event => {
            document.removeEventListener(event, updateActivityTime)
          })
        }
      })
    }

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivityTime)
      })
    }
  }, [updateActivityTime, isIdle])

  const handleManualRefresh = () => {
    window.location.reload()
  }

  const dismissNotification = () => {
    setShowUpdateNotification(false)
  }

  if (!showUpdateNotification) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-brand-red/90 backdrop-blur-sm text-white rounded-2xl p-4 max-w-sm shadow-2xl border border-brand-red">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm mb-1">Update Available</div>
          <div className="text-xs text-white/90 mb-3">
            A new version is ready. We'll update automatically when you're not actively using the app, or you can update now.
          </div>
          <div className="flex gap-2">
            <button 
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-all"
              onClick={handleManualRefresh}
            >
              Update Now
            </button>
            <button 
              className="px-3 py-1 bg-black/20 hover:bg-black/30 rounded-lg text-xs font-medium transition-all"
              onClick={dismissNotification}
            >
              Later
            </button>
          </div>
        </div>
        <button 
          className="text-white/70 hover:text-white transition-colors p-1"
          onClick={dismissNotification}
        >
          ×
        </button>
      </div>
    </div>
  )
}
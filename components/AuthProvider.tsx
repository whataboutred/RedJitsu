'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO } from '@/lib/activeUser'

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * AuthProvider handles session persistence and auto-refresh
 * to prevent unexpected logouts during active use.
 *
 * Features:
 * - Listens for auth state changes
 * - Refreshes session periodically (every 10 minutes)
 * - Refreshes session when tab becomes visible again
 * - Handles token refresh errors gracefully
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const refreshIntervalRef = useRef<NodeJS.Timeout>()
  const lastRefreshRef = useRef<number>(Date.now())

  const failCountRef = useRef(0)

  // Refresh the session with retry logic
  const refreshSession = useCallback(async () => {
    if (DEMO) return // Skip for demo mode

    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        failCountRef.current++
        if (process.env.NODE_ENV === 'development') {
          console.warn('Session refresh warning:', error.message)
        }
        // After 3 consecutive failures, force re-auth
        if (failCountRef.current >= 3) {
          await supabase.auth.signOut()
          window.location.href = '/login'
        }
        return
      }

      // Reset fail counter on success
      failCountRef.current = 0

      if (data.session) {
        // Session is valid, update last refresh time
        lastRefreshRef.current = Date.now()

        // If session is close to expiring (within 5 minutes), refresh it
        const expiresAt = data.session.expires_at
        if (expiresAt) {
          const expiresAtMs = expiresAt * 1000
          const fiveMinutes = 5 * 60 * 1000

          if (expiresAtMs - Date.now() < fiveMinutes) {
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError && process.env.NODE_ENV === 'development') {
              console.warn('Token refresh warning:', refreshError.message)
            }
          }
        }
      }
    } catch (err) {
      failCountRef.current++
      if (process.env.NODE_ENV === 'development') {
        console.warn('Session check failed:', err)
      }
    }
  }, [])

  // Handle visibility change (user comes back to tab)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      // Only refresh if it's been more than 1 minute since last refresh
      const oneMinute = 60 * 1000
      if (Date.now() - lastRefreshRef.current > oneMinute) {
        refreshSession()
      }
    }
  }, [refreshSession])

  useEffect(() => {
    if (DEMO) return // Skip for demo mode

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          lastRefreshRef.current = Date.now()
        } else if (event === 'SIGNED_OUT') {
          // Clear any intervals when signed out
          if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current)
          }
        }
      }
    )

    // Initial session check
    refreshSession()

    // Set up periodic refresh (every 10 minutes)
    refreshIntervalRef.current = setInterval(refreshSession, 10 * 60 * 1000)

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSession, handleVisibilityChange])

  return <>{children}</>
}

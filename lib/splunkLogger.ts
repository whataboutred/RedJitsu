// Client-side Splunk logger that sends to our API route

// Event types for structured logging
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export enum EventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  WORKOUT_CREATED = 'workout_created',
  WORKOUT_UPDATED = 'workout_updated',
  WORKOUT_DELETED = 'workout_deleted',
  CARDIO_SESSION_CREATED = 'cardio_session_created',
  CARDIO_SESSION_UPDATED = 'cardio_session_updated',
  BJJ_SESSION_CREATED = 'bjj_session_created',
  DATABASE_ERROR = 'database_error',
  API_REQUEST = 'api_request',
  APP_ERROR = 'app_error'
}

export interface LogEvent {
  level: LogLevel
  event_type: EventType
  user_id?: string
  message: string
  data?: any
  timestamp?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
}

// Main logging function - sends to API route for remote Splunk
export function logToSplunk(event: LogEvent) {
  // In development, also log to console for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${event.level}] ${event.event_type}: ${event.message}`, event.data)
  }

  // Send to our API route (which handles server-side Splunk logging).
  // The server resolves user_id from the session token — client-supplied
  // user_id is ignored — so attach the token when a session exists.
  ;(async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { supabase } = await import('@/lib/supabaseClient')
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch {
      // No session available — log anonymously
    }
    await fetch('/api/log', {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    })
  })().catch(() => {
    // Silently fail — logging should not disrupt the user
  })
}

// Convenience functions for common log types
export const logger = {
  info: (event_type: EventType, message: string, data?: any, user_id?: string) => {
    logToSplunk({
      level: LogLevel.INFO,
      event_type,
      message,
      data,
      user_id
    })
  },

  warn: (event_type: EventType, message: string, data?: any, user_id?: string) => {
    logToSplunk({
      level: LogLevel.WARN,
      event_type,
      message,
      data,
      user_id
    })
  },

  error: (event_type: EventType, message: string, error?: any, user_id?: string) => {
    logToSplunk({
      level: LogLevel.ERROR,
      event_type,
      message,
      data: {
        error: error?.message || error,
        stack: error?.stack
      },
      user_id
    })
  },

  debug: (event_type: EventType, message: string, data?: any, user_id?: string) => {
    logToSplunk({
      level: LogLevel.DEBUG,
      event_type,
      message,
      data,
      user_id
    })
  }
}
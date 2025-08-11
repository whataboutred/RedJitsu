import { Logger } from 'splunk-logging'

// For localhost testing - disable SSL verification
if (process.env.NODE_ENV === 'development') {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
}

// Splunk configuration - add these to your environment variables
const SPLUNK_CONFIG = {
  token: process.env.SPLUNK_HEC_TOKEN || '',
  url: process.env.SPLUNK_URL || '',
  source: 'ironlog-app',
  sourcetype: '_json',
  index: 'main',
  maxBatchCount: 1,
  maxBatchSize: 0
}

// Create Splunk logger instance
const splunkLogger = new Logger(SPLUNK_CONFIG)

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

// Main logging function
export function logToSplunk(event: LogEvent) {
  // Only log if Splunk is configured
  if (!SPLUNK_CONFIG.token || !SPLUNK_CONFIG.url) {
    console.log('Splunk not configured, logging to console:', event)
    return
  }

  const logData = {
    time: Date.now(),
    event: {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      app: 'ironlog-workout-tracker',
      environment: process.env.NODE_ENV || 'development'
    }
  }

  splunkLogger.send(logData, (err: any, resp: any, body: any) => {
    if (err) {
      console.error('Failed to send log to Splunk:', err)
    }
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
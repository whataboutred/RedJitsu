import { NextRequest, NextResponse } from 'next/server'
import { Logger } from 'splunk-logging'

// Only disable SSL verification in local development for self-signed Splunk certs.
// NEVER runs in production — NODE_ENV is 'production' on Vercel/hosting.
if (process.env.NODE_ENV === 'development' && process.env.SPLUNK_ALLOW_SELF_SIGNED === 'true') {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
}

const MAX_MESSAGE_LENGTH = 1000
const MAX_DATA_SIZE = 5000 // chars when stringified

const SPLUNK_CONFIG = {
  token: process.env.SPLUNK_HEC_TOKEN || '',
  url: process.env.SPLUNK_URL || '',
  source: 'ironlog-app',
  sourcetype: '_json',
  index: 'main',
  maxBatchCount: 1,
  maxBatchSize: 0
}

const splunkLogger = SPLUNK_CONFIG.token ? new Logger(SPLUNK_CONFIG) : null

const VALID_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG']

function sanitizeLogEvent(event: any): { valid: boolean; sanitized: any } {
  if (!event || typeof event !== 'object') return { valid: false, sanitized: null }

  // Validate required fields
  if (!event.event_type || typeof event.event_type !== 'string') return { valid: false, sanitized: null }
  if (!event.message || typeof event.message !== 'string') return { valid: false, sanitized: null }

  // Validate level
  const level = VALID_LEVELS.includes(event.level) ? event.level : 'INFO'

  // Truncate message
  const message = event.message.slice(0, MAX_MESSAGE_LENGTH)

  // Sanitize and truncate data payload
  let data = event.data
  if (data) {
    const dataStr = JSON.stringify(data)
    if (dataStr.length > MAX_DATA_SIZE) {
      data = { truncated: true, preview: dataStr.slice(0, MAX_DATA_SIZE) }
    }
  }

  return {
    valid: true,
    sanitized: {
      level,
      event_type: event.event_type.slice(0, 100),
      message,
      data,
      user_id: typeof event.user_id === 'string' ? event.user_id.slice(0, 100) : undefined,
      timestamp: event.timestamp || new Date().toISOString(),
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawEvent = await request.json()

    const { valid, sanitized } = sanitizeLogEvent(rawEvent)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid log data' }, { status: 400 })
    }

    // If Splunk is not configured, log to console in development only
    if (!splunkLogger) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${sanitized.level}] ${sanitized.event_type}: ${sanitized.message}`)
      }
      return NextResponse.json({ success: true })
    }

    // Send to Splunk
    return new Promise<NextResponse>((resolve) => {
      const logData = {
        time: Date.now(),
        event: {
          ...sanitized,
          app: 'ironlog-workout-tracker',
          environment: process.env.NODE_ENV || 'development'
        },
        message: sanitized.message
      }

      splunkLogger.send(logData, (err: any) => {
        if (err) {
          console.error('Splunk send failed:', err.message)
          resolve(NextResponse.json({ success: false }, { status: 500 }))
        } else {
          resolve(NextResponse.json({ success: true }))
        }
      })
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid log data' }, { status: 400 })
  }
}
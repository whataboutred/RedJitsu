import { NextRequest, NextResponse } from 'next/server'
import { Logger } from 'splunk-logging'
import { createClient } from '@supabase/supabase-js'

// Only disable SSL verification in local development for self-signed Splunk certs.
// NEVER runs in production — NODE_ENV is 'production' on Vercel/hosting.
if (process.env.NODE_ENV === 'development' && process.env.SPLUNK_ALLOW_SELF_SIGNED === 'true') {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
}

const MAX_MESSAGE_LENGTH = 1000
const MAX_DATA_SIZE = 5000 // chars when stringified

// Best-effort per-IP rate limit. In-memory, so it's per-serverless-instance
// on Vercel — good enough to stop casual abuse, not a hard guarantee.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_EVENTS = 30
const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  bucket.count++
  if (rateBuckets.size > 10_000) rateBuckets.clear() // cap memory
  return bucket.count > RATE_LIMIT_MAX_EVENTS
}

// Lazy so a bad Splunk config surfaces per-request instead of crashing the
// module at cold start.
let splunkLogger: Logger | null | undefined
function getSplunkLogger(): Logger | null {
  if (splunkLogger !== undefined) return splunkLogger
  const token = process.env.SPLUNK_HEC_TOKEN || ''
  const url = process.env.SPLUNK_URL || ''
  splunkLogger = token && url
    ? new Logger({
        token,
        url,
        source: 'ironlog-app',
        sourcetype: '_json',
        index: 'main',
        maxBatchCount: 1,
        maxBatchSize: 0,
      })
    : null
  return splunkLogger
}

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
      timestamp: event.timestamp || new Date().toISOString(),
    }
  }
}

// Never trust a client-supplied user_id: resolve it from the bearer token
// when one is sent, otherwise record the event as anonymous.
async function resolveUserId(request: NextRequest): Promise<{ userId: string; verified: boolean }> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (token && supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) return { userId: user.id, verified: true }
    } catch {
      // fall through to anonymous
    }
  }
  return { userId: 'anonymous', verified: false }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    const rawEvent = await request.json()

    const { valid, sanitized } = sanitizeLogEvent(rawEvent)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid log data' }, { status: 400 })
    }

    const { userId, verified } = await resolveUserId(request)
    sanitized.user_id = userId
    sanitized.verified = verified

    // If Splunk is not configured, log to console in development only
    const logger = getSplunkLogger()
    if (!logger) {
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

      logger.send(logData, (err: any) => {
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

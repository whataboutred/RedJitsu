import { NextRequest, NextResponse } from 'next/server'
import { Logger } from 'splunk-logging'

// Disable SSL verification for self-signed certificates
if (process.env.NODE_ENV === 'development') {
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
}

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

export async function POST(request: NextRequest) {
  try {
    const logEvent = await request.json()
    
    // If Splunk is not configured, just log to console
    if (!splunkLogger) {
      console.log('Splunk not configured, logging to console:', logEvent)
      return NextResponse.json({ success: true, message: 'Logged to console' })
    }

    // Send to Splunk
    return new Promise<NextResponse>((resolve) => {
      const logData = {
        time: Date.now(),
        event: {
          ...logEvent,
          timestamp: logEvent.timestamp || new Date().toISOString(),
          app: 'ironlog-workout-tracker',
          environment: process.env.NODE_ENV || 'development'
        },
        message: logEvent.message
      }

      splunkLogger.send(logData, (err: any, resp: any, body: any) => {
        if (err) {
          console.error('Failed to send log to Splunk:', err)
          resolve(NextResponse.json({ 
            success: false, 
            error: err.message 
          }, { status: 500 }))
        } else {
          console.log('Successfully sent log to Splunk')
          resolve(NextResponse.json({ 
            success: true, 
            message: 'Logged to Splunk' 
          }))
        }
      })
    })
  } catch (error) {
    console.error('Error in log API route:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid log data' 
    }, { status: 400 })
  }
}
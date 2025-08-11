declare module 'splunk-logging' {
  export class Logger {
    constructor(config: {
      token: string
      url: string
      source?: string
      sourcetype?: string
      index?: string
      maxBatchCount?: number
      maxBatchSize?: number
    })
    
    send(data: any, callback?: (err: any, resp: any, body: any) => void): void
  }
}
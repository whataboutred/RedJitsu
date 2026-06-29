import 'server-only'
import { GH_TOKEN_URL, GH_REVOKE_URL, GH_API_BASE, GH_SCOPE } from './constants'
import type { GoogleExerciseDataPoint } from './map'

function clientId() {
  const v = process.env.GOOGLE_HEALTH_CLIENT_ID
  if (!v) throw new Error('GOOGLE_HEALTH_CLIENT_ID not set')
  return v
}
function clientSecret() {
  const v = process.env.GOOGLE_HEALTH_CLIENT_SECRET
  if (!v) throw new Error('GOOGLE_HEALTH_CLIENT_SECRET not set')
  return v
}

export type GoogleTokens = {
  accessToken: string
  refreshToken: string | null // Google omits this on refresh; keep the old one
  expiresAt: string // ISO
  scope: string
}

function parseTokenResponse(json: any): GoogleTokens {
  const expiresIn = Number(json.expires_in ?? 3600)
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: json.scope ?? GH_SCOPE,
  }
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId(),
    client_secret: clientSecret(),
  })
  const res = await fetch(GH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  return parseTokenResponse(await res.json())
}

export async function refreshTokens(refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
  })
  const res = await fetch(GH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`)
  return parseTokenResponse(await res.json())
}

export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`${GH_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch {
    /* best effort */
  }
}

// List exercise sessions on/after a civil start time (ISO 8601, no offset),
// paging through results.
export async function fetchExercisesSince(
  accessToken: string,
  afterIsoLocal: string
): Promise<GoogleExerciseDataPoint[]> {
  const filter = `exercise.interval.civil_start_time >= "${afterIsoLocal}"`
  let url = `${GH_API_BASE}/users/me/dataTypes/exercise/dataPoints?pageSize=100&filter=${encodeURIComponent(filter)}`
  const out: GoogleExerciseDataPoint[] = []

  // Cap pages defensively so a runaway never loops forever.
  for (let page = 0; page < 10; page++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Google Health list failed: ${res.status} ${await res.text()}`)
    const json = await res.json()
    const points = (json.dataPoints ?? json.dataPoint ?? []) as GoogleExerciseDataPoint[]
    out.push(...points)
    const next = json.nextPageToken
    if (!next) break
    url = `${GH_API_BASE}/users/me/dataTypes/exercise/dataPoints?pageSize=100&pageToken=${encodeURIComponent(next)}&filter=${encodeURIComponent(filter)}`
  }
  return out
}

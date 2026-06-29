import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookies } from '@/lib/fitbit/server'
import { exchangeCodeForTokens } from '@/lib/fitbit/client'
import { encryptToken } from '@/lib/fitbit/crypto'
import { FITBIT_OAUTH_COOKIE, FITBIT_DEFAULT_ALLOWED } from '@/lib/fitbit/constants'

function done(req: NextRequest, status: 'connected' | 'error') {
  const res = NextResponse.redirect(new URL(`/settings/connections?fitbit=${status}`, req.url))
  res.cookies.delete(FITBIT_OAUTH_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')

  // Verify CSRF state against the cookie set in /connect
  let stored: { codeVerifier: string; state: string } | null = null
  try {
    const raw = req.cookies.get(FITBIT_OAUTH_COOKIE)?.value
    stored = raw ? JSON.parse(raw) : null
  } catch {
    stored = null
  }
  if (!code || !state || !stored || stored.state !== state) {
    return done(req, 'error')
  }

  const auth = await getUserFromCookies()
  const redirectUri = process.env.GOOGLE_HEALTH_REDIRECT_URI
  if (!auth || !redirectUri) return done(req, 'error')

  try {
    const tokens = await exchangeCodeForTokens(code, stored.codeVerifier, redirectUri)

    // Preserve an existing allowlist + refresh token on reconnect.
    const { data: existing } = await auth.supabase
      .from('fitbit_connections')
      .select('user_id, allowed_activities, refresh_token_enc')
      .eq('user_id', auth.userId)
      .maybeSingle()

    const row = {
      user_id: auth.userId,
      fitbit_user_id: 'Google Health',
      access_token_enc: encryptToken(tokens.accessToken),
      refresh_token_enc: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : (existing as any)?.refresh_token_enc ?? null,
      expires_at: tokens.expiresAt,
      scopes: tokens.scope,
      allowed_activities:
        existing && Array.isArray((existing as any).allowed_activities) && (existing as any).allowed_activities.length > 0
          ? (existing as any).allowed_activities
          : FITBIT_DEFAULT_ALLOWED,
      last_error: null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await auth.supabase
      .from('fitbit_connections')
      .upsert(row, { onConflict: 'user_id' })
    if (error) throw error

    return done(req, 'connected')
  } catch (err) {
    console.error('Fitbit callback error:', err)
    return done(req, 'error')
  }
}

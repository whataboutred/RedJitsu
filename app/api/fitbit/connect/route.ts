import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { getUserFromCookies } from '@/lib/fitbit/server'
import { GH_AUTHORIZE_URL, GH_SCOPE, FITBIT_OAUTH_COOKIE } from '@/lib/fitbit/constants'

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function GET(req: NextRequest) {
  const auth = await getUserFromCookies()
  if (!auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID
  const redirectUri = process.env.GOOGLE_HEALTH_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL('/settings/connections?fitbit=error', req.url))
  }

  // PKCE + CSRF state
  const codeVerifier = base64url(randomBytes(48))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
  const state = base64url(randomBytes(16))

  const authorizeUrl = new URL(GH_AUTHORIZE_URL)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', GH_SCOPE)
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  // Needed to receive a refresh token from Google, and to re-prompt for it.
  authorizeUrl.searchParams.set('access_type', 'offline')
  authorizeUrl.searchParams.set('prompt', 'consent')

  const res = NextResponse.redirect(authorizeUrl.toString())
  res.cookies.set(FITBIT_OAUTH_COOKIE, JSON.stringify({ codeVerifier, state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}

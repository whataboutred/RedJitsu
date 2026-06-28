import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/reset-password', '/about']
const PUBLIC_PREFIXES = ['/legal']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Demo mode allows unauthenticated browsing.
  if (process.env.NEXT_PUBLIC_DEMO_MODE?.toLowerCase() === 'true') {
    return response
  }

  // Missing env vars means we can't validate sessions. In development this is
  // a local-setup convenience (fail open); in PRODUCTION a misconfig must NOT
  // silently disable route protection — fail closed and send to login.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'production' && !isPublicPath(request.nextUrl.pathname)) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Also refreshes the session cookie when the access token has expired.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Run on all paths except API routes (they do their own bearer auth),
     * Next.js internals, the service worker, and static assets.
     */
    '/((?!api|_next/static|_next/image|sw\\.js|manifest\\.webmanifest|icons|favicon\\.ico|apple-touch-icon\\.png|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp|woff2?)$).*)',
  ],
}

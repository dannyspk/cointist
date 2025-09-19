import { NextResponse } from 'next/server'

// Protect /admin and /api/admin routes unless a secret cookie or bypass token is present.
export function middleware(req) {
  const { pathname } = req.nextUrl

  // Only apply to admin UI and admin API routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  // Use CMS_PASSWORD (or NEXT_PUBLIC_CMS_PASSWORD fallback) as the secret
  const secret = process.env.CMS_PASSWORD || process.env.NEXT_PUBLIC_CMS_PASSWORD || ''
  // If no secret configured:
  // - in production we must block access to admin to avoid accidental public exposure
  // - in non-production (development/test) allow access for convenience
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Not found', { status: 404 })
    }
    return NextResponse.next()
  }

  // Allow if request contains the secret header
  const header = req.headers.get('x-cms-password') || ''
  if (header === secret) return NextResponse.next()

  // Allow if a valid cookie is already set
  const cookie = req.cookies.get('cms_auth')?.value || ''
  if (cookie === secret) return NextResponse.next()

  // Support a one-time bypass link: ?x-admin-bypass=SECRET
  const bypass = req.nextUrl.searchParams.get('x-admin-bypass')
  if (bypass && bypass === secret) {
    // Set an httpOnly cookie and redirect to same URL without the token
    const url = req.nextUrl.clone()
    url.searchParams.delete('x-admin-bypass')
    const res = NextResponse.redirect(url)
    // Cookie options: httpOnly, secure, sameSite lax
    res.cookies.set('cms_auth', secret, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' })
    return res
  }

  // Otherwise block access (404) to avoid exposing admin UI to crawlers or casual visitors
  return new NextResponse('Not found', { status: 404 })
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

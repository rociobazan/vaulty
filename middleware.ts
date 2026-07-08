import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "vaulty-local-dev-secret-change-in-production",
)

const PUBLIC_PATHS = new Set([
  "/login",
  "/sw.js",
  "/manifest.json",
  "/manifest.webmanifest",
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.has(pathname)
  const token = request.cookies.get("nr_session")?.value

  let authenticated = false
  if (token) {
    try {
      await jwtVerify(token, secret)
      authenticated = true
    } catch {
      // expired or tampered — treat as unauthenticated
    }
  }

  if (!authenticated && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (authenticated && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Skip Next.js internals, static assets and PWA files
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|icon.*|apple-icon.*|sw\\.js|manifest\\.json|manifest\\.webmanifest).*)",
  ],
}

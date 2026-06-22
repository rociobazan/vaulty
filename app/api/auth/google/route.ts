import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex")

  const cookieStore = await cookies()
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes
    sameSite: "lax",
    path: "/",
  })

  const callbackUrl = `${request.nextUrl.origin}/api/auth/google/callback`

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  )
}

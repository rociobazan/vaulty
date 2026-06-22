import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const cookieStore = await cookies()
  const savedState = cookieStore.get("oauth_state")?.value
  cookieStore.delete("oauth_state")

  const failUrl = `${origin}/login?error=oauth_failed`

  if (error || !code || !state || state !== savedState) {
    return NextResponse.redirect(failUrl)
  }

  // Exchange authorization code for access token
  const callbackUrl = `${origin}/api/auth/google/callback`
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenRes.ok) return NextResponse.redirect(failUrl)

  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // Fetch Google user profile
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userInfoRes.ok) return NextResponse.redirect(failUrl)

  const {
    sub: googleId,
    email,
    name,
    picture,
  } = (await userInfoRes.json()) as {
    sub: string
    email?: string
    name?: string
    picture?: string
  }

  if (!email) return NextResponse.redirect(`${origin}/login?error=no_email`)

  // Find or create user — if the email already exists, link the Google provider to it
  // so the user keeps all their existing budget/investment data.
  let user = await prisma.user.findUnique({ where: { email } })

  if (user) {
    if (!user.providerAccountId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          providerAccountId: googleId,
          provider: "google",
          image: picture ?? user.image ?? null,
        },
      })
    }
  } else {
    user = await prisma.user.create({
      data: {
        name: name ?? email.split("@")[0],
        email,
        provider: "google",
        providerAccountId: googleId,
        image: picture ?? null,
      },
    })
  }

  await createSession({ id: user.id, name: user.name, email: user.email })
  return NextResponse.redirect(`${origin}/`)
}

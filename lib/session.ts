import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const COOKIE_NAME = "nr_session"
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "vaulty-local-dev-secret-change-in-production",
)

export interface SessionUser {
  id: string
  name: string
  email: string
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ id: user.id, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)

  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret)
    const { id, name, email } = payload as unknown as SessionUser
    return { id, name, email }
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
  redirect("/login")
}

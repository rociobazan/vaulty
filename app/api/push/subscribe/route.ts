import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
})

// POST /api/push/subscribe
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const parsed = SubscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 422 })
    }

    const { endpoint, keys } = parsed.data

    // Upsert: si ya existe el endpoint lo actualiza, si no lo crea
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: session.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: session.id, p256dh: keys.p256dh, auth: keys.auth },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/push/subscribe]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/push/subscribe
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const endpoint = body?.endpoint
    if (!endpoint) return NextResponse.json({ error: "endpoint requerido" }, { status: 422 })

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.id },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/push/subscribe]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

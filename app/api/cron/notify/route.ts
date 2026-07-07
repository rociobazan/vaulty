import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/web-push"

// Avisar 2 días antes Y el mismo día del vencimiento
const ALERT_OFFSETS = [2, 0]

export const dynamic = "force-dynamic"

function todayAR(): Date {
  const now = new Date()
  now.setHours(now.getHours() - 3)
  return now
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const pad = (n: number) => String(n).padStart(2, "0")

// GET /api/cron/notify  — llamado por Vercel Cron todos los días a las 9am
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const querySecret = req.nextUrl.searchParams.get("secret")
  const secret = bearerSecret ?? querySecret
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const today = todayAR()
    let sent = 0
    let skipped = 0

    for (const offset of ALERT_OFFSETS) {
      const targetDate   = addDays(today, offset)
      const targetDay    = targetDate.getDate()
      const targetMonth  = targetDate.getMonth() + 1
      const targetYear   = targetDate.getFullYear()
      const monthKey     = `${targetYear}-${pad(targetMonth)}`
      const dateStr      = `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`

      const msgSuffix = offset === 0
        ? `¡Hoy es el día!`
        : `Vence en ${offset} días (${dateStr}).`

      const budgets = await prisma.monthBudget.findMany({
        where: { monthKey },
        select: { userId: true, fixedItems: true, creditCards: true },
      })

      for (const budget of budgets) {
        if (!budget.userId) continue

        const subs = await prisma.pushSubscription.findMany({
          where: { userId: budget.userId },
        })
        if (subs.length === 0) continue

        const notifications: { title: string; body: string; tag: string }[] = []

        // ── Gastos fijos ──────────────────────────────────────────────────
        const fixedItems = budget.fixedItems as {
          id: string; label: string; value: number; dueDay?: number
        }[]
        for (const item of fixedItems) {
          if (item.dueDay === targetDay) {
            notifications.push({
              title: offset === 0 ? `📋 Vence hoy: ${item.label}` : `📋 Próximo vencimiento: ${item.label}`,
              body:  `${msgSuffix} Monto: $${item.value.toLocaleString("es-AR")}`,
              tag:   `fixed-${item.id}-${monthKey}-d${offset}`,
            })
          }
        }

        // ── Tarjetas ──────────────────────────────────────────────────────
        const creditCards = budget.creditCards as {
          id: string; name: string; dueDate?: string
        }[]
        for (const card of creditCards) {
          if (card.dueDate === dateStr) {
            notifications.push({
              title: offset === 0 ? `💳 Vence hoy: ${card.name}` : `💳 Próximo vencimiento: ${card.name}`,
              body:  `Tu tarjeta ${card.name}. ${msgSuffix}`,
              tag:   `card-${card.id}-${monthKey}-d${offset}`,
            })
          }
        }

        // ── Enviar ────────────────────────────────────────────────────────
        for (const notif of notifications) {
          for (const sub of subs) {
            try {
              await sendPush(sub, {
                title: notif.title,
                body:  notif.body,
                icon:  "/icon-192.png",
                tag:   notif.tag,
              })
              sent++
            } catch (err: unknown) {
              const status = (err as { statusCode?: number }).statusCode
              if (status === 410 || status === 404) {
                await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } })
              }
              skipped++
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, sent, skipped })
  } catch (err) {
    console.error("[GET /api/cron/notify]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

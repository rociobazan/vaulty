import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPush } from "@/lib/web-push"

// Cuántos días antes avisar
const DAYS_AHEAD = 2

export const dynamic = "force-dynamic"

function todayAR(): Date {
  // Ajusta a GMT-3 (Argentina)
  const now = new Date()
  now.setHours(now.getHours() - 3)
  return now
}

// GET /api/cron/notify  — llamado por Vercel Cron todos los días a las 9am
export async function GET(req: NextRequest) {
  // Verificar secret — Vercel lo envía como "Authorization: Bearer <CRON_SECRET>"
  const authHeader = req.headers.get("authorization")
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const querySecret = req.nextUrl.searchParams.get("secret")
  const secret = bearerSecret ?? querySecret
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const today = todayAR()
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + DAYS_AHEAD)
    const targetDay   = targetDate.getDate()          // 1–31
    const targetMonth = targetDate.getMonth() + 1     // 1–12
    const targetYear  = targetDate.getFullYear()

    // YYYY-MM formateado para buscar el presupuesto del mes correcto
    const monthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`

    // Buscar todos los presupuestos del mes objetivo
    const budgets = await prisma.monthBudget.findMany({
      where: { monthKey },
      select: { userId: true, fixedItems: true, creditCards: true },
    })

    let sent = 0
    let skipped = 0

    for (const budget of budgets) {
      if (!budget.userId) continue

      const subs = await prisma.pushSubscription.findMany({
        where: { userId: budget.userId },
      })
      if (subs.length === 0) continue

      const notifications: { title: string; body: string; tag: string }[] = []

      // ── Gastos fijos: tienen dueDay (1-31) ───────────────────────────────
      const fixedItems = budget.fixedItems as {
        id: string; label: string; value: number; dueDay?: number
      }[]
      for (const item of fixedItems) {
        if (item.dueDay === targetDay) {
          notifications.push({
            title: `📋 Vencimiento: ${item.label}`,
            body:  `Vence en ${DAYS_AHEAD} días (día ${targetDay}). Monto: $${item.value.toLocaleString("es-AR")}`,
            tag:   `fixed-${item.id}-${monthKey}`,
          })
        }
      }

      // ── Tarjetas: tienen dueDate (YYYY-MM-DD) ───────────────────────────
      const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`
      const creditCards = budget.creditCards as {
        id: string; name: string; dueDate?: string; purchases?: unknown[]
      }[]
      for (const card of creditCards) {
        if (card.dueDate === targetDateStr) {
          notifications.push({
            title: `💳 Vencimiento tarjeta: ${card.name}`,
            body:  `Tu tarjeta ${card.name} vence en ${DAYS_AHEAD} días (${targetDateStr}).`,
            tag:   `card-${card.id}-${monthKey}`,
          })
        }
      }

      // Mandar cada notificación a todas las suscripciones del usuario
      for (const notif of notifications) {
        for (const sub of subs) {
          try {
            await sendPush(sub, {
              title: notif.title,
              body:  notif.body,
              icon:  "/apple-icon.png",
              tag:   notif.tag,
            })
            sent++
          } catch (err: unknown) {
            // Si la suscripción expiró (410) la eliminamos
            const status = (err as { statusCode?: number }).statusCode
            if (status === 410 || status === 404) {
              await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } })
            }
            skipped++
          }
        }
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, targetDate: targetDateStr })
  } catch (err) {
    console.error("[GET /api/cron/notify]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

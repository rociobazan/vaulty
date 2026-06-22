import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export const runtime = "nodejs"

export interface HistoryPoint {
  date: string       // YYYY-MM-DD
  label: string      // "14 Jun"
  arsValue: number
  usdValue: number
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json([], { status: 401 })

  const investments = await prisma.investment.findMany({
    where: { userId: session.id },
    select: { id: true, currency: true },
  })

  if (investments.length === 0) return NextResponse.json([])

  const investmentIds = investments.map((i) => i.id)

  const [transactions, priceHistory] = await Promise.all([
    prisma.transaction.findMany({
      where: { investmentId: { in: investmentIds } },
      orderBy: { date: "asc" },
    }),
    prisma.priceHistory.findMany({
      where: { investmentId: { in: investmentIds } },
      orderBy: { date: "asc" },
    }),
  ])

  if (priceHistory.length === 0) return NextResponse.json([])

  // Map investmentId → currency
  const invCurrency = new Map(investments.map((i) => [i.id, i.currency]))

  // Group transactions by investmentId for holdings calculation
  const txnByInv = new Map<string, { date: string; delta: number }[]>()
  for (const txn of transactions) {
    if (!txnByInv.has(txn.investmentId)) txnByInv.set(txn.investmentId, [])
    txnByInv.get(txn.investmentId)!.push({
      date: txn.date,
      delta: txn.type === "BUY" ? txn.cuotapartes : -txn.cuotapartes,
    })
  }

  function getHeld(invId: string, targetDate: string): number {
    const txns = txnByInv.get(invId)
    if (!txns) return 0
    let held = 0
    for (const t of txns) {
      if (t.date <= targetDate) held += t.delta
    }
    return Math.max(0, held)
  }

  // Group price history by date → Map<investmentId, price>
  const pricesByDate = new Map<string, Map<string, number>>()
  for (const ph of priceHistory) {
    if (!pricesByDate.has(ph.date)) pricesByDate.set(ph.date, new Map())
    pricesByDate.get(ph.date)!.set(ph.investmentId, ph.price)
  }

  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

  const result: HistoryPoint[] = Array.from(pricesByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => {
      let arsValue = 0
      let usdValue = 0

      for (const [invId, price] of prices) {
        const held = getHeld(invId, date)
        if (held <= 0) continue

        const currency = invCurrency.get(invId) ?? "ARS"
        const value = held * price

        if (currency === "USD") usdValue += value
        else arsValue += value
      }

      const [, month, day] = date.split("-")
      const label = `${parseInt(day)} ${MONTHS[parseInt(month) - 1]}`
      return { date, label, arsValue, usdValue }
    })
    .filter((p) => p.arsValue > 0 || p.usdValue > 0)

  return NextResponse.json(result)
}

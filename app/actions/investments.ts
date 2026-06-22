"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

// ── Fund payload (metadata only — no cuotapartes/buyPrice) ────────────────────

export interface FundPayload {
  cafciId: number | null
  name: string
  ticker: string
  currency: string
  currentPrice: number
  priceDate: string | null
}

// ── Transaction payload ────────────────────────────────────────────────────────

export interface TransactionPayload {
  type: "BUY" | "SELL"
  date: string       // YYYY-MM-DD
  cuotapartes: number
  price: number      // per cuotaparte at operation time
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createFundWithTransaction(
  fund: FundPayload,
  txn: TransactionPayload,
) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  // Defensive guard: never create a duplicate Investment for the same CAFCI fund
  // within this user's portfolio.
  if (fund.cafciId) {
    const existing = await prisma.investment.findFirst({
      where: { cafciId: fund.cafciId, userId: session.id },
    })
    if (existing) {
      await prisma.transaction.create({
        data: {
          investmentId: existing.id,
          type: txn.type,
          date: txn.date,
          cuotapartes: txn.cuotapartes,
          price: txn.price,
        },
      })
      revalidatePath("/")
      return existing
    }
  }

  const investment = await prisma.investment.create({
    data: {
      userId: session.id,
      cafciId: fund.cafciId,
      name: fund.name,
      ticker: fund.ticker,
      currency: fund.currency,
      currentPrice: fund.currentPrice,
      priceDate: fund.priceDate,
    },
  })

  await prisma.transaction.create({
    data: {
      investmentId: investment.id,
      type: txn.type,
      date: txn.date,
      cuotapartes: txn.cuotapartes,
      price: txn.price,
    },
  })

  // Seed today's price into history so the chart shows immediately
  if (fund.cafciId && fund.currentPrice > 0) {
    const today = new Date().toISOString().slice(0, 10)
    await prisma.priceHistory.upsert({
      where: { investmentId_date: { investmentId: investment.id, date: today } },
      create: {
        investmentId: investment.id,
        cafciId: fund.cafciId,
        currency: fund.currency,
        date: today,
        price: fund.currentPrice,
      },
      update: { price: fund.currentPrice },
    })
  }

  revalidatePath("/")
  return investment
}

export async function addTransaction(
  investmentId: string,
  txn: TransactionPayload,
) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  // Verify ownership
  const inv = await prisma.investment.findFirst({ where: { id: investmentId, userId: session.id } })
  if (!inv) throw new Error("Inversión no encontrada")

  const result = await prisma.transaction.create({
    data: {
      investmentId,
      type: txn.type,
      date: txn.date,
      cuotapartes: txn.cuotapartes,
      price: txn.price,
    },
  })
  revalidatePath("/")
  return result
}

export async function updateTransaction(id: string, txn: TransactionPayload) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  // Verify the transaction belongs to this user's investment
  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: { investmentId: true },
  })
  if (!existing) throw new Error("Transacción no encontrada")

  const inv = await prisma.investment.findFirst({
    where: { id: existing.investmentId, userId: session.id },
  })
  if (!inv) throw new Error("No autorizado")

  const result = await prisma.transaction.update({
    where: { id },
    data: {
      type: txn.type,
      date: txn.date,
      cuotapartes: txn.cuotapartes,
      price: txn.price,
    },
  })
  revalidatePath("/")
  return result
}

export async function deleteTransaction(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const txn = await prisma.transaction.findUnique({
    where: { id },
    select: { investmentId: true },
  })
  if (!txn) return

  // Verify ownership
  const inv = await prisma.investment.findFirst({
    where: { id: txn.investmentId, userId: session.id },
  })
  if (!inv) throw new Error("No autorizado")

  await prisma.transaction.delete({ where: { id } })

  // If the fund now has no transactions, clean up its history and record
  const remaining = await prisma.transaction.count({
    where: { investmentId: txn.investmentId },
  })
  if (remaining === 0) {
    await prisma.priceHistory.deleteMany({ where: { investmentId: txn.investmentId } })
    await prisma.investment.delete({ where: { id: txn.investmentId } })
  }

  revalidatePath("/")
}

export async function deleteInvestment(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const inv = await prisma.investment.findFirst({ where: { id, userId: session.id } })
  if (!inv) throw new Error("No autorizado")

  await prisma.transaction.deleteMany({ where: { investmentId: id } })
  await prisma.priceHistory.deleteMany({ where: { investmentId: id } })
  await prisma.investment.delete({ where: { id } })
  revalidatePath("/")
}

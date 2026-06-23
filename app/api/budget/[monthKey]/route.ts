import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

// GET /api/budget/:monthKey
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  const { monthKey } = await params
  try {
    const budget = await prisma.monthBudget.findFirst({
      where: { userId: session.id, monthKey },
    })
    if (!budget) return NextResponse.json(null, { status: 404 })
    const { userId: _uid, ...safeData } = budget
    return NextResponse.json(safeData)
  } catch (err) {
    console.error("[budget GET] error:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// PUT /api/budget/:monthKey — create or update the budget for this user+month
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  const { monthKey } = await params
  try {
    const { income, fixedItems, variableItems, savingsItems, creditCards } = await req.json()

    const existing = await prisma.monthBudget.findFirst({
      where: { userId: session.id, monthKey },
    })

    const budget = existing
      ? await prisma.monthBudget.update({
          where: { id: existing.id },
          data: { income, fixedItems, variableItems, savingsItems, creditCards },
        })
      : await prisma.monthBudget.create({
          data: { userId: session.id, monthKey, income, fixedItems, variableItems, savingsItems, creditCards },
        })

    const { userId: _uid2, ...safeBudget } = budget
    return NextResponse.json(safeBudget)
  } catch (err) {
    console.error("[budget PUT] error:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// DELETE /api/budget/:monthKey
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ monthKey: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  const { monthKey } = await params
  const budget = await prisma.monthBudget.findFirst({
    where: { userId: session.id, monthKey },
  })
  if (budget) await prisma.monthBudget.delete({ where: { id: budget.id } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

const AddFundsSchema = z.object({
  amount: z.number().positive(),
})

// POST /api/goals/:id/add-funds
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = AddFundsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 422 })
  }

  const goal = await prisma.goal.findFirst({
    where: { id, userId: session.id },
  })
  if (!goal) return NextResponse.json(null, { status: 404 })

  const updated = await prisma.goal.update({
    where: { id },
    data: { currentAmount: { increment: parsed.data.amount } },
    select: {
      id: true, title: true, targetAmount: true,
      currentAmount: true, deadline: true, createdAt: true,
    },
  })
  return NextResponse.json(updated)
}

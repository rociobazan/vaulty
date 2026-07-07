import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

const EditGoalSchema = z.object({
  title:         z.string().min(1).max(120).optional(),
  targetAmount:  z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  deadline:      z.string().datetime().nullable().optional(),
})

// PATCH /api/goals/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => null)
    const parsed = EditGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", detail: parsed.error.format() }, { status: 422 })
    }

    const goal = await prisma.goal.findFirst({ where: { id, userId: session.id } })
    if (!goal) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const { title, targetAmount, currentAmount, deadline } = parsed.data
    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...(title !== undefined         && { title: title.trim() }),
        ...(targetAmount !== undefined  && { targetAmount }),
        ...(currentAmount !== undefined && { currentAmount }),
        ...(deadline !== undefined      && { deadline: deadline ? new Date(deadline) : null }),
      },
      select: {
        id: true, title: true, targetAmount: true,
        currentAmount: true, deadline: true, createdAt: true,
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error("[PATCH /api/goals/:id]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/goals/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const { id } = await params
    const goal = await prisma.goal.findFirst({ where: { id, userId: session.id } })
    if (!goal) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    await prisma.goal.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[DELETE /api/goals/:id]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

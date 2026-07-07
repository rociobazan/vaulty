import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

const CreateGoalSchema = z.object({
  title:        z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  deadline:     z.string().datetime().optional().nullable(),
})

// GET /api/goals
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json([], { status: 401 })

    const goals = await prisma.goal.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, title: true, targetAmount: true,
        currentAmount: true, deadline: true, createdAt: true,
      },
    })
    return NextResponse.json(goals)
  } catch (err) {
    console.error("[GET /api/goals]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/goals
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const body = await req.json().catch(() => null)
    console.log("[POST /api/goals] body recibido:", JSON.stringify(body))

    const parsed = CreateGoalSchema.safeParse(body)
    if (!parsed.success) {
      console.error("[POST /api/goals] Zod error:", parsed.error.format())
      return NextResponse.json(
        { error: "Datos inválidos", detail: parsed.error.format() },
        { status: 422 },
      )
    }

    const { title, targetAmount, deadline } = parsed.data
    console.log("[POST /api/goals] Guardando:", { title, targetAmount, deadline, userId: session.id })

    const goal = await prisma.goal.create({
      data: {
        userId: session.id,
        title: title.trim(),
        targetAmount,
        deadline: deadline ? new Date(deadline) : null,
      },
      select: {
        id: true, title: true, targetAmount: true,
        currentAmount: true, deadline: true, createdAt: true,
      },
    })
    return NextResponse.json(goal, { status: 201 })
  } catch (err) {
    console.error("[POST /api/goals] Error completo:", err)
    return NextResponse.json(
      { error: "Error interno", detail: String(err) },
      { status: 500 },
    )
  }
}

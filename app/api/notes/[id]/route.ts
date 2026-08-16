import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title
    if (body.content !== undefined) data.content = body.content
    if (body.color !== undefined) data.color = body.color

    const note = await prisma.note.updateMany({
      where: { id, userId: session.id },
      data,
    })
    return NextResponse.json(note)
  } catch (err) {
    console.error("[notes PUT] error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  const { id } = await params
  try {
    await prisma.note.deleteMany({ where: { id, userId: session.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notes DELETE] error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

const EMPTY_CONTENT = { type: "doc", content: [{ type: "paragraph" }] }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  try {
    const notes = await prisma.note.findMany({
      where: { userId: session.id },
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json(notes)
  } catch (err) {
    console.error("[notes GET] error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json(null, { status: 401 })

  try {
    const { title, content, color } = await req.json()
    const note = await prisma.note.create({
      data: {
        userId: session.id,
        title: title ?? "",
        content: content ?? EMPTY_CONTENT,
        color: color ?? "yellow",
      },
    })
    return NextResponse.json(note)
  } catch (err) {
    console.error("[notes POST] error:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

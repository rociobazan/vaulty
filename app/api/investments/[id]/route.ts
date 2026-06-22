import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Verify the investment belongs to this user before deleting
  const inv = await prisma.investment.findFirst({ where: { id, userId: session.id } })
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.transaction.deleteMany({ where: { investmentId: id } })
  await prisma.priceHistory.deleteMany({ where: { investmentId: id } })
  await prisma.investment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

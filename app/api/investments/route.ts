import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json([], { status: 401 })

  const investments = await prisma.investment.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      cafciId: true,
      name: true,
      ticker: true,
      currency: true,
      currentPrice: true,
      priceDate: true,
      createdAt: true,
    },
  })
  return NextResponse.json(investments)
}

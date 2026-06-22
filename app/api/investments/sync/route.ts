import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { getPricesByIds } from "@/lib/cafci"

export const runtime = "nodejs"

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const investments = await prisma.investment.findMany({
    where: { userId: session.id, cafciId: { not: null } },
    select: { id: true, cafciId: true, currency: true },
  })

  if (investments.length === 0) return NextResponse.json({ updated: 0 })

  const ids = investments.map((i) => i.cafciId!)
  const prices = await getPricesByIds(ids)

  const today = new Date().toISOString().slice(0, 10)

  let updated = 0
  await Promise.all(
    investments.map(async (inv) => {
      const price = prices.get(inv.cafciId!)
      if (!price) return

      await Promise.all([
        prisma.investment.update({
          where: { id: inv.id },
          data: { currentPrice: price.currentPrice, priceDate: price.priceDate },
        }),
        prisma.priceHistory.upsert({
          where: { investmentId_date: { investmentId: inv.id, date: today } },
          create: {
            investmentId: inv.id,
            cafciId: inv.cafciId!,
            currency: inv.currency,
            date: today,
            price: price.currentPrice,
          },
          update: { price: price.currentPrice },
        }),
      ])

      updated++
    }),
  )

  revalidatePath("/")
  return NextResponse.json({ updated })
}

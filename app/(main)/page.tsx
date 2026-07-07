import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { DashboardContent } from "@/components/dashboard-content"
import { PushBell } from "@/components/push-bell"
import type { Fund } from "@/components/tools/balanz-monitor"
import type { TrackedProduct } from "@/components/tools/price-tracker"

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const rawInvestments = await prisma.investment.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "asc" },
  })

  const investmentIds = rawInvestments.map((i) => i.id)

  const [allTransactions, rawProducts] = await Promise.all([
    prisma.transaction.findMany({
      where: { investmentId: { in: investmentIds } },
      orderBy: { date: "asc" },
    }),
    prisma.trackedProduct.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "asc" },
    }),
  ])

  // Group transactions by investmentId
  const txnByInv = new Map<string, typeof allTransactions>()
  for (const txn of allTransactions) {
    if (!txnByInv.has(txn.investmentId)) txnByInv.set(txn.investmentId, [])
    txnByInv.get(txn.investmentId)!.push(txn)
  }

  // Derive Fund summaries from the transaction ledger
  const investments: Fund[] = rawInvestments
    .map((inv) => {
      const txns = txnByInv.get(inv.id) ?? []

      let netCuotapartes = 0
      let totalBuyCost = 0
      let totalBuyQty = 0

      for (const txn of txns) {
        if (txn.type === "BUY") {
          netCuotapartes += txn.cuotapartes
          totalBuyCost += txn.cuotapartes * txn.price
          totalBuyQty += txn.cuotapartes
        } else {
          netCuotapartes -= txn.cuotapartes
        }
      }

      const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : null

      return {
        id: inv.id,
        cafciId: inv.cafciId,
        name: inv.name,
        ticker: inv.ticker,
        currency: inv.currency,
        currentPrice: inv.currentPrice,
        priceDate: inv.priceDate,
        cuotapartes: Math.max(0, netCuotapartes),
        avgBuyPrice,
        transactions: txns.map((t) => ({
          id: t.id,
          type: t.type as "BUY" | "SELL",
          date: t.date,
          cuotapartes: t.cuotapartes,
          price: t.price,
        })),
      }
    })
    .filter((f) => f.transactions.length > 0)

  const products: TrackedProduct[] = rawProducts.map((p) => ({
    id: p.id,
    url: p.url,
    name: p.name,
    store: p.store,
    imageUrl: p.imageUrl,
    price: p.price,
    checked: p.checked,
    collection: p.collection ?? null,
    priceHistory: (p.priceHistory as { date: string; price: number }[] | null) ?? [],
  }))

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground">
            Tu centro de comando financiero
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Planificá cada peso con presupuesto base cero y tomá mejores decisiones de compra.
          </p>
        </div>
        <PushBell />
      </div>
      <DashboardContent initialInvestments={investments} initialProducts={products} />
    </main>
  )
}

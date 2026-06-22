"use client"

import { useEffect, useState } from "react"
import { Wallet, TrendingUp, Bookmark, LayoutList } from "lucide-react"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BudgetTab } from "@/components/budget/budget-tab"
import { InversionesTab, type Fund } from "@/components/tools/balanz-monitor"
import { PriceTrackerTab, type TrackedProduct } from "@/components/tools/price-tracker"
import { TarjetasTab } from "@/components/tools/tarjetas-tab"

interface Props {
  initialInvestments: Fund[]
  initialProducts: TrackedProduct[]
}

export function DashboardContent({ initialInvestments, initialProducts }: Props) {
  const [tab, setTab] = useState("presupuesto")

  // Land on the right tab and confirm when arriving from the price-tracker bookmarklet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get("tab")
    const tracked = params.get("tracked")
    const trackerError = params.get("trackerError")

    if (tabParam) setTab(tabParam)
    if (tracked) toast.success("Producto agregado a tu wishlist.")
    if (trackerError) toast.error(trackerError)

    if (tabParam || tracked || trackerError) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList className="h-auto w-full gap-1 rounded-xl bg-muted p-1.5">
        <TabsTrigger value="presupuesto" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <Wallet className="size-4 shrink-0" />
          <span className="hidden sm:inline">Presupuesto</span>
          <span className="sm:hidden">Ppto.</span>
        </TabsTrigger>
        <TabsTrigger value="inversiones" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <TrendingUp className="size-4 shrink-0" />
          <span className="hidden sm:inline">Inversiones</span>
          <span className="sm:hidden">Inv.</span>
        </TabsTrigger>
        <TabsTrigger value="precios" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <Bookmark className="size-4 shrink-0" />
          <span className="hidden sm:inline">Wishlist</span>
          <span className="sm:hidden">Wish.</span>
        </TabsTrigger>
        <TabsTrigger value="tarjetas" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <LayoutList className="size-4 shrink-0" />
          <span className="hidden sm:inline">Tarjetas</span>
          <span className="sm:hidden">Tarj.</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="presupuesto">
        {tab === "presupuesto" && <BudgetTab />}
      </TabsContent>
      <TabsContent value="inversiones">
        {tab === "inversiones" && <InversionesTab initialFunds={initialInvestments} />}
      </TabsContent>
      <TabsContent value="precios">
        {tab === "precios" && <PriceTrackerTab initialProducts={initialProducts} />}
      </TabsContent>
      <TabsContent value="tarjetas">
        {tab === "tarjetas" && <TarjetasTab />}
      </TabsContent>
    </Tabs>
  )
}

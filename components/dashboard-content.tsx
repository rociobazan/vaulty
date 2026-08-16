"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Wallet, TrendingUp, LayoutList, PiggyBank, NotebookPen, Loader2 } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BudgetTab } from "@/components/budget/budget-tab"
import { InversionesTab, type Fund } from "@/components/tools/balanz-monitor"
import { TarjetasTab } from "@/components/tools/tarjetas-tab"
import { GoalsTab } from "@/components/tools/goals-tab"

// Tiptap accede a APIs del DOM — cargarlo solo en el cliente evita errores de SSR
const NotesTab = dynamic(
  () => import("@/components/tools/notes-tab").then((m) => ({ default: m.NotesTab })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

interface Props {
  initialInvestments: Fund[]
}

export function DashboardContent({ initialInvestments }: Props) {
  const [tab, setTab] = useState("presupuesto")

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
        <TabsTrigger value="notas" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <NotebookPen className="size-4 shrink-0" />
          <span className="hidden sm:inline">Notas</span>
          <span className="sm:hidden">Notas</span>
        </TabsTrigger>
        <TabsTrigger value="tarjetas" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <LayoutList className="size-4 shrink-0" />
          <span className="hidden sm:inline">Tarjetas</span>
          <span className="sm:hidden">Tarj.</span>
        </TabsTrigger>
        <TabsTrigger value="objetivos" className="flex-1 gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm">
          <PiggyBank className="size-4 shrink-0" />
          <span className="hidden sm:inline">Objetivos</span>
          <span className="sm:hidden">Obj.</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="presupuesto">
        {tab === "presupuesto" && <BudgetTab />}
      </TabsContent>
      <TabsContent value="inversiones">
        {tab === "inversiones" && <InversionesTab initialFunds={initialInvestments} />}
      </TabsContent>
      <TabsContent value="notas">
        {tab === "notas" && <NotesTab />}
      </TabsContent>
      <TabsContent value="tarjetas">
        {tab === "tarjetas" && <TarjetasTab />}
      </TabsContent>
      <TabsContent value="objetivos">
        {tab === "objetivos" && <GoalsTab />}
      </TabsContent>
    </Tabs>
  )
}

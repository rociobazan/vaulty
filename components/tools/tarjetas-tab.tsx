"use client"

import { useEffect, useState } from "react"
import {
  CreditCard,
  RefreshCw,
  CalendarDays,
  Plus,
  Sparkles,
  Trash2,
  X,
  Pencil,
  Check,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatARS } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { MoneyInput } from "@/components/money-input"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Purchase {
  id: string
  concept: string
  quotaCurrent: number
  quotaTotal: number
  amount: number
}

interface CreditCardEntry {
  id: string
  name: string
  purchases: Purchase[]
}

interface SimulatedPurchase {
  id: string
  concept: string
  amount: number         // siempre por cuota
  quotaTotal: number
  startMonthOffset: number  // 0 = mes actual, 1 = próximo mes, etc.
}

interface BreakdownItem {
  cardName: string
  concept: string
  quotaLabel: string
  amount: number
  isSimulated: boolean
}

interface ProjectionPoint {
  monthKey: string
  label: string
  real: number
  simulated: number
  total: number
  breakdown: BreakdownItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function addMonths(monthKey: string, offset: number): string {
  const [y, m] = monthKey.split("-").map(Number)
  const d = new Date(y, m - 1 + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return `${MONTHS_ES[m - 1]} ${y}`
}

// Acepta {quotaCurrent, quotaTotal} numérico O la cadena "2/6" / "2 / 6"
function normalizePurchase(p: Record<string, unknown>): Purchase {
  if (typeof p.quotaCurrent === "number" && typeof p.quotaTotal === "number") {
    return p as unknown as Purchase
  }
  const raw = String(p.quota ?? "1/1").replace(/\s/g, "")
  const [a, b] = raw.split("/")
  const cur = parseInt(a, 10)
  const total = parseInt(b, 10)
  return {
    id: String(p.id ?? ""),
    concept: String(p.concept ?? ""),
    quotaCurrent: isNaN(cur) ? 1 : cur,
    quotaTotal: isNaN(total) ? 1 : total,
    amount: Number(p.amount ?? 0),
  }
}

// Algoritmo de proyección al vuelo — sin tocar la DB
function buildProjection(
  cards: CreditCardEntry[],
  simPurchases: SimulatedPurchase[],
  startKey: string,
  actualMonthCards: Record<string, CreditCardEntry[]>,
): ProjectionPoint[] {
  return Array.from({ length: 12 }, (_, k) => {
    const key = addMonths(startKey, k)
    const breakdown: BreakdownItem[] = []
    let real = 0
    let simulated = 0

    // Si hay datos reales para este mes, usarlos directamente
    const sourceCards = key in actualMonthCards ? actualMonthCards[key] : k === 0 ? cards : null

    if (sourceCards !== null) {
      for (const card of sourceCards) {
        for (const p of card.purchases) {
          breakdown.push({
            cardName: card.name,
            concept: p.concept,
            quotaLabel: `${p.quotaCurrent}/${p.quotaTotal}`,
            amount: p.amount,
            isSimulated: false,
          })
          real += p.amount
        }
      }
    } else {
      // Proyección desde el mes actual para meses sin datos en DB
      for (const card of cards) {
        for (const p of card.purchases) {
          const monthQuota = p.quotaCurrent + k
          if (monthQuota <= p.quotaTotal) {
            breakdown.push({
              cardName: card.name,
              concept: p.concept,
              quotaLabel: `${monthQuota}/${p.quotaTotal}`,
              amount: p.amount,
              isSimulated: false,
            })
            real += p.amount
          }
        }
      }
    }

    // Simulaciones: arrancan en el mes elegido (startMonthOffset)
    for (const sp of simPurchases) {
      const relativeK = k - sp.startMonthOffset
      const monthQuota = 1 + relativeK
      if (relativeK >= 0 && monthQuota <= sp.quotaTotal) {
        breakdown.push({
          cardName: "Simulación",
          concept: sp.concept,
          quotaLabel: `${monthQuota}/${sp.quotaTotal}`,
          amount: sp.amount,
          isSimulated: true,
        })
        simulated += sp.amount
      }
    }

    return { monthKey: key, label: monthLabel(key), real, simulated, total: real + simulated, breakdown }
  })
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ProjectionTooltip({
  active,
  payload,
  label,
  projection,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
  label?: string
  projection: ProjectionPoint[]
}) {
  if (!active || !payload?.length) return null
  const point = projection.find((p) => p.label === label)
  if (!point || point.total === 0) return null

  return (
    <div className="max-w-xs rounded-lg border bg-popover p-3 shadow-md">
      <p className="mb-1 text-sm font-semibold text-foreground">{label}</p>
      <p className="mb-2 text-base font-bold text-primary">{formatARS(point.total)}</p>
      {point.real > 0 && point.simulated > 0 && (
        <div className="mb-2 flex gap-4 text-xs">
          <span className="text-muted-foreground">Real: {formatARS(point.real)}</span>
          <span className="text-amber-500">Simulado: {formatARS(point.simulated)}</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {point.breakdown.map((item, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start justify-between gap-3 text-xs",
              item.isSimulated ? "text-amber-600" : "text-muted-foreground",
            )}
          >
            <span>
              {item.concept}
              <span className="opacity-60"> ({item.quotaLabel})</span>
              {item.isSimulated && <span className="ml-1 opacity-70">· Sim</span>}
            </span>
            <span className="shrink-0 tabular-nums">{formatARS(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TarjetasTab ─────────────────────────────────────────────────────────────

type AmountMode = "cuota" | "total"

export function TarjetasTab() {
  const [cards, setCards] = useState<CreditCardEntry[]>([])
  const [allMonthCards, setAllMonthCards] = useState<Record<string, CreditCardEntry[]>>({})
  const [loading, setLoading] = useState(true)

  // Estado local del simulador — nunca va a la DB
  const [simPurchases, setSimPurchases] = useState<SimulatedPurchase[]>([])
  const [showSimForm, setShowSimForm] = useState(false)
  const [simConcept, setSimConcept] = useState("")
  const [simRawAmount, setSimRawAmount] = useState(0)
  const [simAmountMode, setSimAmountMode] = useState<AmountMode>("cuota")
  const [simQuotaTotal, setSimQuotaTotal] = useState(12)
  const [simStartOffset, setSimStartOffset] = useState(0)

  // Estado de edición inline
  const [editingSimId, setEditingSimId] = useState<string | null>(null)
  const [editConcept, setEditConcept] = useState("")
  const [editRawAmount, setEditRawAmount] = useState(0)
  const [editAmountMode, setEditAmountMode] = useState<AmountMode>("cuota")
  const [editQuotaTotal, setEditQuotaTotal] = useState(12)
  const [editStartOffset, setEditStartOffset] = useState(0)

  const startKey = getCurrentMonthKey()
  const mounted = useMounted()

  async function fetchData() {
    setLoading(true)
    try {
      const monthKeys = Array.from({ length: 12 }, (_, k) => addMonths(startKey, k))
      const results = await Promise.all(
        monthKeys.map((key) => fetch(`/api/budget/${key}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
      )

      const monthCardsMap: Record<string, CreditCardEntry[]> = {}
      results.forEach((data, k) => {
        if (!data) return
        const rawCards = (data.creditCards ?? []) as Record<string, unknown>[]
        monthCardsMap[monthKeys[k]] = rawCards.map((card) => ({
          ...(card as unknown as CreditCardEntry),
          purchases: ((card.purchases as Record<string, unknown>[]) ?? []).map(normalizePurchase),
        }))
      })

      setCards(monthCardsMap[startKey] ?? [])
      setAllMonthCards(monthCardsMap)
    } catch {
      setCards([])
      setAllMonthCards({})
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Montos derivados (add form y edit form)
  const safeQuotaTotal = Math.max(1, simQuotaTotal)
  const simPerQuota =
    simAmountMode === "cuota"
      ? simRawAmount
      : Math.round(simRawAmount / safeQuotaTotal)

  const safeEditQuotaTotal = Math.max(1, editQuotaTotal)
  const editPerQuota =
    editAmountMode === "cuota"
      ? editRawAmount
      : Math.round(editRawAmount / safeEditQuotaTotal)

  function startEditSim(sp: SimulatedPurchase) {
    setEditingSimId(sp.id)
    setEditConcept(sp.concept)
    setEditRawAmount(sp.amount)
    setEditAmountMode("cuota")
    setEditQuotaTotal(sp.quotaTotal)
    setEditStartOffset(sp.startMonthOffset)
    setShowSimForm(false)
  }

  function saveEditSim() {
    if (!editingSimId || !editConcept.trim() || editPerQuota <= 0) return
    setSimPurchases((prev) =>
      prev.map((s) =>
        s.id === editingSimId
          ? {
              ...s,
              concept: editConcept.trim(),
              amount: editPerQuota,
              quotaTotal: safeEditQuotaTotal,
              startMonthOffset: editStartOffset,
            }
          : s,
      ),
    )
    setEditingSimId(null)
  }

  function cancelEditSim() {
    setEditingSimId(null)
  }

  function addSimulation() {
    if (!simConcept.trim() || simPerQuota <= 0 || safeQuotaTotal < 1) return
    setSimPurchases((prev) => [
      ...prev,
      {
        id: genId(),
        concept: simConcept.trim(),
        amount: simPerQuota,
        quotaTotal: safeQuotaTotal,
        startMonthOffset: simStartOffset,
      },
    ])
    setSimConcept("")
    setSimRawAmount(0)
    setSimQuotaTotal(12)
    setSimStartOffset(0)
    setShowSimForm(false)
  }

  // Proyección calculada on-the-fly
  const projection = buildProjection(cards, simPurchases, startKey, allMonthCards)
  const hasSims = simPurchases.length > 0
  const hasData = projection.some((p) => p.total > 0)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Tarjetas y Cuotas</h2>
          <p className="text-sm text-muted-foreground">
            Proyección de vencimientos · Próximos 12 meses
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchData()}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* ── Simulador de consumos ── */}
      <Card
        className={cn(
          "border-dashed transition-colors",
          hasSims && "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20",
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Simulador de consumos
              {hasSims && (
                <Badge className="border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {simPurchases.length} activa{simPurchases.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-2">
              {hasSims && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setSimPurchases([])}
                >
                  <Trash2 className="mr-1 size-3" />
                  Limpiar todo
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowSimForm((v) => !v)}
              >
                {showSimForm ? (
                  <><X className="mr-1 size-3" />Cerrar</>
                ) : (
                  <><Plus className="mr-1 size-3" />Simular compra</>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {(showSimForm || hasSims) && (
          <CardContent className="flex flex-col gap-4 pt-0">

            {/* Formulario */}
            {showSimForm && (
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-amber-300 bg-white/60 p-3 dark:bg-black/10">

                {/* Fila 1: Concepto + Primera cuota en */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Concepto</Label>
                    <Input
                      placeholder="ej. TV 55&quot;"
                      value={simConcept}
                      onChange={(e) => setSimConcept(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") addSimulation() }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Primera cuota en</Label>
                    <select
                      value={simStartOffset}
                      onChange={(e) => setSimStartOffset(parseInt(e.target.value))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {projection.map((p, i) => (
                        <option key={p.monthKey} value={i}>
                          {i === 0 ? `${p.label} (este mes)` : p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fila 2: Monto (con toggle de modo) + N° de cuotas */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    {/* Label + toggle de modo en la misma línea */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Monto</Label>
                      <div className="flex overflow-hidden rounded-md border border-input text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSimAmountMode("cuota")}
                          className={cn(
                            "px-2 py-0.5 transition-colors",
                            simAmountMode === "cuota"
                              ? "bg-amber-500 text-white"
                              : "bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          × cuota
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimAmountMode("total")}
                          className={cn(
                            "px-2 py-0.5 transition-colors",
                            simAmountMode === "total"
                              ? "bg-amber-500 text-white"
                              : "bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          total
                        </button>
                      </div>
                    </div>
                    <MoneyInput value={simRawAmount} onChange={setSimRawAmount} />
                    {/* Valor derivado */}
                    {simRawAmount > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {simAmountMode === "total"
                          ? `≈ ${formatARS(simPerQuota)} por cuota`
                          : `= ${formatARS(simRawAmount * safeQuotaTotal)} total`}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Cantidad de cuotas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={simQuotaTotal}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v)) setSimQuotaTotal(v)
                      }}
                      onBlur={() => setSimQuotaTotal((v) => Math.max(1, v))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  className="h-8 self-end bg-amber-500 text-white hover:bg-amber-600"
                  onClick={addSimulation}
                  disabled={!simConcept.trim() || simRawAmount <= 0}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Agregar al proyector
                </Button>
              </div>
            )}

            {/* Lista de simulaciones activas */}
            {hasSims && (
              <div className="flex flex-col gap-2">
                {simPurchases.map((sp) => {
                  const isEditing = editingSimId === sp.id

                  if (isEditing) {
                    return (
                      <div
                        key={sp.id}
                        className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-white/80 p-3 dark:bg-black/10"
                      >
                        {/* Fila 1: Concepto + Primera cuota en */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Concepto</Label>
                            <Input
                              value={editConcept}
                              onChange={(e) => setEditConcept(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditSim()
                                if (e.key === "Escape") cancelEditSim()
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Primera cuota en</Label>
                            <select
                              value={editStartOffset}
                              onChange={(e) => setEditStartOffset(parseInt(e.target.value))}
                              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              {projection.map((p, i) => (
                                <option key={p.monthKey} value={i}>
                                  {i === 0 ? `${p.label} (este mes)` : p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Fila 2: Monto + N° cuotas */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">Monto</Label>
                              <div className="flex overflow-hidden rounded-md border border-input text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => setEditAmountMode("cuota")}
                                  className={cn(
                                    "px-2 py-0.5 transition-colors",
                                    editAmountMode === "cuota"
                                      ? "bg-amber-500 text-white"
                                      : "bg-background text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  × cuota
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditAmountMode("total")}
                                  className={cn(
                                    "px-2 py-0.5 transition-colors",
                                    editAmountMode === "total"
                                      ? "bg-amber-500 text-white"
                                      : "bg-background text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  total
                                </button>
                              </div>
                            </div>
                            <MoneyInput value={editRawAmount} onChange={setEditRawAmount} />
                            {editRawAmount > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                {editAmountMode === "total"
                                  ? `≈ ${formatARS(editPerQuota)} por cuota`
                                  : `= ${formatARS(editRawAmount * safeEditQuotaTotal)} total`}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs text-muted-foreground">Cantidad de cuotas</Label>
                            <Input
                              type="number"
                              min={1}
                              max={60}
                              value={editQuotaTotal}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v)) setEditQuotaTotal(v)
                              }}
                              onBlur={() => setEditQuotaTotal((v) => Math.max(1, v))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={cancelEditSim}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600"
                            onClick={saveEditSim}
                            disabled={!editConcept.trim() || editRawAmount <= 0}
                          >
                            <Check className="mr-1 size-3" />
                            Guardar
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {sp.concept}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatARS(sp.amount)} × {sp.quotaTotal} cuotas ·{" "}
                          total {formatARS(sp.amount * sp.quotaTotal)}
                          {sp.startMonthOffset > 0 && (
                            <> · desde {projection[sp.startMonthOffset]?.label ?? ""}</>
                          )}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-amber-600"
                          onClick={() => startEditSim(sp)}
                          aria-label="Editar simulación"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setSimPurchases((prev) => prev.filter((s) => s.id !== sp.id))
                          }
                          aria-label="Eliminar simulación"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Gráfico ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Compromisos futuros
            </span>
            {hasSims && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-sm"
                    style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }}
                  />
                  Deuda real
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-amber-400" />
                  Simulación
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Cargando datos del presupuesto...
            </div>
          )}

          {!loading && !hasData && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <CreditCard className="size-10 opacity-25" />
              <p className="text-center">
                No hay tarjetas cargadas en el Presupuesto.
                <br />
                Agregá consumos en cuotas en <strong>Presupuesto</strong>, o usá el
                simulador de arriba.
              </p>
            </div>
          )}

          {!loading && hasData && mounted && (
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <BarChart
                data={projection}
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.25)]}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? `$${(v / 1_000_000).toFixed(1)}M`
                      : `$${(v / 1_000).toFixed(0)}k`
                  }
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ProjectionTooltip
                      active={active}
                      payload={payload as unknown as { name: string; value: number }[]}
                      label={label as string}
                      projection={projection}
                    />
                  )}
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                />
                <Bar dataKey="real" name="Deuda real" stackId="a" fill="oklch(0.696 0.17 162.48)" maxBarSize={52} />
                <Bar dataKey="simulated" name="Simulación" stackId="a" fill="rgb(251 191 36)" maxBarSize={52} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Detalle mensual ── */}
      {!loading && hasData && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground">Detalle por mes</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projection
              .filter((p) => p.breakdown.length > 0)
              .map((point) => (
                <Card key={point.monthKey} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between bg-muted/40 px-4 py-3">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {point.label}
                    </CardTitle>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-bold tabular-nums text-primary">
                        {formatARS(point.total)}
                      </span>
                      {point.simulated > 0 && (
                        <span className="text-xs tabular-nums text-amber-500">
                          +{formatARS(point.simulated)} sim.
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-2">
                    <div className="flex flex-col divide-y divide-border">
                      {point.breakdown.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 py-2">
                          <div className="flex min-w-0 flex-col">
                            <span
                              className={cn(
                                "truncate text-sm font-medium",
                                item.isSimulated ? "text-amber-600" : "text-foreground",
                              )}
                            >
                              {item.concept}
                              {item.isSimulated && (
                                <span className="ml-1.5 text-xs font-normal opacity-70">(Sim.)</span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.cardName} · cuota {item.quotaLabel}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm tabular-nums text-foreground">
                            {formatARS(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

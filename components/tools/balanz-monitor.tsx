"use client"

import React, { useState, useEffect, useTransition, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Loader2,
  Search,
  RefreshCw,
  X,
  ChevronUp,
  Receipt,
  Pencil,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatARS } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { type IpcPoint } from "@/lib/ipc"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createFundWithTransaction,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteInvestment,
} from "@/app/actions/investments"
import type { CafciFund } from "@/lib/cafci"
import type { HistoryPoint } from "@/app/api/investments/history/route"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FundTransaction {
  id: string
  type: "BUY" | "SELL"
  date: string        // YYYY-MM-DD
  cuotapartes: number
  price: number       // per cuotaparte at time of operation
}

export interface Fund {
  id: string
  cafciId: number | null
  name: string
  ticker: string
  currency: string        // "ARS" | "USD"
  currentPrice: number
  priceDate: string | null
  // Derived from transaction ledger (computed server-side)
  cuotapartes: number         // net position (BUY - SELL)
  avgBuyPrice: number | null  // weighted avg cost basis
  transactions: FundTransaction[]
}

interface TxnModal {
  open: boolean
  targetInvestmentId: string | null  // null = new fund; string = add to existing
  editingTransactionId: string | null  // set = editing an existing transaction
  // Fund metadata (for new fund flow)
  cafciId: number | null
  fundName: string
  fundTicker: string
  fundCurrency: string
  fundCurrentPrice: number | null
  fundPriceDate: string
  // Set when a CAFCI search match is actually an already-tracked fund
  duplicateFundId: string | null
  // Transaction details
  type: "BUY" | "SELL"
  date: string
  cuotapartes: string
  price: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const EMPTY_MODAL: TxnModal = {
  open: false,
  targetInvestmentId: null,
  editingTransactionId: null,
  cafciId: null,
  fundName: "",
  fundTicker: "",
  fundCurrency: "ARS",
  fundCurrentPrice: null,
  fundPriceDate: "",
  duplicateFundId: null,
  type: "BUY",
  date: today,
  cuotapartes: "",
  price: "",
}

const SKIP_WORDS = new Set([
  "de", "la", "el", "los", "las", "del", "a", "y", "en", "con", "fondo", "clase",
])

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCuotas = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtUSDAmount = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtUSDPrice = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

function formatValue(value: number, currency: string, decimals = false): string {
  if (currency === "USD") {
    return `U$D ${decimals ? fmtUSDPrice.format(value) : fmtUSDAmount.format(value)}`
  }
  return formatARS(value, decimals)
}

function autoTicker(name: string): string {
  const words = name
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !SKIP_WORDS.has(w.toLowerCase()))
  return words
    .slice(0, 3)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 8)
}

// ── FundSearchInput ────────────────────────────────────────────────────────────

interface FundSearchInputProps {
  onSelect: (fund: CafciFund) => void
  disabled?: boolean
}

function FundSearchInput({ onSelect, disabled }: FundSearchInputProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CafciFund[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/cafci/search?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data: CafciFund[] = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }, 400)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(fund: CafciFund) {
    setQuery(fund.name)
    setOpen(false)
    setResults([])
    onSelect(fund)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar fondo… ej: Balanz Capital"
          disabled={disabled}
          className="pl-9 pr-8"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {results.map((fund) => (
            <button
              key={fund.cafciId}
              type="button"
              onClick={() => handleSelect(fund)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="font-medium leading-snug">{fund.name}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{fund.gestora}</span>
                <span>·</span>
                <span className={cn("tabular-nums font-medium", fund.currency === "USD" ? "text-amber-600" : "text-primary")}>
                  {fund.currency === "USD"
                    ? `U$D ${fmtUSDPrice.format(fund.currentPrice)}`
                    : formatARS(fund.currentPrice, true)}
                </span>
                <Badge
                  variant="outline"
                  className={cn("text-[9px] py-0 h-4", fund.currency === "USD" ? "border-amber-300 text-amber-700" : "")}
                >
                  {fund.currency}
                </Badge>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialFunds: Fund[]
}

export function InversionesTab({ initialFunds }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [funds, setFunds] = useState<Fund[]>(initialFunds)
  const [modal, setModal] = useState<TxnModal>(EMPTY_MODAL)
  const [syncing, setSyncing] = useState(false)
  const [chartCurrency, setChartCurrency] = useState<"ARS" | "USD">("ARS")
  const [chartMode, setChartMode] = useState<"evolucion" | "vs-ipc">("evolucion")
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [ipcData, setIpcData] = useState<IpcPoint[]>([])
  const [ipcLoading, setIpcLoading] = useState(false)
  const [syncCount, setSyncCount] = useState(0)
  const [expandedFundId, setExpandedFundId] = useState<string | null>(null)
  const [chartRange, setChartRange] = useState<"3m" | "6m" | "1y" | "all">("all")
  const mounted = useMounted()

  useEffect(() => { setFunds(initialFunds) }, [initialFunds])

  // Fetch real price history whenever a sync completes
  useEffect(() => {
    setHistoryLoading(true)
    fetch("/api/investments/history")
      .then((r) => r.json())
      .then((data: HistoryPoint[]) => setHistoryData(data))
      .catch(console.error)
      .finally(() => setHistoryLoading(false))
  }, [syncCount])

  // Lazy-fetch IPC data the first time the user switches to "vs IPC" mode
  useEffect(() => {
    if (chartMode !== "vs-ipc" || ipcData.length > 0) return
    setIpcLoading(true)
    fetch("/api/ipc")
      .then((r) => r.json())
      .then((data: IpcPoint[]) => setIpcData(data))
      .catch(console.error)
      .finally(() => setIpcLoading(false))
  }, [chartMode, ipcData.length])

  function doSync() {
    setSyncing(true)
    fetch("/api/investments/sync", { method: "POST" })
      .then(() => {
        setSyncCount((c) => c + 1)
        router.refresh()
      })
      .catch(console.error)
      .finally(() => setSyncing(false))
  }

  // Auto-sync on mount if any funds are CAFCI-linked
  useEffect(() => {
    if (!initialFunds.some((f) => f.cafciId != null)) {
      setHistoryLoading(true)
      fetch("/api/investments/history")
        .then((r) => r.json())
        .then((data: HistoryPoint[]) => setHistoryData(data))
        .catch(console.error)
        .finally(() => setHistoryLoading(false))
      return
    }
    doSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived per-currency totals ──────────────────────────────────────────

  const arsFunds = funds.filter((f) => f.currency !== "USD")
  const usdFunds = funds.filter((f) => f.currency === "USD")

  const arsTotal = arsFunds.reduce((s, f) => s + f.cuotapartes * f.currentPrice, 0)
  const usdTotal = usdFunds.reduce((s, f) => s + f.cuotapartes * f.currentPrice, 0)
  const arsCuotapartes = arsFunds.reduce((s, f) => s + f.cuotapartes, 0)
  const usdCuotapartes = usdFunds.reduce((s, f) => s + f.cuotapartes, 0)

  const arsPnL = arsFunds
    .filter((f) => f.avgBuyPrice != null)
    .reduce((s, f) => s + f.cuotapartes * (f.currentPrice - f.avgBuyPrice!), 0)
  const usdPnL = usdFunds
    .filter((f) => f.avgBuyPrice != null)
    .reduce((s, f) => s + f.cuotapartes * (f.currentPrice - f.avgBuyPrice!), 0)

  const hasArsPnL = arsFunds.some((f) => f.avgBuyPrice != null)
  const hasUsdPnL = usdFunds.some((f) => f.avgBuyPrice != null)
  const hasArs = arsFunds.length > 0
  const hasUsd = usdFunds.length > 0

  // Weighted portfolio % return per currency (for footer)
  const arsWithCost = arsFunds.filter((f) => f.avgBuyPrice != null)
  const arsCostTotal = arsWithCost.reduce((s, f) => s + f.cuotapartes * f.avgBuyPrice!, 0)
  const arsCurrTotal = arsWithCost.reduce((s, f) => s + f.cuotapartes * f.currentPrice, 0)
  const arsReturn = arsCostTotal > 0 ? ((arsCurrTotal / arsCostTotal) - 1) * 100 : null

  const usdWithCost = usdFunds.filter((f) => f.avgBuyPrice != null)
  const usdCostTotal = usdWithCost.reduce((s, f) => s + f.cuotapartes * f.avgBuyPrice!, 0)
  const usdCurrTotal = usdWithCost.reduce((s, f) => s + f.cuotapartes * f.currentPrice, 0)
  const usdReturn = usdCostTotal > 0 ? ((usdCurrTotal / usdCostTotal) - 1) * 100 : null

  // ── Range filter ─────────────────────────────────────────────────────────

  const rangeStart: string = (() => {
    if (chartRange === "all") return ""
    const d = new Date()
    if (chartRange === "3m") d.setMonth(d.getMonth() - 3)
    else if (chartRange === "6m") d.setMonth(d.getMonth() - 6)
    else d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  })()

  const filteredHistoryData = chartRange === "all"
    ? historyData
    : historyData.filter((h) => h.date >= rangeStart)

  // ── Chart data ───────────────────────────────────────────────────────────

  const chartPoints = filteredHistoryData
    .map((h) => ({ label: h.label, valor: chartCurrency === "ARS" ? h.arsValue : h.usdValue }))
    .filter((p) => p.valor > 0)

  // Spread of real data values — used to decide how many decimals the Y axis shows
  const chartValues = chartPoints.map((p) => p.valor)
  const chartSpread = chartValues.length >= 2
    ? Math.max(...chartValues) - Math.min(...chartValues)
    : 0

  // Pad chart data with null entries for every calendar day in the selected window.
  // This forces the X axis to span the full range even when real data is sparse.
  const paddedChartPoints: { label: string; valor: number | null }[] = (() => {
    if (chartRange === "all") return chartPoints
    const byDate = new Map(
      filteredHistoryData
        .filter((h) => (chartCurrency === "ARS" ? h.arsValue : h.usdValue) > 0)
        .map((h) => [h.date, chartCurrency === "ARS" ? h.arsValue : h.usdValue] as [string, number]),
    )
    const start = new Date(rangeStart + "T00:00:00")
    const end = new Date(today + "T00:00:00")
    const result: { label: string; valor: number | null }[] = []
    const cur = new Date(start)
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10)
      const label = `${cur.getDate()} ${MONTHS_ES[cur.getMonth()]}`
      result.push({ label, valor: byDate.get(dateStr) ?? null })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  })()

  // ── Normalized "vs IPC" series — both rebased to 100 at first point of selected range ─

  function ipcForDate(date: string): number | null {
    let result: number | null = null
    for (const p of ipcData) {
      if (p.date <= date) result = p.index
      else break
    }
    return result
  }

  const lastIpcMonth = ipcData[ipcData.length - 1]?.date.slice(0, 7) ?? ""

  // Extrapolate IPC beyond the last published month using the last known monthly rate.
  // Projects from the 1st of the month AFTER the last IPC publication so the transition
  // is seamless — the projected line starts exactly where the real line ends.
  function projectedIpcForDate(date: string): number | null {
    if (ipcData.length < 2 || !lastIpcMonth) return null
    const lastIpc = ipcData[ipcData.length - 1]
    const prevIpc = ipcData[ipcData.length - 2]
    const monthlyRate = lastIpc.index / prevIpc.index - 1
    const [y, m] = lastIpcMonth.split("-").map(Number)
    const projAnchor = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`
    const msPerDay = 24 * 60 * 60 * 1000
    const days = (Date.parse(date) - Date.parse(projAnchor)) / msPerDay
    if (days < 0) return null
    return lastIpc.index * Math.pow(1 + monthlyRate, days / 30)
  }

  const arsHistoryPoints = filteredHistoryData.filter((h) => h.arsValue > 0)

  const normalizedPoints: {
    label: string
    portafolio: number
    ipc: number | null
    ipcProjected: number | null
  }[] = (() => {
    if (arsHistoryPoints.length < 2 || ipcData.length === 0) return []

    const basePortfolio = arsHistoryPoints[0].arsValue
    const baseDate = arsHistoryPoints[0].date

    // If the portfolio starts in the projected period, anchor the IPC base to the
    // projected value at that exact date (so both lines start at 100).
    const baseInProjected = baseDate.slice(0, 7) > lastIpcMonth
    const baseIpc = baseInProjected
      ? (projectedIpcForDate(baseDate) ?? ipcForDate(baseDate))
      : ipcForDate(baseDate)
    if (!baseIpc) return []

    // Index of last point with real IPC data — used to connect the two line segments.
    const lastRealIdx = arsHistoryPoints.reduce<number>(
      (acc, h, i) => (h.date.slice(0, 7) <= lastIpcMonth ? i : acc),
      -1,
    )

    return arsHistoryPoints.map((h, i) => {
      const portafolio = (h.arsValue / basePortfolio) * 100
      const ipcKnown = h.date.slice(0, 7) <= lastIpcMonth

      let ipc: number | null = null
      let ipcProjected: number | null = null

      if (ipcKnown) {
        const val = ipcForDate(h.date)
        ipc = val != null ? (val / baseIpc) * 100 : null
        // Seed the projected segment at the last real point so the dashed line
        // starts exactly where the solid line ends (no visual gap).
        if (i === lastRealIdx) ipcProjected = ipc
      } else {
        const val = projectedIpcForDate(h.date)
        ipcProjected = val != null ? (val / baseIpc) * 100 : null
      }

      return { label: h.label, portafolio, ipc, ipcProjected }
    })
  })()

  // ── Form handlers ────────────────────────────────────────────────────────

  function openNewFund() {
    setModal({ ...EMPTY_MODAL, open: true, date: new Date().toISOString().slice(0, 10) })
  }

  function openAddToFund(fund: Fund) {
    setModal({
      ...EMPTY_MODAL,
      open: true,
      targetInvestmentId: fund.id,
      fundName: fund.name,
      fundCurrency: fund.currency,
      fundCurrentPrice: fund.currentPrice,
      date: new Date().toISOString().slice(0, 10),
      price: String(fund.currentPrice),
    })
  }

  function handleCafciSelect(cafci: CafciFund) {
    const existing = funds.find((f) => f.cafciId === cafci.cafciId)
    setModal((m) => ({
      ...m,
      cafciId: cafci.cafciId,
      fundName: existing?.name ?? cafci.name,
      fundTicker: existing?.ticker ?? autoTicker(cafci.name),
      fundCurrency: existing?.currency ?? cafci.currency,
      fundCurrentPrice: cafci.currentPrice,
      fundPriceDate: cafci.priceDate,
      duplicateFundId: existing?.id ?? null,
      price: String(cafci.currentPrice),
    }))
  }

  function openEditTransaction(fund: Fund, txn: FundTransaction) {
    setModal({
      ...EMPTY_MODAL,
      open: true,
      targetInvestmentId: fund.id,
      editingTransactionId: txn.id,
      fundName: fund.name,
      fundCurrency: fund.currency,
      fundCurrentPrice: fund.currentPrice,
      type: txn.type,
      date: txn.date,
      cuotapartes: String(txn.cuotapartes),
      price: String(txn.price),
    })
  }

  function saveTxn() {
    const cuotapartes = parseFloat(modal.cuotapartes)
    const price = parseFloat(modal.price)
    if (isNaN(cuotapartes) || cuotapartes <= 0) return
    if (isNaN(price) || price <= 0) return
    if (!modal.date) return
    if (!modal.targetInvestmentId && !modal.cafciId) return

    const txnPayload = {
      type: modal.type,
      date: modal.date,
      cuotapartes,
      price,
    }

    startTransition(async () => {
      if (modal.editingTransactionId) {
        await updateTransaction(modal.editingTransactionId, txnPayload)
      } else if (modal.targetInvestmentId) {
        await addTransaction(modal.targetInvestmentId, txnPayload)
      } else if (modal.duplicateFundId) {
        await addTransaction(modal.duplicateFundId, txnPayload)
      } else {
        await createFundWithTransaction(
          {
            cafciId: modal.cafciId,
            name: modal.fundName,
            ticker: modal.fundTicker || autoTicker(modal.fundName),
            currency: modal.fundCurrency,
            currentPrice: modal.fundCurrentPrice ?? price,
            priceDate: modal.fundPriceDate || null,
          },
          txnPayload,
        )
      }
      setModal({ ...EMPTY_MODAL })
      router.refresh()
    })
  }

  function handleDeleteTransaction(id: string) {
    startTransition(async () => {
      await deleteTransaction(id)
      router.refresh()
    })
  }

  function handleDeleteFund(id: string) {
    const snapshot = funds
    setFunds((prev) => prev.filter((f) => f.id !== id))
    if (expandedFundId === id) setExpandedFundId(null)
    startTransition(async () => {
      try {
        await deleteInvestment(id)
        router.refresh()
      } catch {
        setFunds(snapshot)
      }
    })
  }

  // Target fund when adding to existing
  const targetFund = modal.targetInvestmentId
    ? funds.find((f) => f.id === modal.targetInvestmentId)
    : null

  const modalCurrency = targetFund?.currency ?? modal.fundCurrency
  const txnTotal =
    parseFloat(modal.cuotapartes) > 0 && parseFloat(modal.price) > 0
      ? parseFloat(modal.cuotapartes) * parseFloat(modal.price)
      : null

  const canSave =
    !!modal.date &&
    parseFloat(modal.cuotapartes) > 0 &&
    parseFloat(modal.price) > 0 &&
    (!!modal.targetInvestmentId || !!modal.cafciId)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="flex flex-wrap gap-6">

          {/* ARS total */}
          {(hasArs || (!hasArs && !hasUsd)) && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total en Pesos · ARS
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-primary">
                {formatARS(Math.round(arsTotal))}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hasArsPnL && (
                  <Badge
                    className={cn(
                      "gap-1 text-xs",
                      arsPnL >= 0
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/10",
                    )}
                  >
                    {arsPnL >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {arsPnL >= 0 ? "+" : ""}
                    {formatARS(Math.round(Math.abs(arsPnL)))}
                  </Badge>
                )}
                {hasArs && (
                  <span className="text-xs text-muted-foreground">
                    {fmtCuotas.format(arsCuotapartes)} CP · {arsFunds.length} fondo{arsFunds.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {hasArs && hasUsd && (
            <div className="hidden w-px self-stretch bg-border sm:block" />
          )}

          {/* USD total */}
          {hasUsd && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total en Dólares · USD
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-amber-600">
                {formatValue(usdTotal, "USD")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hasUsdPnL && (
                  <Badge
                    className={cn(
                      "gap-1 text-xs",
                      usdPnL >= 0
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/10",
                    )}
                  >
                    {usdPnL >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {usdPnL >= 0 ? "+" : ""}
                    {formatValue(Math.abs(usdPnL), "USD")}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {fmtCuotas.format(usdCuotapartes)} CP · {usdFunds.length} fondo{usdFunds.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

          {syncing && (
            <span className="flex items-center gap-1 self-end pb-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Actualizando…
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 sm:self-start">
          <Button
            variant="outline"
            size="sm"
            disabled={syncing || isPending}
            onClick={doSync}
            className="flex-1 gap-1.5 sm:flex-none"
          >
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
            Sincronizar
          </Button>
          <Button
            onClick={openNewFund}
            disabled={isPending}
            className="flex-1 gap-2 transition-all duration-300 hover:bg-primary/90 sm:flex-none"
          >
            <Plus className="size-4" />
            Agregar Transacción
          </Button>
        </div>
      </div>

      {/* ── Transaction Dialog ───────────────────────────────────────────────── */}
      <Dialog open={modal.open} onOpenChange={(open) => !isPending && setModal((m) => ({ ...m, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modal.editingTransactionId
                ? "Editar Transacción"
                : modal.duplicateFundId
                  ? "Agregar Transacción"
                  : "Registrar Transacción"}
            </DialogTitle>
            <DialogDescription>
              {modal.editingTransactionId
                ? `Corregí los datos de esta operación sobre ${targetFund?.name ?? modal.fundName}.`
                : modal.targetInvestmentId
                  ? `Agregá una operación al fondo ${targetFund?.name ?? ""}.`
                  : modal.duplicateFundId
                    ? "Este fondo ya está en tu cartera — la operación se va a sumar como una nueva transacción."
                    : "Buscá el fondo en CAFCI y registrá tu compra o venta."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">

            {/* ── Operation type toggle ── */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de Operación</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal((m) => ({ ...m, type: "BUY" }))}
                  className={cn(
                    "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                    modal.type === "BUY"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  COMPRA
                </button>
                <button
                  type="button"
                  onClick={() => setModal((m) => ({ ...m, type: "SELL" }))}
                  className={cn(
                    "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                    modal.type === "SELL"
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  VENTA
                </button>
              </div>
            </div>

            {/* ── Fund selection ── */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Fondo de Inversión <span className="text-primary">*</span>
              </Label>

              {/* Existing fund: read-only chip */}
              {modal.targetInvestmentId && targetFund && (
                <div className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                  targetFund.currency === "USD" ? "bg-amber-50/50 border-amber-200" : "bg-muted/40"
                )}>
                  <span className="font-medium">{targetFund.name}</span>
                  {targetFund.cafciId && (
                    <Badge variant="outline" className="font-mono text-[10px]">#{targetFund.cafciId}</Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", targetFund.currency === "USD" ? "border-amber-300 text-amber-700" : "")}
                  >
                    {targetFund.currency}
                  </Badge>
                </div>
              )}

              {/* New fund: CAFCI search */}
              {!modal.targetInvestmentId && (
                <>
                  <FundSearchInput
                    key={modal.open ? "open" : "closed"}
                    onSelect={handleCafciSelect}
                    disabled={isPending}
                  />
                  {modal.cafciId && (
                    <div className={cn(
                      "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs",
                      modal.fundCurrency === "USD" ? "bg-amber-50" : "bg-primary/8"
                    )}>
                      <span className="font-medium text-foreground">{modal.fundName}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">#{modal.cafciId}</Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", modal.fundCurrency === "USD" ? "border-amber-300 text-amber-700" : "")}
                      >
                        {modal.fundCurrency}
                      </Badge>
                      {modal.fundCurrentPrice != null && (
                        <span className="ml-auto text-muted-foreground">
                          Precio hoy:{" "}
                          <strong className={cn("tabular-nums", modal.fundCurrency === "USD" ? "text-amber-600" : "text-primary")}>
                            {formatValue(modal.fundCurrentPrice, modal.fundCurrency, true)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}
                  {modal.duplicateFundId && (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Este fondo ya está cargado en tu cartera. Para evitar duplicados, esta operación se va a registrar
                      como una nueva transacción sobre el fondo existente.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* ── Date ── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="txn-date" className="text-xs text-muted-foreground">
                Fecha de la Operación <span className="text-primary">*</span>
              </Label>
              <Input
                id="txn-date"
                type="date"
                value={modal.date}
                max={today}
                onChange={(e) => setModal((m) => ({ ...m, date: e.target.value }))}
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* ── Cuotapartes ── */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="txn-cp" className="text-xs text-muted-foreground">
                  Cuotapartes <span className="text-primary">*</span>
                </Label>
                <Input
                  id="txn-cp"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={modal.cuotapartes}
                  onChange={(e) => setModal((m) => ({ ...m, cuotapartes: e.target.value }))}
                  placeholder="ej: 1250.45"
                  disabled={isPending}
                />
              </div>

              {/* ── Price per CP ── */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="txn-price" className="text-xs text-muted-foreground">
                  Precio / CP <span className="text-primary">*</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {modalCurrency === "USD" ? "U$D" : "$"}
                  </span>
                  <Input
                    id="txn-price"
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={modal.price}
                    onChange={(e) => setModal((m) => ({ ...m, price: e.target.value }))}
                    placeholder={modalCurrency === "USD" ? "ej: 1.02" : "ej: 185.50"}
                    className="pl-9"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* ── Live preview ── */}
            {txnTotal != null && txnTotal > 0 && (
              <div className={cn(
                "rounded-lg px-3 py-2 text-sm",
                modal.type === "SELL" ? "bg-destructive/8" : modalCurrency === "USD" ? "bg-amber-50" : "bg-primary/8"
              )}>
                <span className="text-muted-foreground">
                  {modal.type === "BUY" ? "Comprás" : "Vendés"}{" "}
                  <strong>{fmtCuotas.format(parseFloat(modal.cuotapartes) || 0)}</strong> CP ×{" "}
                  {formatValue(parseFloat(modal.price) || 0, modalCurrency, true)} ={" "}
                </span>
                <strong className={cn(
                  "tabular-nums",
                  modal.type === "SELL" ? "text-destructive" : modalCurrency === "USD" ? "text-amber-600" : "text-primary"
                )}>
                  {formatValue(txnTotal, modalCurrency)}
                </strong>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModal({ ...EMPTY_MODAL })}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveTxn}
              disabled={!canSave || isPending}
              className={cn(
                "transition-all duration-200",
                modal.type === "SELL"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "hover:bg-primary/90"
              )}
            >
              {isPending ? (
                <><Loader2 className="mr-1.5 size-4 animate-spin" />Guardando…</>
              ) : modal.editingTransactionId ? (
                "Guardar Cambios"
              ) : (
                `Registrar ${modal.type === "BUY" ? "Compra" : "Venta"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Historical chart ─────────────────────────────────────────────────── */}
      <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {chartMode === "evolucion"
                ? "Evolución Real del Portafolio · Precios CAFCI"
                : "Portafolio vs Inflación (IPC INDEC)"}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-3">
              {/* Mode toggle */}
              <div className="flex rounded-lg border p-0.5 text-xs">
                <button
                  onClick={() => setChartMode("evolucion")}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    chartMode === "evolucion"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Evolución
                </button>
                <button
                  onClick={() => setChartMode("vs-ipc")}
                  disabled={!hasArs}
                  title={!hasArs ? "Solo disponible para fondos en ARS" : undefined}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
                    chartMode === "vs-ipc"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    !hasArs && "cursor-not-allowed opacity-40",
                  )}
                >
                  vs IPC
                </button>
              </div>

              {/* ARS / USD toggle — only in Evolución mode */}
              {chartMode === "evolucion" && (
                <div className="flex rounded-lg border p-0.5 text-xs">
                  <button
                    onClick={() => setChartCurrency("ARS")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      chartCurrency === "ARS"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    ARS
                  </button>
                  <button
                    onClick={() => setChartCurrency("USD")}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-colors",
                      chartCurrency === "USD"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    USD
                  </button>
                </div>
              )}

              {/* Range selector */}
              <div className="flex rounded-lg border p-0.5 text-xs">
                {(["3m", "6m", "1y", "all"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition-colors",
                      chartRange === r
                        ? chartMode === "vs-ipc"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r === "all" ? "Todo" : r.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Legend */}
              {chartMode === "evolucion" && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("h-0.5 w-5 rounded-full", chartCurrency === "USD" ? "bg-amber-500" : "bg-emerald-500")} />
                  Valor portafolio
                </span>
              )}
              {chartMode === "vs-ipc" && (
                <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-5 rounded-full bg-emerald-500" />
                    Mi portafolio
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-5 rounded-full bg-violet-500" />
                    IPC INDEC
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg width="20" height="4" className="shrink-0">
                      <line x1="0" y1="2" x2="20" y2="2" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 3" strokeOpacity="0.7" />
                    </svg>
                    Proyectado
                  </span>
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Evolución mode ── */}
          {chartMode === "evolucion" && (
            <>
              {historyLoading ? (
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : chartPoints.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <TrendingUp className="size-8 opacity-30" />
                  <div>
                    <p className="text-sm font-medium">Sin historial en {chartCurrency} todavía</p>
                    <p className="mt-1 text-xs">
                      {historyData.length === 0
                        ? "Presioná «Sincronizar» para registrar el primer punto de datos real."
                        : `No hay fondos en ${chartCurrency} en tu historial.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-72 w-full">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={paddedChartPoints} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            chartCurrency === "ARS"
                              ? chartSpread < 10
                                ? `$${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `$${(v / 1_000_000).toFixed(2)}M`
                              : `U$D ${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          width={74}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          formatter={(value) => [formatValue(value as number, chartCurrency), "Mi Portafolio"]}
                          labelFormatter={(label) => label}
                          contentStyle={{
                            borderRadius: "0.75rem",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            fontSize: "0.8rem",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="valor"
                          stroke={chartCurrency === "USD" ? "#d97706" : "#10b981"}
                          strokeWidth={2.5}
                          dot={chartPoints.length <= 30
                            ? { fill: chartCurrency === "USD" ? "#d97706" : "#10b981", r: 3, strokeWidth: 0 }
                            : false
                          }
                          activeDot={{ r: 5, strokeWidth: 0 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Precios reales de CAFCI · Un registro por día hábil ·{" "}
                <span className="font-medium">{chartPoints.length} punto{chartPoints.length !== 1 ? "s" : ""} en {chartCurrency}</span>
              </p>
            </>
          )}

          {/* ── vs IPC mode ── */}
          {chartMode === "vs-ipc" && (
            <>
              {(historyLoading || ipcLoading) ? (
                <div className="flex h-72 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-sm">{ipcLoading ? "Cargando IPC de INDEC…" : "Cargando historial…"}</span>
                </div>
              ) : arsHistoryPoints.length < 2 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <TrendingUp className="size-8 opacity-30" />
                  <div>
                    <p className="text-sm font-medium">Acumulando datos…</p>
                    <p className="mt-1 text-xs">
                      Se necesitan al menos 2 días de historial ARS para comparar contra el IPC.
                      <br />El gráfico se completará automáticamente con cada sincronización diaria.
                    </p>
                  </div>
                </div>
              ) : ipcData.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <TrendingUp className="size-8 opacity-30" />
                  <p className="text-sm">No se pudo obtener el IPC de INDEC. Verificá tu conexión.</p>
                </div>
              ) : normalizedPoints.length === 0 ? (
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <TrendingUp className="size-8 opacity-30" />
                  <div>
                    <p className="text-sm font-medium">No hay datos suficientes</p>
                    <p className="mt-1 text-xs">
                      Se necesitan al menos 2 días de historial ARS y datos de INDEC cargados.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-72 w-full">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={normalizedPoints} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            `${v >= 100 ? "+" : ""}${(v - 100).toFixed(1)}%`
                          }
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          width={60}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            `${(value as number) >= 100 ? "+" : ""}${((value as number) - 100).toFixed(2)}%`,
                            name === "portafolio"
                              ? "Mi portafolio"
                              : name === "ipc"
                              ? "IPC INDEC"
                              : "IPC Proyectado",
                          ]}
                          labelFormatter={(label) => label}
                          contentStyle={{
                            borderRadius: "0.75rem",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            fontSize: "0.8rem",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="portafolio"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={normalizedPoints.length <= 30
                            ? { fill: "#10b981", r: 3, strokeWidth: 0 }
                            : false
                          }
                          activeDot={{ r: 5, strokeWidth: 0 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="ipc"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0, fill: "#7c3aed" }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="ipcProjected"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          strokeDasharray="4 5"
                          strokeOpacity={0.55}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0, fill: "#7c3aed", fillOpacity: 0.55 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Base 100 = primer día del período seleccionado ·{" "}
                {lastIpcMonth
                  ? <>IPC real hasta <span className="font-medium">{lastIpcMonth}</span> · línea punteada = proyección basada en última tasa mensual (INDEC publica con ~6 semanas de retraso)</>
                  : "Cargando datos de INDEC…"}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Fund table ───────────────────────────────────────────────────────── */}
      <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <TrendingUp className="size-4" />
            </span>
            Mis Posiciones
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {funds.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="text-4xl">📊</span>
              <p className="text-sm text-muted-foreground">
                Usá el botón{" "}
                <button
                  onClick={openNewFund}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  + Agregar Transacción
                </button>{" "}
                para registrar tu primera operación.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Fondo</TableHead>
                  <TableHead className="text-right">Cuotapartes</TableHead>
                  <TableHead className="text-right">Precio / CP</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Rendimiento</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funds.map((fund) => {
                  const isUsd = fund.currency === "USD"
                  const valor = fund.cuotapartes * fund.currentPrice
                  const ret = fund.avgBuyPrice != null && fund.avgBuyPrice > 0
                    ? ((fund.currentPrice / fund.avgBuyPrice) - 1) * 100
                    : null
                  const isExpanded = expandedFundId === fund.id

                  return (
                    <React.Fragment key={fund.id}>
                      <TableRow className={isUsd ? "bg-amber-50/30" : undefined}>
                        <TableCell className="pl-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{fund.name}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="w-fit font-mono text-[10px]">
                                {fund.ticker}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  isUsd ? "border-amber-300 text-amber-700" : "text-muted-foreground",
                                )}
                              >
                                {fund.currency}
                              </Badge>
                              {fund.cafciId && fund.priceDate && (
                                <span className="text-[10px] text-muted-foreground">{fund.priceDate}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtCuotas.format(fund.cuotapartes)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", isUsd && "text-amber-600")}>
                          {formatValue(fund.currentPrice, fund.currency, true)}
                        </TableCell>
                        <TableCell className={cn("text-right font-semibold tabular-nums", isUsd ? "text-amber-600" : "text-primary")}>
                          {formatValue(Math.round(valor), fund.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {ret != null ? (
                            <span className={cn("text-sm font-medium tabular-nums", ret >= 0 ? "text-emerald-600" : "text-destructive")}>
                              {ret >= 0 ? "+" : "−"}
                              {Math.abs(ret).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex justify-end gap-1">
                            {/* Expand transactions */}
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => setExpandedFundId(isExpanded ? null : fund.id)}
                              disabled={isPending}
                              aria-label="Ver transacciones"
                              title={`${fund.transactions.length} transacción${fund.transactions.length !== 1 ? "es" : ""}`}
                            >
                              {isExpanded ? <ChevronUp className="size-3" /> : <Receipt className="size-3" />}
                            </Button>
                            {/* Add transaction */}
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => openAddToFund(fund)}
                              disabled={isPending || syncing}
                              aria-label="Agregar transacción"
                              title="Agregar transacción"
                            >
                              <Plus className="size-3" />
                            </Button>
                            {/* Delete fund */}
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="hover:text-destructive"
                              onClick={() => handleDeleteFund(fund.id)}
                              disabled={isPending || syncing}
                              aria-label={`Eliminar ${fund.name}`}
                              title="Eliminar fondo y todas sus transacciones"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* ── Expanded transaction list ── */}
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="px-6 py-3">
                            <div className="flex flex-col gap-1.5">
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                Historial de transacciones
                              </p>
                              {fund.transactions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Sin transacciones.</p>
                              ) : (
                                fund.transactions.map((txn) => (
                                  <div
                                    key={txn.id}
                                    className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-xs"
                                  >
                                    <Badge
                                      className={cn(
                                        "shrink-0 text-[10px] font-bold",
                                        txn.type === "BUY"
                                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                          : "bg-destructive/10 text-destructive hover:bg-destructive/10",
                                      )}
                                    >
                                      {txn.type === "BUY" ? "COMPRA" : "VENTA"}
                                    </Badge>
                                    <span className="w-24 shrink-0 text-muted-foreground">{txn.date}</span>
                                    <span className="tabular-nums">
                                      {fmtCuotas.format(txn.cuotapartes)} CP
                                    </span>
                                    <span className="text-muted-foreground">a</span>
                                    <span className={cn("tabular-nums font-medium", isUsd ? "text-amber-600" : "text-foreground")}>
                                      {formatValue(txn.price, fund.currency, true)}
                                    </span>
                                    <span className="ml-auto text-muted-foreground">
                                      = {formatValue(txn.cuotapartes * txn.price, fund.currency)}
                                    </span>
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      className="shrink-0"
                                      onClick={() => openEditTransaction(fund, txn)}
                                      disabled={isPending || syncing}
                                      aria-label="Editar transacción"
                                      title="Editar transacción"
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                    <Button
                                      size="icon-xs"
                                      variant="ghost"
                                      className="shrink-0 hover:text-destructive"
                                      onClick={() => handleDeleteTransaction(txn.id)}
                                      disabled={isPending}
                                      aria-label="Eliminar transacción"
                                    >
                                      <X className="size-3" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
              <TableFooter>
                {hasArs && (
                  <TableRow>
                    <TableCell colSpan={3} className="pl-6 font-semibold text-muted-foreground">
                      Subtotal ARS
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-primary">
                      {formatARS(Math.round(arsTotal))}
                    </TableCell>
                    <TableCell className="text-right">
                      {arsReturn != null && (
                        <span className={cn("text-sm font-bold tabular-nums", arsReturn >= 0 ? "text-emerald-600" : "text-destructive")}>
                          {arsReturn >= 0 ? "+" : "−"}
                          {Math.abs(arsReturn).toFixed(2)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6" />
                  </TableRow>
                )}
                {hasUsd && (
                  <TableRow>
                    <TableCell colSpan={3} className="pl-6 font-semibold text-muted-foreground">
                      Subtotal USD
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-amber-600">
                      {formatValue(usdTotal, "USD")}
                    </TableCell>
                    <TableCell className="text-right">
                      {usdReturn != null && (
                        <span className={cn("text-sm font-bold tabular-nums", usdReturn >= 0 ? "text-emerald-600" : "text-destructive")}>
                          {usdReturn >= 0 ? "+" : "−"}
                          {Math.abs(usdReturn).toFixed(2)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6" />
                  </TableRow>
                )}
              </TableFooter>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { InversionesTab as BalanzMonitor }

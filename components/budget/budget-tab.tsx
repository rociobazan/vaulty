"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import {
  Home,
  ShoppingCart,
  PiggyBank,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  CreditCard,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  Coffee,
  RotateCcw,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatARS } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/money-input"
import { BudgetDonut, type DonutSlice } from "@/components/budget/budget-donut"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseItem {
  id: string
  label: string
  value: number
}

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
  colorClass: string
  purchases: Purchase[]
}

interface MonthData {
  income: number
  fixedItems: ExpenseItem[]
  variableItems: ExpenseItem[]
  savingsItems: ExpenseItem[]
  creditCards: CreditCardEntry[]
}

interface AppState {
  currentMonthKey: string
  monthsData: Record<string, MonthData>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_COLORS = [
  "bg-orange-100 text-orange-800 border-b border-orange-200",
  "bg-sky-100 text-sky-800 border-b border-sky-200",
  "bg-violet-100 text-violet-800 border-b border-violet-200",
  "bg-rose-100 text-rose-800 border-b border-rose-200",
  "bg-teal-100 text-teal-800 border-b border-teal-200",
]

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const INITIAL_MONTH_DATA: MonthData = {
  income: 1000000,
  fixedItems: [
    { id: "alquiler", label: "Alquiler", value: 320000 },
    { id: "luz", label: "Luz", value: 45000 },
    { id: "internet", label: "Internet", value: 28000 },
  ],
  variableItems: [
    { id: "super", label: "Supermercado", value: 220000 },
    { id: "salidas", label: "Salidas", value: 80000 },
  ],
  savingsItems: [
    { id: "fondos", label: "Fondos de inversión", value: 120000 },
  ],
  creditCards: [
    {
      id: "macro",
      name: "Tarjeta Macro",
      colorClass: CARD_COLORS[0],
      purchases: [
        { id: "p1", concept: "Zapatillas Nike", quotaCurrent: 2, quotaTotal: 6, amount: 45000 },
        { id: "p2", concept: "Colchón Cannon", quotaCurrent: 1, quotaTotal: 12, amount: 32911 },
        { id: "p3", concept: "Netflix", quotaCurrent: 1, quotaTotal: 1, amount: 20000 },
      ],
    },
  ],
}

const EMPTY_MONTH: MonthData = {
  income: 0,
  fixedItems: [],
  variableItems: [],
  savingsItems: [],
  creditCards: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number)
  return { year: y, month: m }
}

function getNextMonthKey(key: string): string {
  const { year, month } = parseMonthKey(key)
  return month === 12 ? getMonthKey(year + 1, 1) : getMonthKey(year, month + 1)
}

function getPrevMonthKey(key: string): string {
  const { year, month } = parseMonthKey(key)
  return month === 1 ? getMonthKey(year - 1, 12) : getMonthKey(year, month - 1)
}

function formatMonthLabel(key: string): string {
  const { year, month } = parseMonthKey(key)
  return `${MONTHS_ES[month - 1]} ${year}`
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return getMonthKey(now.getFullYear(), now.getMonth() + 1)
}

function normalizePurchase(p: Record<string, unknown>): Purchase {
  if (typeof p.quotaCurrent === "number" && typeof p.quotaTotal === "number") {
    return p as unknown as Purchase
  }
  // backward compat: old "2/6" string format
  const parts = String(p.quota ?? "1/1").split("/")
  const cur = parseInt(parts[0], 10)
  const total = parseInt(parts[1], 10)
  return {
    id: p.id as string,
    concept: p.concept as string,
    quotaCurrent: isNaN(cur) ? 1 : cur,
    quotaTotal: isNaN(total) ? 1 : total,
    amount: p.amount as number,
  }
}

function advanceInstallments(data: MonthData): MonthData {
  return {
    ...data,
    fixedItems: data.fixedItems.map((i) => ({ ...i, id: genId() })),
    variableItems: data.variableItems.map((i) => ({ ...i, id: genId() })),
    savingsItems: data.savingsItems.map((i) => ({ ...i, id: genId() })),
    creditCards: data.creditCards.map((card) => ({
      ...card,
      id: genId(),
      purchases: card.purchases
        .filter((p) => p.quotaCurrent < p.quotaTotal)
        .map((p) => ({ ...p, id: genId(), quotaCurrent: p.quotaCurrent + 1 })),
    })),
  }
}

// ─── ExpenseList: editable label + editable amount ───────────────────────────

function ExpenseList({
  items,
  onLabelChange,
  onValueChange,
  onDelete,
}: {
  items: ExpenseItem[]
  onLabelChange: (id: string, label: string) => void
  onValueChange: (id: string, value: number) => void
  onDelete: (id: string) => void
}) {
  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <input
              value={item.label}
              onChange={(e) => onLabelChange(item.id, e.target.value)}
              className="w-full rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 focus:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
              aria-label="Nombre del concepto"
            />
            <MoneyInput
              value={item.value}
              onChange={(v) => onValueChange(item.id, v)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="mb-0.5 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </>
  )
}

// ─── BudgetTab ────────────────────────────────────────────────────────────────

export function BudgetTab() {
  // All month data + current month key in one combined state (avoids stale-closure bugs)
  const [appState, setAppState] = useState<AppState>(() => {
    const key = getCurrentMonthKey()
    return { currentMonthKey: key, monthsData: { [key]: EMPTY_MONTH } }
  })

  const { currentMonthKey, monthsData } = appState
  const currentData = monthsData[currentMonthKey] ?? EMPTY_MONTH
  const { income, fixedItems, variableItems, savingsItems, creditCards } = currentData

  // ─── Generic section updater (uses functional setState to avoid stale closure) ──

  function updateSection<K extends keyof MonthData>(
    section: K,
    updater: (prev: MonthData[K]) => MonthData[K],
  ) {
    setAppState((prev) => {
      const key = prev.currentMonthKey
      const current = prev.monthsData[key] ?? EMPTY_MONTH
      return {
        ...prev,
        monthsData: {
          ...prev.monthsData,
          [key]: { ...current, [section]: updater(current[section] as MonthData[K]) },
        },
      }
    })
  }

  function setIncome(value: number) {
    updateSection("income", () => value)
  }

  // ─── UI form state (not persisted per month) ──────────────────────────────

  const [addingTo, setAddingTo] = useState<"fijos" | "variables" | "ahorro" | null>(null)
  const [newLabel, setNewLabel] = useState("")
  const [newValue, setNewValue] = useState(0)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardName, setNewCardName] = useState("")
  const [addingPurchaseTo, setAddingPurchaseTo] = useState<string | null>(null)
  const [newConcept, setNewConcept] = useState("")
  const [newQuotaCurrent, setNewQuotaCurrent] = useState(1)
  const [newQuotaTotal, setNewQuotaTotal] = useState(1)
  const [newPurchaseAmount, setNewPurchaseAmount] = useState(0)
  const [editingPurchase, setEditingPurchase] = useState<{
    cardId: string
    purchaseId: string
  } | null>(null)
  const [editPurchaseConcept, setEditPurchaseConcept] = useState("")
  const [editQuotaCurrent, setEditQuotaCurrent] = useState(1)
  const [editQuotaTotal, setEditQuotaTotal] = useState(1)
  const [editPurchaseAmount, setEditPurchaseAmount] = useState(0)

  function resetUiState() {
    setAddingTo(null)
    setNewLabel("")
    setNewValue(0)
    setShowAddCard(false)
    setNewCardName("")
    setAddingPurchaseTo(null)
    setNewConcept("")
    setNewQuotaCurrent(1)
    setNewQuotaTotal(1)
    setNewPurchaseAmount(0)
    setEditingPurchase(null)
  }

  // ─── API persistence ──────────────────────────────────────────────────────

  const loadedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appStateRef = useRef(appState)
  appStateRef.current = appState

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function saveBudget(monthKey: string, data: MonthData): Promise<boolean> {
    try {
      const res = await fetch(`/api/budget/${monthKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income: data.income,
          fixedItems: data.fixedItems,
          variableItems: data.variableItems,
          savingsItems: data.savingsItems,
          creditCards: data.creditCards,
        }),
        keepalive: true,
      })
      return res.ok || res.status === 401
    } catch {
      return false
    }
  }

  async function retrySave() {
    setSaveStatus("saving")
    const { currentMonthKey, monthsData } = appStateRef.current
    const data = monthsData[currentMonthKey]
    if (!data) return
    const ok = await saveBudget(currentMonthKey, data)
    if (ok) {
      setSaveStatus("saved")
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000)
    } else {
      setSaveStatus("error")
    }
  }

  // Load the current month's data from DB on first mount
  useEffect(() => {
    async function load() {
      const key = getCurrentMonthKey()
      try {
        const res = await fetch(`/api/budget/${key}`)
        if (res.ok) {
          const data = await res.json()
          setAppState((prev) => ({
            ...prev,
            monthsData: {
              ...prev.monthsData,
              [key]: {
                income: data.income,
                fixedItems: data.fixedItems,
                variableItems: data.variableItems,
                savingsItems: data.savingsItems,
                creditCards: (data.creditCards ?? []).map((card: CreditCardEntry) => ({
                  ...card,
                  purchases: (card.purchases as unknown as Record<string, unknown>[]).map(normalizePurchase),
                })),
              },
            },
          }))
        }
      } catch (err) {
        console.error("[budget] load error:", err)
      } finally {
        loadedRef.current = true
      }
    }
    load()

    // Flush any pending save immediately when unmounting (e.g. on logout)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        if (loadedRef.current) {
          const { currentMonthKey, monthsData } = appStateRef.current
          const data = monthsData[currentMonthKey]
          if (data) saveBudget(currentMonthKey, data).catch(() => {})
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save the current month whenever state changes (1.5 s debounce)
  useEffect(() => {
    if (!loadedRef.current) return
    setSaveStatus("saving")
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const { currentMonthKey, monthsData } = appState
      const data = monthsData[currentMonthKey]
      if (!data) return
      const ok = await saveBudget(currentMonthKey, data)
      if (ok) {
        setSaveStatus("saved")
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000)
      } else {
        setSaveStatus("error")
      }
      saveTimerRef.current = null
    }, 1500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [appState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Month navigation ─────────────────────────────────────────────────────

  function goToPrevMonth() {
    const prevKey = getPrevMonthKey(currentMonthKey)
    resetUiState()
    setAppState((prev) => ({
      ...prev,
      currentMonthKey: getPrevMonthKey(prev.currentMonthKey),
    }))
    // Try loading saved data from DB for this month
    void fetch(`/api/budget/${prevKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setAppState((prev) => ({
          ...prev,
          monthsData: {
            ...prev.monthsData,
            [prevKey]: {
              income: data.income,
              fixedItems: data.fixedItems,
              variableItems: data.variableItems,
              savingsItems: data.savingsItems,
              creditCards: (data.creditCards ?? []).map((card: CreditCardEntry) => ({
                ...card,
                purchases: (card.purchases as unknown as Record<string, unknown>[]).map(normalizePurchase),
              })),
            },
          },
        }))
      })
      .catch(() => {})
  }

  function goToNextMonth() {
    const nextKey = getNextMonthKey(currentMonthKey)
    resetUiState()
    setAppState((prev) => {
      const key = getNextMonthKey(prev.currentMonthKey)
      return {
        currentMonthKey: key,
        monthsData: {
          ...prev.monthsData,
          ...(prev.monthsData[key]
            ? {}
            : {
                [key]: advanceInstallments(
                  prev.monthsData[prev.currentMonthKey] ?? EMPTY_MONTH,
                ),
              }),
        },
      }
    })
    // Try loading saved data from DB (overrides auto-generated advance if it exists)
    void fetch(`/api/budget/${nextKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setAppState((prev) => ({
          ...prev,
          monthsData: {
            ...prev.monthsData,
            [nextKey]: {
              income: data.income,
              fixedItems: data.fixedItems,
              variableItems: data.variableItems,
              savingsItems: data.savingsItems,
              creditCards: (data.creditCards ?? []).map((card: CreditCardEntry) => ({
                ...card,
                purchases: (card.purchases as unknown as Record<string, unknown>[]).map(normalizePurchase),
              })),
            },
          },
        }))
      })
      .catch(() => {})
  }

  // ─── Derived totals ───────────────────────────────────────────────────────

  const ccTotals = useMemo(
    () =>
      creditCards.map((card) => ({
        ...card,
        total: card.purchases.reduce((sum, p) => sum + p.amount, 0),
      })),
    [creditCards],
  )

  const totalCC = ccTotals.reduce((sum, c) => sum + c.total, 0)
  const totalFixedBase = fixedItems.reduce((sum, i) => sum + i.value, 0)
  const totalFixed = totalFixedBase + totalCC
  const totalVariables = variableItems.reduce((sum, i) => sum + i.value, 0)
  const totalSavings = savingsItems.reduce((sum, i) => sum + i.value, 0)
  const totalPlanned = totalFixed + totalVariables + totalSavings
  const toAssign = income - totalPlanned
  const isBalanced = toAssign === 0 && income > 0
  const isNegative = toAssign < 0

  const dailyAllowed = (() => {
    const { year, month } = parseMonthKey(currentMonthKey)
    const daysInMonth = new Date(year, month, 0).getDate()
    const now = new Date()
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    const remainingDays = isCurrentMonth ? Math.max(1, daysInMonth - now.getDate() + 1) : daysInMonth
    return Math.round(toAssign / Math.max(1, remainingDays))
  })()

  const donutData: DonutSlice[] = [
    { name: "Gastos Fijos", value: totalFixedBase, color: "var(--chart-1)" },
    { name: "Tarjetas", value: totalCC, color: "var(--chart-2)" },
    { name: "Variables", value: totalVariables, color: "var(--chart-3)" },
    { name: "Ahorro", value: totalSavings, color: "var(--chart-5)" },
  ]

  // ─── Expense item handlers ────────────────────────────────────────────────

  function openAddItem(section: "fijos" | "variables" | "ahorro") {
    if (addingTo === section) {
      cancelAddItem()
    } else {
      setAddingTo(section)
      setNewLabel("")
      setNewValue(0)
    }
  }

  function saveNewItem() {
    if (!newLabel.trim() || !addingTo) return
    const item: ExpenseItem = { id: genId(), label: newLabel.trim(), value: newValue }
    const key =
      addingTo === "fijos"
        ? "fixedItems"
        : addingTo === "variables"
          ? "variableItems"
          : "savingsItems"
    updateSection(key, (prev) => [...prev, item])
    cancelAddItem()
  }

  function cancelAddItem() {
    setAddingTo(null)
    setNewLabel("")
    setNewValue(0)
  }

  // ─── Credit card handlers ─────────────────────────────────────────────────

  function addCreditCard() {
    if (!newCardName.trim()) return
    const colorIdx = creditCards.length % CARD_COLORS.length
    updateSection("creditCards", (prev) => [
      ...prev,
      {
        id: genId(),
        name: newCardName.trim(),
        colorClass: CARD_COLORS[colorIdx],
        purchases: [],
      },
    ])
    setNewCardName("")
    setShowAddCard(false)
  }

  function deleteCreditCard(cardId: string) {
    updateSection("creditCards", (prev) => prev.filter((c) => c.id !== cardId))
    if (addingPurchaseTo === cardId) setAddingPurchaseTo(null)
    if (editingPurchase?.cardId === cardId) setEditingPurchase(null)
  }

  function openAddPurchase(cardId: string) {
    setAddingPurchaseTo(cardId)
    setEditingPurchase(null)
    setNewConcept("")
    setNewQuotaCurrent(1)
    setNewQuotaTotal(1)
    setNewPurchaseAmount(0)
  }

  function savePurchase(cardId: string) {
    if (!newConcept.trim()) return
    const safeTotal = Math.max(1, newQuotaTotal)
    const purchase: Purchase = {
      id: genId(),
      concept: newConcept.trim(),
      quotaCurrent: Math.min(Math.max(1, newQuotaCurrent), safeTotal),
      quotaTotal: safeTotal,
      amount: newPurchaseAmount,
    }
    updateSection("creditCards", (prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, purchases: [...c.purchases, purchase] } : c,
      ),
    )
    setAddingPurchaseTo(null)
    setNewConcept("")
    setNewQuotaCurrent(1)
    setNewQuotaTotal(1)
    setNewPurchaseAmount(0)
  }

  function deletePurchase(cardId: string, purchaseId: string) {
    updateSection("creditCards", (prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, purchases: c.purchases.filter((p) => p.id !== purchaseId) }
          : c,
      ),
    )
  }

  function startEditPurchase(cardId: string, p: Purchase) {
    setEditingPurchase({ cardId, purchaseId: p.id })
    setAddingPurchaseTo(null)
    setEditPurchaseConcept(p.concept)
    setEditQuotaCurrent(p.quotaCurrent)
    setEditQuotaTotal(p.quotaTotal)
    setEditPurchaseAmount(p.amount)
  }

  function saveEditPurchase() {
    if (!editingPurchase || !editPurchaseConcept.trim()) return
    const { cardId, purchaseId } = editingPurchase
    const safeTotal = Math.max(1, editQuotaTotal)
    updateSection("creditCards", (prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              purchases: c.purchases.map((p) =>
                p.id === purchaseId
                  ? {
                      ...p,
                      concept: editPurchaseConcept.trim(),
                      quotaCurrent: Math.min(Math.max(1, editQuotaCurrent), safeTotal),
                      quotaTotal: safeTotal,
                      amount: editPurchaseAmount,
                    }
                  : p,
              ),
            }
          : c,
      ),
    )
    setEditingPurchase(null)
  }

  // ─── Shared add-item inline form ──────────────────────────────────────────

  const addItemForm = (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2">
      <Input
        placeholder="Nombre del concepto"
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        className="h-8 text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") saveNewItem()
        }}
      />
      <MoneyInput value={newValue} onChange={setNewValue} />
      <div className="flex gap-2">
        <Button size="sm" className="h-8 flex-1 text-xs" onClick={saveNewItem}>
          Guardar
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={cancelAddItem}>
          Cancelar
        </Button>
      </div>
    </div>
  )

  // ─── Category card renderer (3 sections share identical structure) ─────────

  function categoryCard(
    title: string,
    Icon: React.ComponentType<{ className?: string }>,
    chartColor: string,
    items: ExpenseItem[],
    section: "fijos" | "variables" | "ahorro",
    sectionKey: "fixedItems" | "variableItems" | "savingsItems",
    total: number,
    extra?: React.ReactNode,
  ) {
    return (
      <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in oklch, ${chartColor} 18%, transparent)`,
                  color: chartColor,
                }}
              >
                <Icon className="size-4" />
              </span>
              {title}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openAddItem(section)}
              aria-label={`Agregar ítem a ${title}`}
            >
              {addingTo === section ? <X className="size-4" /> : <Plus className="size-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ExpenseList
            items={items}
            onLabelChange={(id, label) =>
              updateSection(sectionKey, (prev) =>
                prev.map((it) => (it.id === id ? { ...it, label } : it)),
              )
            }
            onValueChange={(id, value) =>
              updateSection(sectionKey, (prev) =>
                prev.map((it) => (it.id === id ? { ...it, value } : it)),
              )
            }
            onDelete={(id) =>
              updateSection(sectionKey, (prev) => prev.filter((it) => it.id !== id))
            }
          />
          {extra}
          {addingTo === section && addItemForm}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatARS(total)}
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Compact header: month nav + income + daily widget + donut ── */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">

        {/* Left column: income card (includes daily allowance) */}
        <div className="flex flex-col h-full lg:col-span-2">
          <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
            <CardContent className="flex flex-col gap-4 p-6">

              {/* 1 — Month navigation + save status */}
              <div className="flex flex-col gap-1.5 border-b border-border pb-4">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={goToPrevMonth}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-44 text-center text-sm font-semibold text-foreground">
                  {formatMonthLabel(currentMonthKey)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={goToNextMonth}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              {saveStatus !== "idle" && (
                <div className="flex items-center justify-center gap-1.5 text-xs">
                  {saveStatus === "saving" && (
                    <>
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Guardando...</span>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <Check className="size-3 text-green-600" />
                      <span className="text-green-600">Guardado</span>
                    </>
                  )}
                  {saveStatus === "error" && (
                    <>
                      <AlertTriangle className="size-3 text-destructive" />
                      <span className="text-destructive">Error al guardar</span>
                      <button
                        onClick={retrySave}
                        className="flex items-center gap-1 text-primary underline underline-offset-2"
                      >
                        <RotateCcw className="size-3" />
                        Reintentar
                      </button>
                    </>
                  )}
                </div>
              )}
              </div>

              {/* 2 — Ingreso mensual */}
              <div className="flex w-full flex-col gap-1.5">
                <Label
                  htmlFor="income"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Wallet className="size-3.5" />
                  Ingreso mensual estimado
                </Label>
                <MoneyInput id="income" value={income} onChange={setIncome} />
              </div>

              {/* 3 — Por Asignar */}
              <div
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border p-3 transition-colors duration-300",
                  isNegative
                    ? "border-destructive/30 bg-destructive/10"
                    : isBalanced
                      ? "border-primary/30 bg-primary/10"
                      : "border-border bg-muted/50",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      isNegative
                        ? "bg-destructive/15 text-destructive"
                        : isBalanced
                          ? "bg-primary/15 text-primary"
                          : "bg-background text-muted-foreground",
                    )}
                  >
                    {isNegative ? (
                      <AlertTriangle className="size-4" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">Por Asignar</span>
                    <span className="text-[10px] text-muted-foreground">
                      {isNegative
                        ? "Excedido"
                        : isBalanced
                          ? "¡Base cero!"
                          : "Restante"}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    isNegative
                      ? "text-destructive"
                      : isBalanced
                        ? "text-primary"
                        : "text-foreground",
                  )}
                >
                  {formatARS(toAssign)}
                </span>
              </div>

              {/* 4 — Permitido Diario */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Coffee className="size-4 text-primary" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Permitido Diario · Gastos Variables
                  </span>
                  <p className="text-sm text-foreground">
                    Para mantenerte en verde, tu permitido es de{" "}
                    <strong className="tabular-nums text-primary">
                      {formatARS(dailyAllowed)}
                    </strong>{" "}
                    por día.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: donut */}
        <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
          <CardHeader>
            <CardTitle className="text-base">Radiografía del mes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <BudgetDonut data={donutData} total={totalPlanned} />
            <ul className="flex flex-col gap-1.5">
              {donutData.map((d) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatARS(d.value)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Categories grid ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categoryCard(
          "Gastos Fijos",
          Home,
          "var(--chart-1)",
          fixedItems,
          "fijos",
          "fixedItems",
          totalFixed,
          ccTotals.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 border-t border-dashed border-border pt-2">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Tarjetas de crédito
                </span>
              </div>
              {ccTotals.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{card.name}</span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatARS(card.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : undefined,
        )}
        {categoryCard(
          "Gastos Variables",
          ShoppingCart,
          "var(--chart-3)",
          variableItems,
          "variables",
          "variableItems",
          totalVariables,
        )}
        {categoryCard(
          "Ahorro",
          PiggyBank,
          "var(--chart-5)",
          savingsItems,
          "ahorro",
          "savingsItems",
          totalSavings,
        )}
      </div>

      {/* ── Credit Cards module ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CreditCard className="size-5 text-primary" />
            Tarjetas de Crédito
          </h3>
          <span className="text-sm text-muted-foreground">
            Total:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatARS(totalCC)}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ccTotals.map((card) => (
            <Card
              key={card.id}
              className="overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60"
            >
              {/* Pastel colored header */}
              <div
                className={cn(
                  "flex items-center justify-between px-4 py-3",
                  card.colorClass,
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CreditCard className="size-4" />
                  {card.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-70 hover:bg-black/10 hover:opacity-100"
                  onClick={() => deleteCreditCard(card.id)}
                  aria-label={`Eliminar ${card.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Concepto</TableHead>
                      <TableHead className="w-32 text-center">Cuota</TableHead>
                      <TableHead className="w-36 pr-4 text-right">Monto</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {card.purchases.map((p) => {
                      const isEditingThis =
                        editingPurchase?.purchaseId === p.id &&
                        editingPurchase?.cardId === card.id

                      if (isEditingThis) {
                        return (
                          <TableRow key={p.id} className="bg-primary/5">
                            <TableCell className="pl-4">
                              <Input
                                value={editPurchaseConcept}
                                onChange={(e) => setEditPurchaseConcept(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEditPurchase()
                                  if (e.key === "Escape") setEditingPurchase(null)
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={editQuotaCurrent === 0 ? "" : String(editQuotaCurrent)}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, "")
                                    setEditQuotaCurrent(raw === "" ? 0 : parseInt(raw, 10))
                                  }}
                                  onBlur={() => setEditQuotaCurrent((v) => Math.max(1, v))}
                                  className="h-8 w-14 px-1 text-center text-sm"
                                />
                                <span className="text-xs text-muted-foreground">/</span>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={editQuotaTotal === 0 ? "" : String(editQuotaTotal)}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, "")
                                    setEditQuotaTotal(raw === "" ? 0 : parseInt(raw, 10))
                                  }}
                                  onBlur={() => setEditQuotaTotal((v) => Math.max(1, v))}
                                  className="h-8 w-14 px-1 text-center text-sm"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="pr-4">
                              <MoneyInput
                                value={editPurchaseAmount}
                                onChange={setEditPurchaseAmount}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-primary"
                                  onClick={saveEditPurchase}
                                >
                                  <Check className="size-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-muted-foreground"
                                  onClick={() => setEditingPurchase(null)}
                                >
                                  <X className="size-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      }

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="pl-4 text-sm">{p.concept}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {p.quotaCurrent} / {p.quotaTotal}
                          </TableCell>
                          <TableCell className="pr-4 text-right text-sm font-medium tabular-nums">
                            {formatARS(p.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => startEditPurchase(card.id, p)}
                                aria-label="Editar consumo"
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => deletePurchase(card.id, p.id)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {addingPurchaseTo === card.id && (
                      <TableRow>
                        <TableCell className="pl-4">
                          <Input
                            placeholder="Concepto"
                            value={newConcept}
                            onChange={(e) => setNewConcept(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={newQuotaCurrent === 0 ? "" : String(newQuotaCurrent)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "")
                                setNewQuotaCurrent(raw === "" ? 0 : parseInt(raw, 10))
                              }}
                              onBlur={() => setNewQuotaCurrent((v) => Math.max(1, v))}
                              className="h-8 w-14 px-1 text-center text-sm"
                            />
                            <span className="text-xs text-muted-foreground">/</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={newQuotaTotal === 0 ? "" : String(newQuotaTotal)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "")
                                setNewQuotaTotal(raw === "" ? 0 : parseInt(raw, 10))
                              }}
                              onBlur={() => setNewQuotaTotal((v) => Math.max(1, v))}
                              className="h-8 w-14 px-1 text-center text-sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <MoneyInput
                            value={newPurchaseAmount}
                            onChange={setNewPurchaseAmount}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setAddingPurchaseTo(null)}
                          >
                            <X className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="pl-4 text-sm font-semibold">
                        Total de la tarjeta
                      </TableCell>
                      <TableCell className="pr-4 text-right font-bold tabular-nums">
                        {formatARS(card.total)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
                </div>

                <div className="border-t border-border p-3">
                  {addingPurchaseTo === card.id ? (
                    <Button
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => savePurchase(card.id)}
                    >
                      Guardar consumo
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full border-dashed text-xs"
                      onClick={() => openAddPurchase(card.id)}
                    >
                      <Plus className="mr-1 size-3" />
                      Agregar consumo
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {/* Add card form / dashed button */}
          {showAddCard ? (
            <Card className="flex flex-col justify-center">
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label className="text-sm font-medium">Nombre de la tarjeta</Label>
                <Input
                  placeholder="ej. Tarjeta Visa"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCreditCard()
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={addCreditCard}>
                    Crear tarjeta
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddCard(false)
                      setNewCardName("")
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <button
              onClick={() => setShowAddCard(true)}
              className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="size-6" />
              <span className="text-sm font-medium">+ Agregar Nueva Tarjeta</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

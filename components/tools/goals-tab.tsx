"use client"

import { useState, useEffect } from "react"
import { Plus, CalendarDays, ChevronDown, ChevronUp, Target, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatARS } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { MoneyInput } from "@/components/money-input"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Goal {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  deadline: string | null
  createdAt: string
}

// ── Pig SVG ───────────────────────────────────────────────────────────────────

function PigIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <ellipse cx="16" cy="22" rx="7" ry="9" fill="#f9a8d4" />
      <ellipse cx="48" cy="22" rx="7" ry="9" fill="#f9a8d4" />
      <ellipse cx="16" cy="22" rx="4" ry="6" fill="#f472b6" />
      <ellipse cx="48" cy="22" rx="4" ry="6" fill="#f472b6" />
      <circle cx="32" cy="36" r="22" fill="#fda4af" />
      <ellipse cx="32" cy="44" rx="10" ry="7" fill="#f472b6" />
      <circle cx="28.5" cy="44" r="2.2" fill="#be185d" />
      <circle cx="35.5" cy="44" r="2.2" fill="#be185d" />
      <circle cx="23" cy="30" r="3" fill="#1f2937" />
      <circle cx="41" cy="30" r="3" fill="#1f2937" />
      <circle cx="24" cy="29" r="1" fill="white" />
      <circle cx="42" cy="29" r="1" fill="white" />
      <ellipse cx="18" cy="38" rx="5" ry="3" fill="#f9a8d4" opacity="0.6" />
      <ellipse cx="46" cy="38" rx="5" ry="3" fill="#f9a8d4" opacity="0.6" />
      <path d="M25 53 Q32 58 39 53" stroke="#be185d" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="28" y="13" width="8" height="2.5" rx="1.25" fill="#be185d" opacity="0.7" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toISOString().slice(0, 10)
}

// ── GoalCard ──────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onAddFunds,
  onEdit,
}: {
  goal: Goal
  onAddFunds: (goal: Goal) => void
  onEdit: (goal: Goal) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const pct = goal.targetAmount > 0
    ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
    : 0
  const done = pct >= 100
  const days = goal.deadline ? daysLeft(goal.deadline) : null

  return (
    <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:ring-1 hover:ring-pink-200">
      <div className={cn(
        "flex items-center gap-2 px-4 py-3",
        done
          ? "bg-gradient-to-r from-emerald-500 to-green-400"
          : "bg-gradient-to-r from-pink-500 to-violet-600",
      )}>
        <Target className="size-4 shrink-0 text-white/80" />
        <p className="flex-1 truncate text-sm font-semibold text-white">{goal.title}</p>
        {done && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            ¡Logrado!
          </span>
        )}
        <button
          onClick={() => onEdit(goal)}
          className="rounded p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          title="Editar meta"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium tabular-nums text-foreground">
                {formatARS(goal.currentAmount)}
              </span>
              <span className="text-muted-foreground">
                de {formatARS(goal.targetAmount)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  done ? "bg-emerald-500" : "bg-green-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className={cn(
              "text-right text-[11px] font-semibold tabular-nums",
              done ? "text-emerald-600" : "text-green-600",
            )}>
              {pct.toFixed(1)}%
            </p>
        </div>

        {expanded && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {goal.deadline && (
              <div className="flex items-center gap-2">
                <CalendarDays className="size-3.5 shrink-0" />
                <span>
                  Plazo: <strong className="text-foreground">{formatDeadline(goal.deadline)}</strong>
                  {days !== null && days > 0 && <span className="ml-1">({days} días)</span>}
                  {days !== null && days <= 0 && <span className="ml-1 text-destructive">(¡Vencido!)</span>}
                </span>
              </div>
            )}
            <span>
              Falta ahorrar:{" "}
              <strong className="text-foreground">
                {formatARS(Math.max(0, goal.targetAmount - goal.currentAmount))}
              </strong>
            </span>
            <span>
              Creada el{" "}
              <strong className="text-foreground">
                {new Date(goal.createdAt).toLocaleDateString("es-AR")}
              </strong>
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? "Ocultar" : "Ver Detalle"}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-gradient-to-r from-pink-500 to-violet-600 text-xs text-white hover:from-pink-600 hover:to-violet-700"
            onClick={() => onAddFunds(goal)}
            disabled={done}
          >
            <Plus className="size-3.5" />
            Aportar +
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── GoalsTab ──────────────────────────────────────────────────────────────────

export function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // Add-funds modal
  const [fundTarget, setFundTarget] = useState<Goal | null>(null)
  const [fundAmount, setFundAmount] = useState(0)
  const [fundPending, setFundPending] = useState(false)

  // Edit modal
  const [editTarget, setEditTarget] = useState<Goal | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTargetAmount, setEditTargetAmount] = useState(0)
  const [editCurrentAmount, setEditCurrentAmount] = useState(0)
  const [editDeadline, setEditDeadline] = useState("")
  const [editPending, setEditPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Create modal
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newTarget, setNewTarget] = useState(0)
  const [newDeadline, setNewDeadline] = useState("")
  const [createPending, setCreatePending] = useState(false)

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.ok ? r.json() : [])
      .then(setGoals)
      .catch(() => setGoals([]))
      .finally(() => setLoading(false))
  }, [])

  function openEdit(goal: Goal) {
    setEditTarget(goal)
    setEditTitle(goal.title)
    setEditTargetAmount(goal.targetAmount)
    setEditCurrentAmount(goal.currentAmount)
    setEditDeadline(toDateInputValue(goal.deadline))
    setConfirmDelete(false)
  }

  function closeEdit() {
    setEditTarget(null)
    setConfirmDelete(false)
  }

  async function handleEdit() {
    if (!editTarget || !editTitle.trim() || editTargetAmount <= 0) return
    setEditPending(true)
    try {
      const res = await fetch(`/api/goals/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          targetAmount: editTargetAmount,
          currentAmount: editCurrentAmount,
          deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated: Goal = await res.json()
      setGoals((prev) => prev.map((g) => g.id === updated.id ? updated : g))
      toast.success("Meta actualizada.")
      closeEdit()
    } catch {
      toast.error("No se pudo actualizar la meta.")
    } finally {
      setEditPending(false)
    }
  }

  async function handleDelete() {
    if (!editTarget) return
    setEditPending(true)
    try {
      const res = await fetch(`/api/goals/${editTarget.id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) throw new Error()
      setGoals((prev) => prev.filter((g) => g.id !== editTarget.id))
      toast.success("Meta eliminada.")
      closeEdit()
    } catch {
      toast.error("No se pudo eliminar la meta.")
    } finally {
      setEditPending(false)
    }
  }

  async function handleAddFunds() {
    if (!fundTarget || fundAmount <= 0) return
    setFundPending(true)
    try {
      const res = await fetch(`/api/goals/${fundTarget.id}/add-funds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: fundAmount }),
      })
      if (!res.ok) throw new Error()
      const updated: Goal = await res.json()
      setGoals((prev) => prev.map((g) => g.id === updated.id ? updated : g))
      toast.success(`¡${formatARS(fundAmount)} aportados a "${fundTarget.title}"!`)
      setFundTarget(null)
      setFundAmount(0)
    } catch {
      toast.error("No se pudo registrar el aporte.")
    } finally {
      setFundPending(false)
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || newTarget <= 0) return
    setCreatePending(true)
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          targetAmount: newTarget,
          deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        console.error("[Goals] POST error:", res.status, errBody)
        throw new Error()
      }
      const created: Goal = await res.json()
      setGoals((prev) => [...prev, created])
      toast.success("¡Meta creada!")
      setCreating(false)
      setNewTitle("")
      setNewTarget(0)
      setNewDeadline("")
    } catch {
      toast.error("No se pudo crear la meta.")
    } finally {
      setCreatePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Vaulty Goals</h2>
          <p className="text-sm text-muted-foreground">Seguí el progreso de tus metas de ahorro</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:from-pink-600 hover:to-violet-700"
        >
          <Plus className="size-4" />
          Nueva Meta
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <PigIcon className="size-24 opacity-60" />
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-foreground">Todavía no tenés metas de ahorro</p>
            <p className="text-sm text-muted-foreground">
              Creá tu primera meta y empezá a hacer crecer tu plata 🐷
            </p>
          </div>
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:from-pink-600 hover:to-violet-700"
          >
            <Plus className="size-4" />
            Crear primera meta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onAddFunds={setFundTarget} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEdit() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-muted-foreground" />
              Editar meta
            </DialogTitle>
          </DialogHeader>

          {editTarget && !confirmDelete && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Monto objetivo</Label>
                <MoneyInput value={editTargetAmount} onChange={setEditTargetAmount} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Monto ahorrado actual</Label>
                <MoneyInput value={editCurrentAmount} onChange={setEditCurrentAmount} />
                <p className="text-[11px] text-muted-foreground">
                  Ajustá este valor si lo cargaste mal.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Fecha límite (opcional)</Label>
                <Input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                />
              </div>
            </div>
          )}

          {confirmDelete && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              ¿Seguro que querés eliminar la meta{" "}
              <strong>"{editTarget?.title}"</strong>? Esta acción no se puede deshacer.
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!confirmDelete ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
                <div className="flex flex-1 justify-end gap-2">
                  <Button variant="outline" onClick={closeEdit}>Cancelar</Button>
                  <Button
                    disabled={!editTitle.trim() || editTargetAmount <= 0 || editPending}
                    onClick={handleEdit}
                    className="bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:from-pink-600 hover:to-violet-700"
                  >
                    {editPending ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={editPending}
                  onClick={handleDelete}
                >
                  {editPending ? "Eliminando..." : "Sí, eliminar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add-funds modal ────────────────────────────────────────────────── */}
      <Dialog open={!!fundTarget} onOpenChange={(open) => { if (!open) { setFundTarget(null); setFundAmount(0) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PigIcon className="size-8" />
              Aportar a meta
            </DialogTitle>
          </DialogHeader>
          {fundTarget && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Meta: <strong className="text-foreground">{fundTarget.title}</strong>
              </p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Monto a aportar</Label>
                <MoneyInput value={fundAmount} onChange={setFundAmount} />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Saldo actual:{" "}
                <strong className="text-foreground">{formatARS(fundTarget.currentAmount)}</strong>
                {" / "}
                {formatARS(fundTarget.targetAmount)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFundTarget(null); setFundAmount(0) }}>
              Cancelar
            </Button>
            <Button
              disabled={fundAmount <= 0 || fundPending}
              onClick={handleAddFunds}
              className="bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:from-pink-600 hover:to-violet-700"
            >
              {fundPending ? "Aportando..." : "Confirmar Aporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create modal ───────────────────────────────────────────────────── */}
      <Dialog open={creating} onOpenChange={(open) => { if (!open) { setCreating(false); setNewTitle(""); setNewTarget(0); setNewDeadline("") } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PigIcon className="size-8" />
              Nueva Meta de Ahorro
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Nombre de la meta</Label>
              <Input
                placeholder="Ej: Viaje a Brasil (Diciembre 2026)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Monto objetivo</Label>
              <MoneyInput value={newTarget} onChange={setNewTarget} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fecha límite (opcional)</Label>
              <Input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setNewTitle(""); setNewTarget(0); setNewDeadline("") }}>
              Cancelar
            </Button>
            <Button
              disabled={!newTitle.trim() || newTarget <= 0 || createPending}
              onClick={handleCreate}
              className="bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:from-pink-600 hover:to-violet-700"
            >
              {createPending ? "Creando..." : "Crear Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

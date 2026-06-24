"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  Link2,
  Plus,
  TrendingDown,
  TrendingUp,
  Check,
  X,
  ExternalLink,
  Trash2,
  Loader2,
  Package,
  Circle,
  CheckCircle2,
  Pencil,
  ImageIcon,
  Puzzle,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { formatARS } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoneyInput } from "@/components/money-input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  trackProductManual,
  updateTrackedProductPrice,
  updateTrackedProductDetails,
  toggleWishlistItem,
  deleteTrackedProduct,
} from "@/app/actions/products"

export interface PricePoint {
  date: string // YYYY-MM-DD
  price: number
}

export interface TrackedProduct {
  id: string
  url: string
  name: string
  store: string
  imageUrl: string | null
  price: number
  checked: boolean
  collection: string | null
  priceHistory: PricePoint[]
}

interface Props {
  initialProducts: TrackedProduct[]
}

function formatRegisteredDate(dateStr: string): string {
  const months = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."]
  const [year, month, day] = dateStr.split("-")
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

export function PriceTrackerTab({ initialProducts }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [products, setProducts] = useState<TrackedProduct[]>(initialProducts)
  const mounted = useMounted()

  // Add form (manual)
  const [addName, setAddName] = useState("")
  const [addLink, setAddLink] = useState("")
  const [addPrice, setAddPrice] = useState(0)
  const [addImage, setAddImage] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  // Drawer
  const [drawerProduct, setDrawerProduct] = useState<TrackedProduct | null>(null)
  const [editName, setEditName] = useState("")
  const [editLink, setEditLink] = useState("")
  const [editImageUrl, setEditImageUrl] = useState("")
  const [editDrawerPrice, setEditDrawerPrice] = useState(0)
  const [savingDetails, setSavingDetails] = useState(false)
  const [savingDrawerPrice, setSavingDrawerPrice] = useState(false)

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  // Keep drawer state in sync when products refresh
  useEffect(() => {
    if (!drawerProduct) return
    const refreshed = products.find((p) => p.id === drawerProduct.id)
    if (refreshed) setDrawerProduct(refreshed)
  }, [products]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkedCount = products.filter((p) => p.checked).length

  // Sort: unchecked first, then checked
  const sorted = [...products].sort((a, b) => {
    if (a.checked === b.checked) return 0
    return a.checked ? 1 : -1
  })

  function openDrawer(product: TrackedProduct) {
    setDrawerProduct(product)
    setEditName(product.name)
    setEditLink(product.url || "")
    setEditImageUrl(product.imageUrl ?? "")
    setEditDrawerPrice(product.price)
  }

  function handleAddManual() {
    const name = addName.trim()
    if (!name || addPrice <= 0) return
    setIsAdding(true)
    startTransition(async () => {
      try {
        await trackProductManual(addLink.trim(), {
          name,
          price: addPrice,
          imageUrl: addImage.trim() || null,
        })
        setAddName("")
        setAddLink("")
        setAddPrice(0)
        setAddImage("")
        router.refresh()
        toast.success("Producto agregado a tu wishlist.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo agregar el producto.")
      } finally {
        setIsAdding(false)
      }
    })
  }

  function handleToggleCheck(product: TrackedProduct) {
    const next = !product.checked
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, checked: next } : p)))
    startTransition(async () => {
      try {
        await toggleWishlistItem(product.id, next)
        router.refresh()
      } catch {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, checked: !next } : p)))
      }
    })
  }

  function handleDelete(product: TrackedProduct) {
    const snapshot = products
    if (drawerProduct?.id === product.id) setDrawerProduct(null)
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
    startTransition(async () => {
      try {
        await deleteTrackedProduct(product.id)
        router.refresh()
      } catch {
        setProducts(snapshot)
      }
    })
  }

  function handleSaveDetails() {
    if (!drawerProduct) return
    setSavingDetails(true)
    startTransition(async () => {
      try {
        await updateTrackedProductDetails(drawerProduct.id, {
          name: editName,
          url: editLink.trim(),
          imageUrl: editImageUrl.trim() || null,
        })
        router.refresh()
        toast.success("Cambios guardados.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.")
      } finally {
        setSavingDetails(false)
      }
    })
  }

  function handleSaveDrawerPrice() {
    if (!drawerProduct || editDrawerPrice <= 0) return
    setSavingDrawerPrice(true)
    startTransition(async () => {
      try {
        await updateTrackedProductPrice(drawerProduct.id, editDrawerPrice)
        router.refresh()
        toast.success("Precio actualizado.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar el precio.")
      } finally {
        setSavingDrawerPrice(false)
      }
    })
  }

  // ── Drawer ──────────────────────────────────────────────────────────────────

  const drawerHistory = drawerProduct?.priceHistory ?? []
  const drawerInitialPrice = drawerHistory[0]?.price ?? null
  const drawerTrendPct =
    drawerHistory.length >= 2 && drawerInitialPrice != null && drawerInitialPrice > 0
      ? ((drawerProduct!.price - drawerInitialPrice) / drawerInitialPrice) * 100
      : null

  // ── Render ──────────────────────────────────────────────────────────────────

  function renderCard(product: TrackedProduct) {
    const history = product.priceHistory
    const initialPrice = history[0]?.price ?? null
    const hasTrend = history.length >= 2 && initialPrice != null && initialPrice > 0
    const trendPct = hasTrend ? ((product.price - initialPrice!) / initialPrice!) * 100 : null
    const down = trendPct != null && trendPct < 0
    const up = trendPct != null && trendPct > 0
    const lineColor = down ? "#10b981" : up ? "#ef4444" : "#f472b6"

    return (
      <Card
        key={product.id}
        className={cn(
          "relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
          product.checked
            ? "border-emerald-300 bg-emerald-50/50 hover:ring-emerald-300 hover:shadow-emerald-100/60"
            : "hover:ring-pink-300 hover:shadow-pink-100/60",
        )}
      >
        <CardContent className="flex h-full flex-col gap-4 pt-4">
          {/* Checkbox — top-right absolute */}
          <Button
            size="icon-xs"
            variant="ghost"
            className={cn(
              "absolute top-3 right-3 transition-colors",
              product.checked
                ? "text-emerald-600 hover:text-emerald-700"
                : "text-muted-foreground hover:text-emerald-600",
            )}
            onClick={() => handleToggleCheck(product)}
            disabled={isPending}
            aria-label={product.checked ? "Marcar como pendiente" : "Marcar como conseguido"}
            title={product.checked ? "Marcar como pendiente" : "Marcar como conseguido"}
          >
            {product.checked ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
          </Button>

          {/* Top content row */}
          <div className="flex items-start gap-4 pr-7">
            {/* Image — click to open drawer */}
            <button
              type="button"
              onClick={() => openDrawer(product)}
              className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted transition-opacity hover:opacity-80"
              aria-label={`Ver detalle de ${product.name}`}
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className={cn("size-full object-cover", product.checked && "opacity-50")}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package className="size-8 text-muted-foreground" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              {/* Name — click to open drawer */}
              <button
                type="button"
                onClick={() => openDrawer(product)}
                className="w-full text-left text-foreground hover:text-primary"
              >
                <span
                  className={cn(
                    "line-clamp-2 font-semibold leading-snug",
                    product.checked && "text-muted-foreground line-through",
                  )}
                >
                  {product.name}
                </span>
              </button>

              <p className="mt-0.5 text-xs text-muted-foreground">{product.store}</p>

              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    product.checked ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {formatARS(product.price)}
                </span>
                {trendPct != null && (down || up) && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs font-medium",
                      down ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {down ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
                    {Math.abs(trendPct).toFixed(1)}%
                  </span>
                )}
                {product.checked && (
                  <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <CheckCircle2 className="size-3" />
                    Conseguido
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Mini chart */}
          {mounted && history.length > 1 && (
            <div className="h-16 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={history}>
                  <Tooltip
                    formatter={(value) => formatARS(value as number)}
                    labelFormatter={(label) => label as string}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      fontSize: "0.7rem",
                      padding: "2px 6px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bottom row: date + actions */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-muted-foreground">
              {history[0]?.date
                ? `Registrado el ${formatRegisteredDate(history[0].date)}`
                : "Sin historial"}
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                className="hover:text-primary"
                onClick={() => openDrawer(product)}
                disabled={isPending}
                aria-label={`Editar ${product.name}`}
                title="Editar producto"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                className="hover:text-destructive"
                onClick={() => handleDelete(product)}
                disabled={isPending}
                aria-label={`Eliminar ${product.name}`}
                title="Quitar de la wishlist"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Wishlist</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "item" : "items"} ·{" "}
            {checkedCount} {checkedCount === 1 ? "conseguido" : "conseguidos"}
          </p>
        </div>
      </div>

      {/* Add form — manual */}
      <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-pink-300 hover:shadow-md hover:shadow-pink-100/60">
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-xs font-medium text-muted-foreground">Agregar producto a tu wishlist</p>

          {/* Row 1: nombre + precio */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">Nombre <span className="text-destructive">*</span></Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Ej: Zapatillas Nike Air Max"
                className="text-sm"
                disabled={isAdding}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddManual() }}
              />
            </div>
            <div className="sm:w-40">
              <Label className="mb-1 block text-xs text-muted-foreground">Precio <span className="text-destructive">*</span></Label>
              <MoneyInput value={addPrice} onChange={setAddPrice} disabled={isAdding} />
            </div>
          </div>

          {/* Row 2: link + imagen */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">Link (opcional)</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addLink}
                  onChange={(e) => setAddLink(e.target.value)}
                  placeholder="https://tienda.com/producto"
                  className="pl-8 text-sm"
                  disabled={isAdding}
                />
              </div>
            </div>
            <div className="flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">Imagen URL (opcional)</Label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addImage}
                  onChange={(e) => setAddImage(e.target.value)}
                  placeholder="https://..."
                  className="pl-8 text-sm"
                  disabled={isAdding}
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleAddManual}
            disabled={isAdding || !addName.trim() || addPrice <= 0}
            className="gap-1.5 self-end bg-gradient-to-r from-pink-500 to-violet-600 transition-all duration-300 hover:from-pink-600 hover:to-violet-700 hover:shadow-md hover:shadow-pink-500/25"
          >
            {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {isAdding ? "Guardando…" : "Agregar a la wishlist"}
          </Button>
        </CardContent>
      </Card>

      {/* Extension install instructions */}
      <Card className="border-pink-200 bg-pink-50/60 dark:border-pink-900 dark:bg-pink-950/20">
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex items-center gap-2">
            <Puzzle className="size-4 shrink-0 text-pink-500 dark:text-pink-400" />
            <p className="text-sm font-semibold text-pink-800 dark:text-pink-300">
              Agregar productos desde cualquier tienda con la extensión
            </p>
          </div>
          <p className="text-xs text-pink-700 dark:text-pink-400">
            La extensión del navegador te permite agregar cualquier producto a tu wishlist con un solo clic,
            sin necesidad de copiar links ni precios manualmente.
          </p>
          <a
            href="/vaulty-extension.zip"
            download="vaulty-extension.zip"
            className="inline-flex w-fit items-center gap-1.5 rounded-md bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-pink-600 transition-colors"
          >
            Descargar extensión (.zip)
          </a>
          <ol className="flex flex-col gap-1.5 text-xs text-pink-700 dark:text-pink-400">
            <li className="flex gap-2">
              <span className="font-bold shrink-0">1.</span>
              <span>Descargá el archivo <strong>.zip</strong> con el botón de arriba y descomprimilo en tu computadora.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">2.</span>
              <span>
                Abrí{" "}
                <code className="rounded bg-pink-200/70 px-1 py-0.5 font-mono text-pink-900 dark:bg-pink-900/50 dark:text-pink-200">
                  brave://extensions
                </code>{" "}
                o{" "}
                <code className="rounded bg-pink-200/70 px-1 py-0.5 font-mono text-pink-900 dark:bg-pink-900/50 dark:text-pink-200">
                  chrome://extensions
                </code>{" "}
                en tu navegador.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">3.</span>
              <span>Activá el <strong>Modo desarrollador</strong> (toggle en la esquina superior derecha).</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">4.</span>
              <span>
                Hacé clic en <strong>Cargar descomprimida</strong> y seleccioná la carpeta descomprimida.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">5.</span>
              <span>Fijá el ícono en la barra del navegador para tenerlo siempre a mano.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">6.</span>
              <span>
                Entrá a la página de cualquier producto y hacé clic en el ícono de la extensión — se agrega
                directo a tu wishlist.
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <span className="text-4xl">🛍️</span>
          <p className="text-sm">Agregá productos para armar tu wishlist.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {sorted.map(renderCard)}
        </div>
      )}

      {/* Product detail drawer */}
      <Sheet
        open={!!drawerProduct}
        onOpenChange={(open) => { if (!open) setDrawerProduct(null) }}
      >
        {drawerProduct && (
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Editar producto</SheetTitle>
              {drawerProduct.url && (
                <SheetDescription>
                  <a
                    href={drawerProduct.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                  >
                    Ver en {drawerProduct.store}
                    <ExternalLink className="size-3" />
                  </a>
                </SheetDescription>
              )}
            </SheetHeader>

            {/* Image */}
            {drawerProduct.imageUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={drawerProduct.imageUrl}
                  alt={drawerProduct.name}
                  className="h-40 w-full rounded-xl object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Price + trend */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums">{formatARS(drawerProduct.price)}</span>
              {drawerTrendPct != null && drawerTrendPct !== 0 && (
                <span className={cn("flex items-center gap-0.5 text-sm font-medium", drawerTrendPct < 0 ? "text-emerald-600" : "text-destructive")}>
                  {drawerTrendPct < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                  {Math.abs(drawerTrendPct).toFixed(1)}%
                </span>
              )}
              {drawerProduct.checked && (
                <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  <CheckCircle2 className="size-3" />
                  Conseguido
                </Badge>
              )}
            </div>

            {/* History chart */}
            {mounted && drawerHistory.length > 1 && (
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={drawerHistory}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value) => formatARS(value as number)}
                      labelFormatter={(label) => label as string}
                      contentStyle={{ borderRadius: "0.5rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", fontSize: "0.7rem", padding: "2px 6px" }}
                    />
                    <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Edit details */}
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Editar información</p>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-sm" disabled={savingDetails} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Link (opcional)</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={editLink} onChange={(e) => setEditLink(e.target.value)} placeholder="https://..." className="pl-8 text-sm" disabled={savingDetails} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Imagen URL (opcional)</Label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://..." className="pl-8 text-sm" disabled={savingDetails} />
                </div>
              </div>
              <Button
                onClick={handleSaveDetails}
                disabled={savingDetails || isPending || !editName.trim()}
                className="w-full gap-1.5 hover:bg-primary/90"
              >
                {savingDetails ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Guardar cambios
              </Button>
            </div>

            {/* Update price */}
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Actualizar precio</p>
              <div className="flex items-center gap-2">
                <MoneyInput value={editDrawerPrice} onChange={setEditDrawerPrice} className="flex-1" disabled={savingDrawerPrice} />
                <Button
                  size="icon-sm"
                  onClick={handleSaveDrawerPrice}
                  disabled={savingDrawerPrice || isPending || editDrawerPrice <= 0}
                  className="shrink-0 hover:bg-primary/90"
                  aria-label="Guardar precio"
                >
                  {savingDrawerPrice ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                </Button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 border-t pt-2">
              <Button
                variant={drawerProduct.checked ? "default" : "outline"}
                size="sm"
                className={cn("flex-1 gap-1.5", drawerProduct.checked && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => handleToggleCheck(drawerProduct)}
                disabled={isPending}
              >
                {drawerProduct.checked ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                {drawerProduct.checked ? "Marcar pendiente" : "Marcar conseguido"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 hover:text-destructive"
                onClick={() => handleDelete(drawerProduct)}
                disabled={isPending}
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </Button>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}

// Backward compat for tools-tab.tsx
export { PriceTrackerTab as PriceTracker }

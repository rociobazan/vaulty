"use client"

import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Swords, MapPin, Link2, ArrowRight, Trophy, Package } from "lucide-react"

import { formatARS } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

const COMPARISON = [
  { name: "Opción A", precio: 489000, envio: 38000, ahorro: -12000 },
  { name: "Opción B", precio: 505000, envio: 0, ahorro: -41000 },
]

export function ComparadorTab({ onSimulate }: { onSimulate?: () => void }) {
  const [cp, setCp] = useState("1414")
  const [linkA, setLinkA] = useState("")
  const [linkB, setLinkB] = useState("")
  const mounted = useMounted()

  const totalA = COMPARISON[0].precio + COMPARISON[0].envio
  const totalB = COMPARISON[1].precio + COMPARISON[1].envio
  const winner = totalB <= totalA ? "B" : "A"
  const savings = Math.abs(totalA - totalB)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Comparador de Costo Real</h2>
        <p className="text-sm text-muted-foreground">
          Ingresá tu código postal y los links de ambas opciones para comparar el costo total real.
        </p>
      </div>

      {/* Postal code */}
      <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
        <CardContent className="py-4">
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="cp" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              Tu Código Postal
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cp"
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                placeholder="Ej. 1414"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Option inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-l-4 border-l-chart-2 transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2">
                  <Package className="size-4" />
                </span>
                Opción A
              </span>
              <Badge variant="outline" className="tabular-nums text-xs">
                {formatARS(totalA)} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkA" className="text-xs text-muted-foreground">
                Link del producto
              </Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="linkA"
                  value={linkA}
                  onChange={(e) => setLinkA(e.target.value)}
                  placeholder="Pegar link Opción A"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Precio base</p>
                <p className="font-semibold tabular-nums">{formatARS(COMPARISON[0].precio)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Envío</p>
                <p className="font-semibold tabular-nums text-destructive">
                  +{formatARS(COMPARISON[0].envio)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Package className="size-4" />
                </span>
                Opción B
              </span>
              <Badge variant="outline" className="tabular-nums text-xs">
                {formatARS(totalB)} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkB" className="text-xs text-muted-foreground">
                Link del producto
              </Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="linkB"
                  value={linkB}
                  onChange={(e) => setLinkB(e.target.value)}
                  placeholder="Pegar link Opción B"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Precio base</p>
                <p className="font-semibold tabular-nums">{formatARS(COMPARISON[1].precio)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Envío</p>
                <p className="font-semibold tabular-nums text-primary">GRATIS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Battle chart */}
      <Card className="transition-all duration-300 hover:-translate-y-1 hover:ring-violet-300 hover:shadow-md hover:shadow-violet-100/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Swords className="size-4" />
            </span>
            Comparativa de Costos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="h-80 w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={COMPARISON}
                  margin={{ top: 24, right: 16, bottom: 0, left: 16 }}
                  stackOffset="sign"
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 13, fill: "var(--foreground)", fontWeight: 600 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    width={52}
                  />
                  <ReferenceLine y={0} stroke="var(--foreground)" strokeOpacity={0.2} />
                  <Tooltip
                    formatter={(value, name) => [formatARS(Math.abs(value as number)), String(name)]}
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Bar
                    dataKey="precio"
                    name="Precio base"
                    stackId="combate"
                    fill="var(--chart-2)"
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="envio"
                    name="Envío / Interés"
                    stackId="combate"
                    fill="var(--destructive)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="envio"
                      position="top"
                      formatter={(v) => ((v as number) > 0 ? `+${formatARS(v as number)}` : "Gratis")}
                      style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                  </Bar>
                  <Bar
                    dataKey="ahorro"
                    name="Ahorro por inflación"
                    stackId="combate"
                    fill="var(--primary)"
                    radius={[0, 0, 4, 4]}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="ahorro"
                      position="bottom"
                      formatter={(v) => formatARS(Math.abs(v as number))}
                      style={{ fill: "var(--primary)", fontSize: 11, fontWeight: 600 }}
                    />
                    {COMPARISON.map((entry) => (
                      <Cell key={entry.name} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-chart-2" />
              Precio base
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-destructive" />
              Envío / Interés
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary" />
              Ahorro x inflación
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Verdict */}
      <Alert className="border-primary/30 bg-primary/10">
        <Trophy className="size-4 text-primary" />
        <AlertTitle className="text-foreground">Gana la opción {winner}</AlertTitle>
        <AlertDescription>
          Con envío gratis y cuotas sin interés, la opción {winner} te ahorra{" "}
          <strong className="tabular-nums text-foreground">{formatARS(savings)}</strong> frente a la
          inflación mensual.
        </AlertDescription>
      </Alert>

      <Button
        onClick={onSimulate}
        className="w-full gap-2 transition-all duration-300 hover:bg-primary/90"
        size="lg"
      >
        Simular en mi Presupuesto
        <ArrowRight className="size-4" />
      </Button>
    </div>
  )
}

// Backward compat for tools-tab.tsx
export { ComparadorTab as CostComparator }

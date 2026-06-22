"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { formatARS } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"

export interface DonutSlice {
  name: string
  value: number
  color: string
}

export function BudgetDonut({
  data,
  total,
}: {
  data: DonutSlice[]
  total: number
}) {
  const mounted = useMounted()
  const hasData = data.some((d) => d.value > 0)
  const chartData = hasData
    ? data.filter((d) => d.value > 0)
    : [{ name: "Sin asignar", value: 1, color: "var(--muted)" }]

  return (
    <div className="relative h-52 w-full">
      {mounted && (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={hasData ? 2 : 0}
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          {hasData && (
            <Tooltip
              formatter={(value) => formatARS(value as number)}
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                fontSize: "0.8rem",
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      )}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">Gastos planificados</span>
        <span className="text-xl font-bold tabular-nums text-foreground">
          {formatARS(total)}
        </span>
      </div>
    </div>
  )
}

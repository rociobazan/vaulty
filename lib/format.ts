// Formateadores para pesos argentinos ($)

export function formatARS(value: number, withDecimals = false): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

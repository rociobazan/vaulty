// INDEC IPC Nacional — datos.gob.ar (free, no auth required)
// Series: Índice de Precios al Consumidor. Nivel General. Base diciembre 2016 = 100.
const IPC_URL =
  "https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=120&format=json&sort=asc"

export interface IpcPoint {
  date: string   // YYYY-MM-01 (always first of month)
  index: number  // level index (Dec 2016 = 100)
}

declare global {
  // eslint-disable-next-line no-var
  var __ipcCache: { data: IpcPoint[]; expiresAt: number } | undefined
}

export async function getIpcHistory(): Promise<IpcPoint[]> {
  if (globalThis.__ipcCache && Date.now() < globalThis.__ipcCache.expiresAt) {
    return globalThis.__ipcCache.data
  }

  const res = await fetch(IPC_URL, {
    cache: "no-store",
    headers: { "User-Agent": "Vaulty/1.0" },
  })
  if (!res.ok) throw new Error(`IPC API responded with ${res.status}`)

  const json: { data: [string, number | null][] } = await res.json()

  const data: IpcPoint[] = json.data
    .filter(([, v]) => v != null)
    .map(([date, index]) => ({ date: date.slice(0, 10), index: index as number }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Cache for 24 hours — IPC is published once per month
  globalThis.__ipcCache = { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }
  return data
}

// Pure helper — safe to use on client-side too.
// Returns the most recent IPC index published at or before the given date.
export function getIpcForDate(history: IpcPoint[], date: string): number | null {
  let result: number | null = null
  for (const p of history) {
    if (p.date <= date) result = p.index
    else break
  }
  return result
}

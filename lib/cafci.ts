import * as XLSX from "xlsx"

export interface CafciFund {
  cafciId: number
  name: string
  gestora: string
  currency: string   // "ARS" | "USD"
  currentPrice: number
  priceDate: string  // dd/mm/yy — date the CAFCI file was generated
}

// Bump this when the parsing logic changes to bust the globalThis cache automatically
const CACHE_VERSION = 2

// Persist across hot-reloads in dev mode via globalThis
declare global {
  // eslint-disable-next-line no-var
  var __cafciCache: { version: number; data: CafciFund[]; expiresAt: number } | undefined
}

async function fetchAllFunds(): Promise<CafciFund[]> {
  if (
    globalThis.__cafciCache &&
    globalThis.__cafciCache.version === CACHE_VERSION &&
    Date.now() < globalThis.__cafciCache.expiresAt
  ) {
    return globalThis.__cafciCache.data
  }

  const res = await fetch("https://api.pub.cafci.org.ar/pb_get", {
    cache: "no-store",
    headers: { "User-Agent": "Vaulty/1.0" },
  })
  if (!res.ok) throw new Error(`CAFCI API responded with ${res.status}`)

  const buffer = await res.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  const funds: CafciFund[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length < 21) continue

    const cafciId = Number(row[20])      // Column U: CodCAFCI
    const name = row[0] != null ? String(row[0]).trim() : ""
    const priceRaw = Number(row[5]) / 1000  // Column F: VCP per 1.000 cuotapartes → normalize to per 1
    const gestora = row[23] != null ? String(row[23]).trim() : ""

    if (!Number.isFinite(cafciId) || cafciId === 0 || !Number.isFinite(priceRaw) || !name) continue

    // Column B (index 1): currency code ("ARS" or "USD")
    const currency = row[1] != null ? String(row[1]).trim() : "ARS"

    funds.push({ cafciId, name, gestora, currency, currentPrice: priceRaw, priceDate: "" })
  }

  // Stamp all entries with today's date (the CAFCI file always reflects the current trading day)
  const now = new Date()
  const priceDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`
  for (const f of funds) f.priceDate = priceDate

  globalThis.__cafciCache = { version: CACHE_VERSION, data: funds, expiresAt: Date.now() + 6 * 60 * 60 * 1000 }
  return funds
}

export async function searchFunds(query: string): Promise<CafciFund[]> {
  const all = await fetchAllFunds()
  const q = query.trim().toLowerCase()
  if (!q) return all.slice(0, 25)

  return all
    .filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.gestora.toLowerCase().includes(q),
    )
    .slice(0, 30)
}

export async function getPricesByIds(
  ids: number[],
): Promise<Map<number, { currentPrice: number; priceDate: string }>> {
  const all = await fetchAllFunds()
  const idSet = new Set(ids)
  const result = new Map<number, { currentPrice: number; priceDate: string }>()
  for (const f of all) {
    if (idSet.has(f.cafciId)) {
      result.set(f.cafciId, { currentPrice: f.currentPrice, priceDate: f.priceDate })
    }
  }
  return result
}

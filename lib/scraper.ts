import * as cheerio from "cheerio"

export interface ScrapedProduct {
  name: string
  imageUrl: string | null
  price: number
  store: string
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

export function detectStore(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "")
  if (host.includes("mercadolibre") || host.includes("mercadolivre")) return "MercadoLibre"
  if (host.includes("fravega")) return "Frávega"
  if (host.includes("garbarino")) return "Garbarino"
  if (host.includes("musimundo")) return "Musimundo"
  return host
}

function extractMercadoLibreItemId(url: string): string | null {
  const parsed = new URL(url)

  // Product pages copy the seller's listing into pdp_filters=item_id:MLA1234567890
  const pdpFilters = parsed.searchParams.get("pdp_filters")
  if (pdpFilters) {
    const match = pdpFilters.match(/item_id:([A-Z]{2,4}\d+)/i)
    if (match) return match[1].toUpperCase()
  }

  const itemIdParam = parsed.searchParams.get("item_id")
  if (itemIdParam && /^[A-Z]{2,4}\d+$/i.test(itemIdParam)) {
    return itemIdParam.toUpperCase()
  }

  // articulo.mercadolibre.com.ar/MLA-1234567890-slug
  const dashed = parsed.pathname.match(/\/([A-Z]{2,4})-(\d{5,})/i)
  if (dashed) return `${dashed[1].toUpperCase()}${dashed[2]}`

  return null
}

interface MercadoLibreItem {
  title?: string
  price?: number
  thumbnail?: string
  pictures?: { url?: string; secure_url?: string }[]
}

async function fetchFromMercadoLibreApi(itemId: string): Promise<ScrapedProduct | null> {
  const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, { cache: "no-store" })
  if (!res.ok) return null

  const data = (await res.json()) as MercadoLibreItem
  if (typeof data.price !== "number" || data.price <= 0) return null

  const picture = data.pictures?.[0]
  const imageUrl =
    picture?.secure_url ?? picture?.url ?? data.thumbnail?.replace(/^http:/, "https:") ?? null

  return {
    name: data.title?.trim() || "Producto sin nombre",
    imageUrl,
    price: Math.round(data.price),
    store: "MercadoLibre",
  }
}

export function parsePrice(raw: string): number | null {
  // "699.999,50" / "699999.50" / "699999" → 699999.5
  const cleaned = raw.trim().replace(/[^\d.,]/g, "")
  if (!cleaned) return null
  const normalized =
    cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const value = parseFloat(normalized)
  return Number.isFinite(value) ? value : null
}

function extractFromJsonLd($: cheerio.CheerioAPI): number | null {
  let price: number | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    if (price != null) return
    const raw = $(el).contents().text()
    if (!raw) return
    try {
      const json = JSON.parse(raw)
      const candidates = Array.isArray(json) ? json : [json]
      for (const item of candidates) {
        const offers = item?.offers
        const offer = Array.isArray(offers) ? offers[0] : offers
        const p = offer?.price ?? offer?.lowPrice
        if (p != null) {
          const parsed = typeof p === "number" ? p : parsePrice(String(p))
          if (parsed != null) {
            price = parsed
            break
          }
        }
      }
    } catch {
      // malformed JSON-LD block — ignore and keep looking
    }
  })
  return price
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const parsed = new URL(url) // throws if invalid
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("La URL debe empezar con http:// o https://")
  }

  const store = detectStore(url)

  if (store === "MercadoLibre") {
    const itemId = extractMercadoLibreItemId(url)
    if (itemId) {
      const fromApi = await fetchFromMercadoLibreApi(itemId)
      if (fromApi) return fromApi
    }
  }

  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "es-AR,es;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  })
  if (!res.ok) {
    throw new Error(`No se pudo acceder a la página (HTTP ${res.status}).`)
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  const name =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    "Producto sin nombre"

  const imageUrl = $('meta[property="og:image"]').attr("content")?.trim() || null

  let price = extractFromJsonLd($)

  if (price == null) {
    const metaPrice =
      $('meta[itemprop="price"]').attr("content") ??
      $('meta[property="product:price:amount"]').attr("content")
    if (metaPrice) price = parsePrice(metaPrice)
  }

  if (price == null) {
    // MercadoLibre's visible price markup
    const fraction = $(".andes-money-amount__fraction").first().text()
    if (fraction) price = parsePrice(fraction)
  }

  if (price == null) {
    // Generic VTEX/e-commerce fallback (Frávega and similar storefronts)
    const text = $('[class*="price" i]')
      .filter((_, el) => /\d/.test($(el).text()))
      .first()
      .text()
    if (text) price = parsePrice(text)
  }

  if (price == null || price <= 0) {
    throw new Error("No se pudo encontrar el precio en la página. Verificá que el link sea correcto.")
  }

  return { name, imageUrl, price: Math.round(price), store }
}

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { detectStore, parsePrice } from "@/lib/scraper"

function redirectWithQuery(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/?tab=precios&${query}`, request.url))
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL("/login", request.url))

  const params = request.nextUrl.searchParams
  const url = params.get("url")?.trim()
  const name = params.get("name")?.trim() || "Producto sin nombre"
  const rawPrice = params.get("price")?.trim()
  const image = params.get("image")?.trim() || null
  const collection = params.get("collection")?.trim() || null

  if (!url) {
    return redirectWithQuery(request, `trackerError=${encodeURIComponent("Falta la URL del producto.")}`)
  }

  const price = rawPrice ? parsePrice(rawPrice) : null
  if (price == null || price <= 0) {
    return redirectWithQuery(
      request,
      `trackerError=${encodeURIComponent("No se pudo leer el precio desde la página. Probá agregarlo a mano.")}`,
    )
  }

  const rounded = Math.round(price)
  const today = new Date().toISOString().slice(0, 10)

  await prisma.trackedProduct.create({
    data: {
      userId: session.id,
      url,
      name,
      store: detectStore(url),
      imageUrl: image,
      price: rounded,
      checked: false,
      collection,
      priceHistory: [{ date: today, price: rounded }] as Prisma.InputJsonValue,
    },
  })

  return redirectWithQuery(request, "tracked=1")
}

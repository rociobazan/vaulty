"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { scrapeProduct, detectStore } from "@/lib/scraper"

export interface PricePoint {
  date: string // YYYY-MM-DD
  price: number
}

async function requireOwnership(id: string, userId: string) {
  const product = await prisma.trackedProduct.findFirst({ where: { id, userId } })
  if (!product) throw new Error("Producto no encontrado o no autorizado")
  return product
}

export async function trackProduct(url: string, collection?: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const trimmed = url.trim()
  if (!trimmed) throw new Error("Pegá un link para agregar a la wishlist.")

  const scraped = await scrapeProduct(trimmed)
  const today = new Date().toISOString().slice(0, 10)

  const product = await prisma.trackedProduct.create({
    data: {
      userId: session.id,
      url: trimmed,
      name: scraped.name,
      store: scraped.store,
      imageUrl: scraped.imageUrl,
      price: scraped.price,
      checked: false,
      collection: collection?.trim() || null,
      priceHistory: [{ date: today, price: scraped.price }] as Prisma.InputJsonValue,
    },
  })

  revalidatePath("/")
  return product
}

export async function trackProductManual(
  url: string,
  data: { name: string; price: number; imageUrl: string | null; collection?: string },
) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const trimmed = url.trim()

  const name = data.name.trim()
  if (!name) throw new Error("Ingresá un nombre para el producto.")
  if (!Number.isFinite(data.price) || data.price <= 0) {
    throw new Error("Ingresá un precio válido.")
  }

  const price = Math.round(data.price)
  const today = new Date().toISOString().slice(0, 10)

  const product = await prisma.trackedProduct.create({
    data: {
      userId: session.id,
      url: trimmed,
      name,
      store: trimmed ? detectStore(trimmed) : "Manual",
      imageUrl: data.imageUrl?.trim() || null,
      price,
      checked: false,
      collection: data.collection?.trim() || null,
      priceHistory: [{ date: today, price }] as Prisma.InputJsonValue,
    },
  })

  revalidatePath("/")
  return product
}

export async function updateTrackedProductPrice(id: string, price: number) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  if (!Number.isFinite(price) || price <= 0) throw new Error("Ingresá un precio válido.")

  const product = await requireOwnership(id, session.id)

  const rounded = Math.round(price)
  const today = new Date().toISOString().slice(0, 10)
  const history = (product.priceHistory as PricePoint[] | null) ?? []
  const updatedHistory = [...history.filter((h) => h.date !== today), { date: today, price: rounded }]

  const updated = await prisma.trackedProduct.update({
    where: { id },
    data: {
      price: rounded,
      priceHistory: updatedHistory as unknown as Prisma.InputJsonValue,
    },
  })

  revalidatePath("/")
  return updated
}

export async function refreshTrackedProduct(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const product = await requireOwnership(id, session.id)

  const scraped = await scrapeProduct(product.url)
  const today = new Date().toISOString().slice(0, 10)

  const history = (product.priceHistory as PricePoint[] | null) ?? []
  const updatedHistory = [...history.filter((h) => h.date !== today), { date: today, price: scraped.price }]

  const updated = await prisma.trackedProduct.update({
    where: { id },
    data: {
      name: scraped.name,
      imageUrl: scraped.imageUrl ?? product.imageUrl,
      price: scraped.price,
      priceHistory: updatedHistory as unknown as Prisma.InputJsonValue,
    },
  })

  revalidatePath("/")
  return updated
}

export async function updateTrackedProductDetails(
  id: string,
  payload: { name?: string; collection?: string | null; url?: string; imageUrl?: string | null },
) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  await requireOwnership(id, session.id)

  const data: { name?: string; collection?: string | null; url?: string; imageUrl?: string | null } = {}
  if (payload.name !== undefined) data.name = payload.name.trim() || undefined
  if (payload.collection !== undefined) data.collection = payload.collection?.trim() || null
  if (payload.url !== undefined) data.url = payload.url.trim()
  if (payload.imageUrl !== undefined) data.imageUrl = payload.imageUrl?.trim() || null

  await prisma.trackedProduct.update({ where: { id }, data })
  revalidatePath("/")
}

export async function toggleWishlistItem(id: string, checked: boolean) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  await requireOwnership(id, session.id)
  await prisma.trackedProduct.update({ where: { id }, data: { checked } })
  revalidatePath("/")
}

export async function deleteTrackedProduct(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  await requireOwnership(id, session.id)
  await prisma.trackedProduct.delete({ where: { id } })
  revalidatePath("/")
}

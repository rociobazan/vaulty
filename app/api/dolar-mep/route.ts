import { NextResponse } from "next/server"

export const revalidate = 1800 // cache 30 min

export async function GET() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/bolsa", {
      headers: { "User-Agent": "Vaulty/1.0" },
      next: { revalidate: 1800 },
    })
    if (!res.ok) throw new Error(`dolarapi ${res.status}`)
    const data = await res.json() as {
      compra: number
      venta: number
      fechaActualizacion: string
    }
    return NextResponse.json({
      compra: data.compra,
      venta: data.venta,
      updatedAt: data.fechaActualizacion,
    })
  } catch {
    return NextResponse.json({ error: "No se pudo obtener la cotización" }, { status: 502 })
  }
}

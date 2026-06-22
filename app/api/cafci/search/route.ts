import { type NextRequest, NextResponse } from "next/server"
import { searchFunds } from "@/lib/cafci"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? ""
  try {
    const funds = await searchFunds(q)
    return NextResponse.json(funds)
  } catch (err) {
    console.error("[CAFCI search]", err)
    return NextResponse.json({ error: "Error al consultar CAFCI" }, { status: 502 })
  }
}

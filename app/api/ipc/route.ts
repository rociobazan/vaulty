import { NextResponse } from "next/server"
import { getIpcHistory } from "@/lib/ipc"

export const runtime = "nodejs"

export async function GET() {
  try {
    const data = await getIpcHistory()
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate" },
    })
  } catch (e) {
    console.error("IPC fetch failed:", e)
    // Graceful degradation — the chart will show portfolio-only mode
    return NextResponse.json([])
  }
}

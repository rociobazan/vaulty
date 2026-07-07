import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "" })
}

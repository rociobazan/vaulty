"use client"

import { useEffect, useState } from "react"

// Evita que recharts ResponsiveContainer se renderice en SSR / primer paint
// (cuando aún no hay layout para medir y reporta width/height = -1).
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

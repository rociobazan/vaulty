"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type State = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading"

export function PushBell() {
  const [state, setState] = useState<State>("loading")

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    if (Notification.permission === "denied") {
      setState("denied")
      return
    }

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      setState(existing ? "subscribed" : "unsubscribed")
    }).catch(() => setState("unsupported"))
  }, [])

  async function subscribe() {
    setState("loading")
    try {
      // Request permission explicitly — required by some desktop browsers
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission()
        if (perm !== "granted") {
          setState("unsubscribed")
          toast.error("Necesitás permitir las notificaciones en el navegador.")
          return
        }
      }

      const reg = await navigator.serviceWorker.ready

      // Clear any stale/conflicting subscription before creating a new one
      const stale = await reg.pushManager.getSubscription()
      if (stale) await stale.unsubscribe()

      const res = await fetch("/api/push/vapid-public-key")
      const { publicKey } = await res.json()
      if (!publicKey) throw new Error("VAPID_PUBLIC_KEY no configurada en el servidor")

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = sub.toJSON()
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      })

      setState("subscribed")
      toast.success("Notificaciones activadas. Te avisaremos 2 días antes de cada vencimiento.")
    } catch (err) {
      console.error("[PushBell] subscribe error:", err)
      setState("unsubscribed")
      const detail = err instanceof Error ? err.message : String(err)
      toast.error(`No se pudieron activar las notificaciones: ${detail}`)
    }
  }

  async function unsubscribe() {
    setState("loading")
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState("unsubscribed")
      toast.info("Notificaciones desactivadas.")
    } catch {
      setState("subscribed")
      toast.error("No se pudieron desactivar las notificaciones.")
    }
  }

  if (state === "unsupported") return null
  if (state === "denied") return (
    <Button variant="ghost" size="icon" disabled title="Notificaciones bloqueadas por el navegador">
      <BellOff className="size-4 text-muted-foreground" />
    </Button>
  )

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={state === "loading"}
      onClick={state === "subscribed" ? unsubscribe : subscribe}
      title={state === "subscribed" ? "Desactivar notificaciones" : "Activar notificaciones de vencimientos"}
      className="relative"
    >
      {state === "subscribed" ? (
        <>
          <Bell className="size-4 text-violet-600" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-violet-500" />
        </>
      ) : (
        <Bell className="size-4 text-muted-foreground" />
      )}
    </Button>
  )
}

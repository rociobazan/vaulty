// Vaulty — Service Worker para Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Vaulty", body: event.data.text() }
  }

  const options = {
    body:    payload.body  ?? "",
    icon:    payload.icon  ?? "/apple-icon.png",
    badge:   "/apple-icon.png",
    tag:     payload.tag   ?? "vaulty-notif",
    renotify: true,
    data:    { url: "/" },
    actions: [{ action: "open", title: "Ver en Vaulty" }],
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Vaulty", options)
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

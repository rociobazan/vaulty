import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vaulty · Centro de Comando",
    short_name: "Vaulty",
    description: "Tu centro de comando de finanzas personales: presupuesto base cero, inversiones y más.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#a855f7",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}

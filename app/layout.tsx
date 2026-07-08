import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { RegisterSW } from '@/components/register-sw'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Vaulty · Centro de Comando',
  description:
    'Tu centro de comando de finanzas personales: planificá tu presupuesto base cero y usá herramientas inteligentes para gastar mejor.',
  generator: 'v0.app',
  // manifest as static file in public/ — bypasses Next.js auth routing
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Vaulty',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#a855f7',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      style={{ colorScheme: "light" }}
    >
      <body className="font-sans antialiased" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <RegisterSW />
        {children}
        <Toaster richColors position="top-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

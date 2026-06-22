import { LogOut, Sprout } from "lucide-react"

import { Button } from "@/components/ui/button"
import { logoutUser } from "@/app/login/actions"
import type { SessionUser } from "@/lib/session"

interface NavbarProps {
  user: SessionUser | null
}

export function Navbar({ user }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-sm shadow-pink-500/30">
            <Sprout className="size-5" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
              Vaulty
            </span>
            <span className="text-xs text-muted-foreground">Centro de Comando</span>
          </div>
        </div>

        {/* User section */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-semibold text-pink-600">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden flex-col leading-none sm:flex">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </div>

            {/* Logout via form action → no client JS needed */}
            <form action={logoutUser}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Cerrar sesión"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}

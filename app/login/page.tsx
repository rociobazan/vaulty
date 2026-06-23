"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Eye, EyeOff, Lock, Mail, User2, TrendingUp, CheckCircle2, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerUser, loginUser } from "./actions"

// ── Validation schemas ────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(6, "Mínimo 6 caracteres")
  .regex(/[a-zA-Z]/, "Debe incluir al menos una letra")
  .regex(/[0-9]/, "Debe incluir al menos un número")

const LoginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
})

const RegisterSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Correo electrónico inválido"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })

type LoginData = z.infer<typeof LoginSchema>
type RegisterData = z.infer<typeof RegisterSchema>

// ── Password rules ────────────────────────────────────────────────────────────

function getPasswordRules(pw: string) {
  return [
    { label: "Mínimo 6 caracteres",   met: pw.length >= 6 },
    { label: "Al menos una letra",    met: /[a-zA-Z]/.test(pw) },
    { label: "Al menos un número",    met: /[0-9]/.test(pw) },
  ]
}

function allRulesMet(pw: string) {
  return getPasswordRules(pw).every((r) => r.met)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09A5.41 5.41 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A8.996 8.996 0 0 0 1 12c0 1.45.35 2.82.96 4.04l2.88-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">o</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function PasswordInput({
  id,
  placeholder,
  type: _type,
  className,
  ...props
}: React.ComponentProps<"input"> & { id: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className={cn("pl-9 pr-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null
  const rules = getPasswordRules(password)
  return (
    <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
      {rules.map((rule) => (
        <div
          key={rule.label}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors duration-200",
            rule.met ? "text-emerald-600" : "text-destructive",
          )}
        >
          {rule.met
            ? <CheckCircle2 className="size-3 shrink-0" />
            : <XCircle className="size-3 shrink-0" />}
          {rule.label}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("login")
  const [loginPending, startLogin] = useTransition()
  const [registerPending, startRegister] = useTransition()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get("error")
    if (err === "oauth_failed") toast.error("Error al iniciar sesión con Google. Intentá de nuevo.")
    if (err === "no_email") toast.error("Google no compartió un email. Usá otro método.")
  }, [])

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  })

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  const loginPassword     = loginForm.watch("password")
  const registerPassword  = registerForm.watch("password")
  const registerConfirm   = registerForm.watch("confirmPassword")

  const registerReady =
    allRulesMet(registerPassword) &&
    registerConfirm.length > 0 &&
    registerPassword === registerConfirm

  function onLogin(data: LoginData) {
    startLogin(async () => {
      const result = await loginUser(data)
      if (result.success) {
        toast.success(result.message)
        router.push("/")
      } else {
        toast.error(result.error)
      }
    })
  }

  function onRegister(data: RegisterData) {
    startRegister(async () => {
      const result = await registerUser(data)
      if (result.success) {
        toast.success(result.message)
        registerForm.reset()
        setActiveTab("login")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-pink-50 via-violet-50/60 to-slate-100 p-4">
      {/* Background decoration */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-200/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 shadow-xl shadow-pink-500/30">
            <TrendingUp className="size-8 text-white" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">Vaulty</h1>
            <p className="text-sm text-muted-foreground">Tu centro de comando financiero</p>
          </div>
        </div>

        {/* Auth card */}
        <Card className="border border-border/50 bg-background/95 shadow-2xl shadow-violet-100/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
              </TabsList>

              {/* ── Login tab ────────────────────────────────────────── */}
              <TabsContent value="login">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-foreground">Bienvenido de vuelta</h2>
                  <p className="text-sm text-muted-foreground">Ingresá con tu cuenta para continuar</p>
                </div>

                <a
                  href="/api/auth/google"
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  <GoogleIcon />
                  Continuar con Google
                </a>

                <OrDivider />

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="mt-4 space-y-4" noValidate>
                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-sm font-medium">
                      Correo electrónico
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@correo.com"
                        className="pl-9"
                        {...loginForm.register("email")}
                      />
                    </div>
                    <FieldError message={loginForm.formState.errors.email?.message} />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-sm font-medium">
                      Contraseña
                    </Label>
                    <PasswordInput
                      id="login-password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                    />
                    <PasswordChecklist password={loginPassword} />
                    <FieldError message={loginForm.formState.errors.password?.message} />
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 w-full transition-all duration-300 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20"
                    disabled={loginPending}
                  >
                    {loginPending ? "Ingresando…" : "Iniciar Sesión"}
                  </Button>
                </form>

                <p className="mt-5 text-center text-sm text-muted-foreground">
                  ¿No tenés cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("register")}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Registrate aquí
                  </button>
                </p>
              </TabsContent>

              {/* ── Register tab ──────────────────────────────────────── */}
              <TabsContent value="register">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-foreground">Creá tu cuenta</h2>
                  <p className="text-sm text-muted-foreground">Completá los datos para comenzar</p>
                </div>

                <a
                  href="/api/auth/google"
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  <GoogleIcon />
                  Continuar con Google
                </a>

                <OrDivider />

                <form onSubmit={registerForm.handleSubmit(onRegister)} className="mt-4 space-y-4" noValidate>
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-name" className="text-sm font-medium">
                      Nombre completo
                    </Label>
                    <div className="relative">
                      <User2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-name"
                        type="text"
                        autoComplete="name"
                        placeholder="Nombre Apellido"
                        className="pl-9"
                        {...registerForm.register("name")}
                      />
                    </div>
                    <FieldError message={registerForm.formState.errors.name?.message} />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-email" className="text-sm font-medium">
                      Correo electrónico
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@correo.com"
                        className="pl-9"
                        {...registerForm.register("email")}
                      />
                    </div>
                    <FieldError message={registerForm.formState.errors.email?.message} />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-password" className="text-sm font-medium">
                      Contraseña
                    </Label>
                    <PasswordInput
                      id="register-password"
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      {...registerForm.register("password")}
                    />
                    <PasswordChecklist password={registerPassword} />
                    <FieldError message={registerForm.formState.errors.password?.message} />
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-confirm" className="text-sm font-medium">
                      Confirmar contraseña
                    </Label>
                    <PasswordInput
                      id="register-confirm"
                      autoComplete="new-password"
                      placeholder="Repetí la contraseña"
                      {...registerForm.register("confirmPassword")}
                    />
                    {registerConfirm.length > 0 && registerPassword !== registerConfirm && (
                      <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <XCircle className="size-3 shrink-0" />
                        Las contraseñas no coinciden
                      </p>
                    )}
                    {registerConfirm.length > 0 && registerPassword === registerConfirm && allRulesMet(registerPassword) && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <CheckCircle2 className="size-3 shrink-0" />
                        Las contraseñas coinciden
                      </p>
                    )}
                    <FieldError message={registerForm.formState.errors.confirmPassword?.message} />
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 w-full transition-all duration-300 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20"
                    disabled={registerPending || !registerReady}
                  >
                    {registerPending ? "Creando cuenta…" : "Crear Cuenta"}
                  </Button>
                </form>

                <p className="mt-5 text-center text-sm text-muted-foreground">
                  ¿Ya tenés cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("login")}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Iniciá sesión
                  </button>
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/70">
          Al continuar, aceptás los términos de uso de Vaulty
        </p>
      </div>
    </div>
  )
}

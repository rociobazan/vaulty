"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createSession, deleteSession } from "@/lib/session"

// ── Schemas ───────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(6)
    .regex(/[a-zA-Z]/)
    .regex(/[0-9]/),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type ActionResult =
  | { success: true; message: string }
  | { success: false; error: string }

// ── Register ──────────────────────────────────────────────────────────────────

export async function registerUser(input: {
  name: string
  email: string
  password: string
}): Promise<ActionResult> {
  const parsed = RegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos. Revisá el formulario." }
  }

  const { name, email, password } = parsed.data

  try {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return { success: false, error: "Ese correo ya está registrado." }
    }

    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.create({ data: { name, email, password: hashed } })

    return { success: true, message: "¡Cuenta creada! Ya podés iniciar sesión." }
  } catch {
    return { success: false, error: "Error al crear la cuenta. Intentá de nuevo." }
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginUser(input: {
  email: string
  password: string
}): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos." }
  }

  const { email, password } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return { success: false, error: "Correo o contraseña incorrectos." }
    }

    if (!user.password) {
      return {
        success: false,
        error: "Esta cuenta usa inicio de sesión con Google. Usá ese método.",
      }
    }

    const matches = await bcrypt.compare(password, user.password)
    if (!matches) {
      return { success: false, error: "Correo o contraseña incorrectos." }
    }

    await createSession({ id: user.id, name: user.name, email: user.email })

    return { success: true, message: `¡Bienvenido, ${user.name}!` }
  } catch {
    return { success: false, error: "Error al iniciar sesión. Intentá de nuevo." }
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutUser(): Promise<never> {
  await deleteSession()
  // deleteSession calls redirect('/login') internally — this line is unreachable
  throw new Error("unreachable")
}

import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "DELETE"

interface Param {
  name: string
  in: "path" | "query" | "body"
  required: boolean
  type: string
  description: string
}

interface Endpoint {
  method: Method
  path: string
  summary: string
  description?: string
  auth: boolean
  params?: Param[]
  bodyExample?: object
  responseExample?: object
  responseCodes?: { code: number; description: string }[]
}

interface Group {
  name: string
  description: string
  color: string
  endpoints: Endpoint[]
}

// ── Data ──────────────────────────────────────────────────────────────────────

const GROUPS: Group[] = [
  {
    name: "Auth",
    description: "Autenticación con Google OAuth 2.0 y manejo de sesión JWT.",
    color: "violet",
    endpoints: [
      {
        method: "GET",
        path: "/api/auth/google",
        summary: "Iniciar flujo OAuth con Google",
        description: "Genera un estado CSRF, lo guarda en cookie y redirige al proveedor de Google para autenticación.",
        auth: false,
        responseCodes: [
          { code: 302, description: "Redirección a accounts.google.com" },
        ],
      },
      {
        method: "GET",
        path: "/api/auth/google/callback",
        summary: "Callback OAuth de Google",
        description: "Recibe el code de Google, intercambia por tokens, obtiene el perfil del usuario, crea o actualiza la cuenta y establece la cookie de sesión JWT.",
        auth: false,
        params: [
          { name: "code", in: "query", required: true, type: "string", description: "Código de autorización de Google" },
          { name: "state", in: "query", required: true, type: "string", description: "Estado CSRF para validar la solicitud" },
        ],
        responseCodes: [
          { code: 302, description: "Redirección a / con sesión establecida" },
          { code: 302, description: "Redirección a /login?error=oauth_failed si falla" },
        ],
      },
    ],
  },
  {
    name: "Presupuesto",
    description: "Gestión del presupuesto mensual por usuario. Requiere sesión activa.",
    color: "pink",
    endpoints: [
      {
        method: "GET",
        path: "/api/budget/{monthKey}",
        summary: "Obtener presupuesto de un mes",
        auth: true,
        params: [
          { name: "monthKey", in: "path", required: true, type: "string", description: 'Clave del mes en formato YYYY-MM (ej: "2026-06")' },
        ],
        responseCodes: [
          { code: 200, description: "Objeto MonthBudget con income, fixedItems, variableItems, savingsItems, creditCards" },
          { code: 401, description: "No autenticado" },
          { code: 404, description: "No existe presupuesto para ese mes" },
          { code: 500, description: "Error interno" },
        ],
        responseExample: {
          id: "abc123",
          userId: "user_id",
          monthKey: "2026-06",
          income: 1500000,
          fixedItems: [{ id: "alquiler", label: "Alquiler", value: 320000 }],
          variableItems: [{ id: "super", label: "Supermercado", value: 220000 }],
          savingsItems: [{ id: "fondos", label: "Fondos", value: 120000 }],
          creditCards: [],
        },
      },
      {
        method: "PUT",
        path: "/api/budget/{monthKey}",
        summary: "Crear o actualizar presupuesto de un mes",
        description: "Si ya existe un registro para ese mes lo actualiza; si no existe lo crea (upsert).",
        auth: true,
        params: [
          { name: "monthKey", in: "path", required: true, type: "string", description: 'Clave del mes en formato YYYY-MM' },
        ],
        bodyExample: {
          income: 1500000,
          fixedItems: [{ id: "alquiler", label: "Alquiler", value: 320000 }],
          variableItems: [{ id: "super", label: "Supermercado", value: 220000 }],
          savingsItems: [{ id: "fondos", label: "Fondos", value: 120000 }],
          creditCards: [],
        },
        responseCodes: [
          { code: 200, description: "Objeto MonthBudget actualizado o creado" },
          { code: 401, description: "No autenticado" },
          { code: 500, description: "Error interno" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/budget/{monthKey}",
        summary: "Eliminar presupuesto de un mes",
        auth: true,
        params: [
          { name: "monthKey", in: "path", required: true, type: "string", description: 'Clave del mes en formato YYYY-MM' },
        ],
        responseCodes: [
          { code: 200, description: '{ "ok": true }' },
          { code: 401, description: "No autenticado" },
        ],
      },
    ],
  },
  {
    name: "Inversiones",
    description: "CRUD de inversiones y sincronización de precios con CAFCI.",
    color: "violet",
    endpoints: [
      {
        method: "GET",
        path: "/api/investments",
        summary: "Listar todas las inversiones del usuario",
        auth: true,
        responseCodes: [
          { code: 200, description: "Array de objetos Investment ordenados por fecha de creación" },
          { code: 401, description: "No autenticado — devuelve array vacío" },
        ],
        responseExample: [
          {
            id: "inv_123",
            cafciId: "3821",
            name: "Fondo Alpha",
            ticker: "ALPHA",
            currency: "ARS",
            currentPrice: 12540.5,
            priceDate: "2026-06-20",
          },
        ],
      },
      {
        method: "DELETE",
        path: "/api/investments/{id}",
        summary: "Eliminar una inversión",
        description: "Elimina la inversión junto con todas sus transacciones e historial de precios asociados.",
        auth: true,
        params: [
          { name: "id", in: "path", required: true, type: "string", description: "ID de la inversión" },
        ],
        responseCodes: [
          { code: 200, description: '{ "ok": true }' },
          { code: 401, description: "No autenticado" },
          { code: 404, description: "Inversión no encontrada o no pertenece al usuario" },
        ],
      },
      {
        method: "GET",
        path: "/api/investments/history",
        summary: "Historial de valor total de la cartera",
        description: "Calcula el valor histórico en ARS y USD de toda la cartera cruzando transacciones con historial de precios.",
        auth: true,
        responseCodes: [
          { code: 200, description: "Array de HistoryPoint con date, label, arsValue, usdValue" },
          { code: 401, description: "No autenticado — devuelve array vacío" },
        ],
        responseExample: [
          { date: "2026-06-01", label: "1 Jun", arsValue: 4200000, usdValue: 0 },
          { date: "2026-06-20", label: "20 Jun", arsValue: 4850000, usdValue: 120 },
        ],
      },
      {
        method: "POST",
        path: "/api/investments/sync",
        summary: "Sincronizar precios actuales desde CAFCI",
        description: "Consulta la API de CAFCI para obtener el precio de cuotaparte más reciente de cada fondo con cafciId y actualiza el historial de precios.",
        auth: true,
        responseCodes: [
          { code: 200, description: '{ "updated": N } — cantidad de fondos actualizados' },
          { code: 401, description: "No autenticado" },
        ],
        responseExample: { updated: 3 },
      },
    ],
  },
  {
    name: "Wishlist",
    description: "Endpoint para agregar productos a la wishlist desde la extensión del navegador.",
    color: "pink",
    endpoints: [
      {
        method: "GET",
        path: "/api/tracker/quick-add",
        summary: "Agregar producto desde la extensión",
        description: "Recibe los datos del producto por query params (enviados por la extensión del navegador), lo guarda en la base de datos y redirige a la app.",
        auth: true,
        params: [
          { name: "url", in: "query", required: true, type: "string", description: "URL del producto" },
          { name: "name", in: "query", required: false, type: "string", description: 'Nombre del producto (default: "Producto sin nombre")' },
          { name: "price", in: "query", required: true, type: "string", description: "Precio del producto (se parsea desde texto)" },
          { name: "image", in: "query", required: false, type: "string", description: "URL de la imagen del producto" },
          { name: "collection", in: "query", required: false, type: "string", description: "Colección o categoría del producto" },
        ],
        responseCodes: [
          { code: 302, description: "Redirección a /?tab=precios&tracked=1 si es exitoso" },
          { code: 302, description: "Redirección a /?tab=precios&trackerError=... si falla" },
          { code: 302, description: "Redirección a /login si no está autenticado" },
        ],
      },
    ],
  },
  {
    name: "CAFCI",
    description: "Proxy a la API pública de CAFCI para búsqueda de fondos comunes de inversión argentinos.",
    color: "violet",
    endpoints: [
      {
        method: "GET",
        path: "/api/cafci/search",
        summary: "Buscar fondos de inversión",
        description: "Busca fondos en la API de CAFCI por nombre o ticker. No requiere autenticación.",
        auth: false,
        params: [
          { name: "q", in: "query", required: false, type: "string", description: "Texto de búsqueda (nombre o ticker del fondo)" },
        ],
        responseCodes: [
          { code: 200, description: "Array de fondos con id, nombre, ticker, etc." },
          { code: 502, description: "Error al conectar con la API de CAFCI" },
        ],
        responseExample: [
          { id: "3821", nombre: "Fondo Alpha Renta Mixta", ticker: "ALPHA", currency: "ARS" },
        ],
      },
    ],
  },
  {
    name: "IPC",
    description: "Historial del Índice de Precios al Consumidor (INDEC) para comparar rendimientos.",
    color: "pink",
    endpoints: [
      {
        method: "GET",
        path: "/api/ipc",
        summary: "Obtener historial del IPC",
        description: "Retorna el historial del Índice de Precios al Consumidor desde la API de datos del gobierno argentino. Respuesta cacheada 1 hora.",
        auth: false,
        responseCodes: [
          { code: 200, description: "Array de puntos { date, value } con el valor acumulado del IPC" },
          { code: 200, description: "Array vacío si la fuente externa falla (degradación elegante)" },
        ],
      },
    ],
  },
]

// ── Components ────────────────────────────────────────────────────────────────

const METHOD_STYLES: Record<Method, string> = {
  GET:    "bg-sky-100 text-sky-700 border border-sky-200",
  POST:   "bg-emerald-100 text-emerald-700 border border-emerald-200",
  PUT:    "bg-amber-100 text-amber-700 border border-amber-200",
  DELETE: "bg-red-100 text-red-700 border border-red-200",
}

const PARAM_IN_STYLES: Record<Param["in"], string> = {
  path:  "bg-violet-100 text-violet-700",
  query: "bg-pink-100 text-pink-700",
  body:  "bg-slate-100 text-slate-600",
}

function MethodBadge({ method }: { method: Method }) {
  return (
    <span className={cn("rounded px-2 py-0.5 font-mono text-xs font-bold", METHOD_STYLES[method])}>
      {method}
    </span>
  )
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <MethodBadge method={endpoint.method} />
        <code className="flex-1 font-mono text-sm text-foreground">{endpoint.path}</code>
        {endpoint.auth && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
            🔒 Requiere sesión
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Summary + description */}
        <div>
          <p className="font-semibold text-foreground">{endpoint.summary}</p>
          {endpoint.description && (
            <p className="mt-1 text-sm text-muted-foreground">{endpoint.description}</p>
          )}
        </div>

        {/* Parameters */}
        {endpoint.params && endpoint.params.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parámetros</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Nombre</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Ubicación</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Requerido</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map((p) => (
                    <tr key={p.name} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <code className="font-mono text-xs text-foreground">{p.name}</code>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", PARAM_IN_STYLES[p.in])}>
                          {p.in}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-xs text-muted-foreground">{p.type}</code>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.required
                          ? <span className="text-red-500 font-medium">sí</span>
                          : <span className="text-muted-foreground">no</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Body example */}
        {endpoint.bodyExample && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Body (JSON)</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
              {JSON.stringify(endpoint.bodyExample, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          {/* Response codes */}
          {endpoint.responseCodes && endpoint.responseCodes.length > 0 && (
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Respuestas</p>
              <div className="flex flex-col gap-1.5">
                {endpoint.responseCodes.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 font-mono font-bold",
                      r.code < 300 ? "bg-emerald-100 text-emerald-700" :
                      r.code < 400 ? "bg-sky-100 text-sky-700" :
                      r.code < 500 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {r.code}
                    </span>
                    <span className="text-muted-foreground">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response example */}
          {endpoint.responseExample && (
            <div className="flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ejemplo de respuesta</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                {JSON.stringify(endpoint.responseExample, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-sm shadow-pink-500/30">
            <span className="text-lg font-bold">/</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">API Reference</h1>
            <p className="text-sm text-muted-foreground">Vaulty · Documentación de endpoints</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground max-w-2xl">
          Todos los endpoints usan <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">application/json</code> como Content-Type.
          La autenticación se maneja mediante una cookie <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">nr_session</code> (JWT httpOnly)
          que se establece automáticamente al iniciar sesión.
        </p>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {(["GET", "POST", "PUT", "DELETE"] as Method[]).map((m) => (
            <MethodBadge key={m} method={m} />
          ))}
          <span className="text-xs text-muted-foreground self-center">— métodos HTTP usados</span>
        </div>
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-10">
        {GROUPS.map((group) => (
          <section key={group.name}>
            {/* Group header */}
            <div className={cn(
              "mb-4 rounded-xl px-4 py-3 border",
              group.color === "pink"
                ? "border-pink-200 bg-pink-50/60"
                : "border-violet-200 bg-violet-50/60",
            )}>
              <h2 className={cn(
                "text-base font-bold",
                group.color === "pink" ? "text-pink-800" : "text-violet-800",
              )}>
                {group.name}
              </h2>
              <p className={cn(
                "text-xs mt-0.5",
                group.color === "pink" ? "text-pink-700" : "text-violet-700",
              )}>
                {group.description}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {group.endpoints.map((endpoint) => (
                <EndpointCard
                  key={`${endpoint.method}-${endpoint.path}`}
                  endpoint={endpoint}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground/60">
        Vaulty API · Base URL: <code className="font-mono">https://vaulty-jet.vercel.app</code>
      </p>
    </main>
  )
}

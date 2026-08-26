/**
 * Admin API client. Same response envelope + cookie auth as the web app.
 *
 * Access tokens are short-lived (15 min) and rotated via POST /auth/refresh.
 * On 401 this client refreshes once (single-flight, Web Locks cross-tab safe)
 * and retries the original request — identical logic to apps/web/src/lib/api.ts.
 * ponytail: refresh logic is duplicated between web/admin because extracting a
 * shared packages/api-client means new workspace wiring; do it when a third
 * consumer appears.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface ApiResponse {
  success: boolean
  data?: unknown
  message?: string
  error?: string
  code?: string
}

/** Endpoints that must never trigger the auto-refresh retry loop. */
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]

let refreshInFlight: Promise<boolean> | null = null

const REFRESH_LOCK_KEY = "skillhill:refresh-lock"
const REFRESH_LOCK_TTL_MS = 10_000

async function acquireRefreshLock(): Promise<boolean> {
  if (typeof window === "undefined") return true
  if ("locks" in navigator && navigator.locks) {
    try {
      await navigator.locks.request(REFRESH_LOCK_KEY, async () => {
        await doRefresh()
      })
      return true
    } catch {
      return false
    }
  }

  const now = Date.now()
  const raw = window.localStorage.getItem(REFRESH_LOCK_KEY)
  const heldAt = raw ? Number(raw) : 0
  const isFree = !raw || Number.isNaN(heldAt) || now - heldAt > REFRESH_LOCK_TTL_MS
  if (!isFree) {
    await new Promise((r) => setTimeout(r, 400))
    return false
  }
  window.localStorage.setItem(REFRESH_LOCK_KEY, String(now))
  return true
}

function releaseRefreshLock(): void {
  if (typeof window === "undefined") return
  if (!("locks" in navigator && navigator.locks)) {
    window.localStorage.removeItem(REFRESH_LOCK_KEY)
  }
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
    let body: ApiResponse | null = null
    try {
      body = (await res.json()) as ApiResponse
    } catch {
      // non-JSON response
    }
    return res.ok && body?.success === true
  } catch {
    return false
  }
}

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const gotLock = await acquireRefreshLock()
      try {
        if (!gotLock) return true
        return await doRefresh()
      } finally {
        releaseRefreshLock()
      }
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function requestOnce<T>(path: string, init: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(!isFormData && init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })

  let body: ApiResponse | null = null
  try {
    body = (await res.json()) as ApiResponse
  } catch {
    // non-JSON response — treat as an error
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(
      body?.error ?? body?.message ?? `Request failed (${res.status})`,
      res.status,
      body?.code,
    )
  }
  return body.data as T
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await requestOnce<T>(path, init)
  } catch (err) {
    const canRefresh =
      err instanceof ApiError &&
      err.status === 401 &&
      !NO_REFRESH_PATHS.some((p) => path.startsWith(p))
    if (!canRefresh) throw err

    const refreshed = await refreshSession()
    if (!refreshed) throw err
    return requestOnce<T>(path, init)
  }
}

type Body = Record<string, unknown> | FormData

function serialize(body?: Body): string | FormData | undefined {
  if (body === undefined) return undefined
  if (body instanceof FormData) return body
  return JSON.stringify(body)
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: Body) =>
    request<T>(path, { method: "POST", body: serialize(body) }),

  put: <T>(path: string, body?: Body) =>
    request<T>(path, { method: "PUT", body: serialize(body) }),

  patch: <T>(path: string, body?: Body) =>
    request<T>(path, { method: "PATCH", body: serialize(body) }),

  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

/**
 * Turnstile token source. In dev the backend runs with Cloudflare's
 * always-pass test secret. In production set NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * and render the Turnstile widget on the login form to obtain real tokens.
 */
export const DEV_TURNSTILE_TOKEN = "dev-client-token"

export function getTurnstileToken(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "" : DEV_TURNSTILE_TOKEN
}

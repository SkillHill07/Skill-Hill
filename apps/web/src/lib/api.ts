/**
 * Thin API client for the SkillHill backend.
 *
 * The API returns `{ success, data, message?, error?, code? }` (see
 * utils/response.ts in the API). Auth is cookie-based (HttpOnly accessToken
 * with a 15-minute lifetime + single-use refresh cookie), so every request
 * sends `credentials: "include"`.
 *
 * When a request comes back 401, the client refreshes the session once via
 * POST /auth/refresh and retries the original request. Concurrent callers
 * share one in-flight refresh (single-flight promise), and tabs coordinate
 * through the Web Locks API (localStorage timestamp fallback) so two tabs
 * never rotate the same refresh token — rotating twice triggers the API's
 * reuse detection and logs the user out.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

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
  "/auth/forgot-password",
]

let refreshInFlight: Promise<boolean> | null = null

const REFRESH_LOCK_KEY = "skillhill:refresh-lock"
const REFRESH_LOCK_TTL_MS = 10_000

async function acquireRefreshLock(): Promise<boolean> {
  if (typeof window === "undefined") return true
  // Prefer the Web Locks API — cross-tab safe and self-releasing.
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

  // Fallback: timestamp-based mutex in localStorage.
  const now = Date.now()
  const raw = window.localStorage.getItem(REFRESH_LOCK_KEY)
  const heldAt = raw ? Number(raw) : 0
  const isFree = !raw || Number.isNaN(heldAt) || now - heldAt > REFRESH_LOCK_TTL_MS
  if (!isFree) {
    // Another tab is refreshing; wait briefly for it to finish.
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

/**
 * Refresh the session exactly once across concurrent callers.
 * Returns true when the session was successfully refreshed.
 */
async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const gotLock = await acquireRefreshLock()
      try {
        if (!gotLock) {
          // Another context refreshed for us — assume success and retry.
          return true
        }
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
      // FormData sets its own multipart boundary — never force JSON for it.
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
 * always-pass test secret, so a placeholder token is accepted. In production,
 * set NEXT_PUBLIC_TURNSTILE_SITE_KEY and render <Turnstile /> to obtain real tokens.
 */
export const DEV_TURNSTILE_TOKEN = "dev-client-token"

export function getTurnstileToken(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ? "" // real widget required — see components/turnstile.tsx
    : DEV_TURNSTILE_TOKEN
}

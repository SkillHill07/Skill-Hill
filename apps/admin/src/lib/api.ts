/** Admin API client. Same response envelope + cookie auth as the web app. */

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

/** Turnstile dev token — the API's test secret accepts it. */
export const DEV_TURNSTILE_TOKEN = "dev-client-token"

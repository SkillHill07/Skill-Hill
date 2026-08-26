"use client"

import { useEffect, useRef } from "react"

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    onTurnstileLoad?: () => void
  }
}

function loadScript(onload: () => void): void {
  if (window.turnstile) {
    onload()
    return
  }
  // Reuse the shared loader across instances.
  const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="1"]')
  if (existing) {
    const prev = window.onTurnstileLoad
    window.onTurnstileLoad = () => {
      prev?.()
      onload()
    }
    if (window.turnstile) onload()
    return
  }
  const script = document.createElement("script")
  script.src = SCRIPT_SRC
  script.async = true
  script.defer = true
  script.dataset.turnstile = "1"
  window.onTurnstileLoad = onload
  script.addEventListener("error", () => {
    console.warn("Failed to load the human-verification widget")
  })
  document.head.appendChild(script)
}

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured
 * (dev/test — callers fall back to the backend's test-secret token). In
 * production set NEXT_PUBLIC_TURNSTILE_SITE_KEY and lift the token up via
 * onToken; submit buttons stay disabled until a token arrives.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      if (widgetIdRef.current !== null) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
        theme: "auto",
      })
    }

    loadScript(render)

    return () => {
      cancelled = true
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // widget already gone
        }
        widgetIdRef.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null
  return <div ref={containerRef} aria-label="Human verification" />
}

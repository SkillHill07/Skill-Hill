import type { Response } from "express"
import { config } from "../config/index.js"

const isProduction = config.NODE_ENV === "production"

const COOKIE_OPTIONS_BASE = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
}

/**
 * Set access and refresh token cookies on the response.
 * Access token cookie: 7-day expiry
 * Refresh token cookie: 30-day expiry
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie("accessToken", accessToken, {
    ...COOKIE_OPTIONS_BASE,
    maxAge: config.ACCESS_TOKEN_EXPIRY_MS,
  })

  res.cookie("refreshToken", refreshToken, {
    ...COOKIE_OPTIONS_BASE,
    maxAge: config.REFRESH_TOKEN_EXPIRY_MS,
  })
}

/**
 * Clear both auth cookies.
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie("accessToken", { ...COOKIE_OPTIONS_BASE })
  res.clearCookie("refreshToken", { ...COOKIE_OPTIONS_BASE })
}

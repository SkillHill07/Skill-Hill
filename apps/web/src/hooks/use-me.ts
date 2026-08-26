"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { User } from "@skillcontest/shared-types"

/**
 * Single source of truth for the signed-in user. The API returns 401 when
 * logged out; the shared client refreshes once and retries before surfacing
 * the error, so a settled error here means the session is really gone.
 */
export function useMe() {
  return useQuery<User | null, Error>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<User>("/auth/me")
      } catch (err) {
        if (err instanceof Error && "status" in err && (err as { status?: number }).status === 401) {
          return null
        }
        throw err
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

import { z } from "zod"

export const listAuditLogsSchema = z.object({
  query: z.object({
    action: z.string().min(1).max(100).optional(),
    actorId: z.string().min(1).max(100).optional(),
    resource: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

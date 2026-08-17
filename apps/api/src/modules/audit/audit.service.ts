import { AuditLog, type IAuditLog } from "./audit.model.js"
import { logger } from "../../utils/logger.js"

export interface AuditEntry {
  actorId: string
  actorRole: string
  action: string
  resource: string
  resourceId?: string | null
  details?: Record<string, unknown> | null
  ip?: string | null
}

/**
 * Record an admin action (who, what, when, ip, resource). Best-effort by
 * design: an audit write failure must never roll back the money mutation or
 * ban it just happened to record.
 */
async function log(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      details: entry.details ?? null,
      ip: entry.ip ?? null,
    })
  } catch (err) {
    logger.error(
      { action: entry.action, resource: entry.resource, err: (err as Error).message },
      "audit_log_failed",
    )
  }
}

async function listLogs(filters: {
  action?: string
  actorId?: string
  resource?: string
  page?: number
  limit?: number
}): Promise<{
  logs: IAuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const page = filters.page ?? 1
  const limit = filters.limit ?? 20
  const query: Record<string, unknown> = {}
  if (filters.action) query.action = filters.action
  if (filters.actorId) query.actorId = filters.actorId
  if (filters.resource) query.resource = filters.resource

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(query),
  ])

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export const auditService = { log, listLogs }

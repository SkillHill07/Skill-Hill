import { Schema, model, type Document, type Model } from "mongoose"

export interface IAuditLog extends Document {
  /** Admin/creator userId who performed the action. */
  actorId: string
  actorRole: string
  /** Action string like "contest.publish", "payment.refund", "user.status". */
  action: string
  /** Resource type the action targets ("contest", "payment", "user", ...). */
  resource: string
  resourceId: string | null
  /** Free-form context (old/new values, reason, amounts) — never secrets. */
  details: Record<string, unknown> | null
  ip: string | null
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: String,
      required: [true, "Actor is required"],
      index: true,
    },
    actorRole: {
      type: String,
      required: [true, "Actor role is required"],
    },
    action: {
      type: String,
      required: [true, "Action is required"],
    },
    resource: {
      type: String,
      required: [true, "Resource is required"],
    },
    resourceId: {
      type: String,
      default: null,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

// Audit view: filter by action/resource, newest first.
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 })
auditLogSchema.index({ actorId: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: -1 })

export const AuditLog: Model<IAuditLog> = model<IAuditLog>("AuditLog", auditLogSchema)

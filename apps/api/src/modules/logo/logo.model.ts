import { Schema, model, type Document, type Model } from "mongoose"

export interface ISiteLogo extends Document {
  key: string // fixed "primary" — singleton marker
  logoUrl: string | null // hosted on Cloudflare R2
  altText: string
  tagline: string | null
}

const siteLogoSchema = new Schema<ISiteLogo>(
  {
    key: {
      type: String,
      default: "primary",
      unique: true,
      immutable: true,
    },
    logoUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "Logo URL must be at most 500 characters"],
    },
    altText: {
      type: String,
      default: "",
      trim: true,
      maxlength: [120, "Alt text must be at most 120 characters"],
    },
    tagline: {
      type: String,
      default: null,
      trim: true,
      maxlength: [200, "Tagline must be at most 200 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v
        return ret
      },
    },
  },
)

siteLogoSchema.index({ key: 1 }, { unique: true })

export const SiteLogo: Model<ISiteLogo> = model<ISiteLogo>("SiteLogo", siteLogoSchema)

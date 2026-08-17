import { Schema, model, type Document, type Model } from "mongoose"

export interface IBanner extends Document {
  title: string
  subtitle: string | null
  imageUrl: string | null // hosted on Cloudflare R2
  ctaText: string | null
  ctaLink: string | null
  order: number
  active: boolean
}

const bannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title must be at most 120 characters"],
    },
    subtitle: {
      type: String,
      default: null,
      trim: true,
      maxlength: [300, "Subtitle must be at most 300 characters"],
    },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "Image URL must be at most 500 characters"],
    },
    ctaText: {
      type: String,
      default: null,
      trim: true,
      maxlength: [60, "CTA text must be at most 60 characters"],
    },
    ctaLink: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "CTA link must be at most 500 characters"],
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
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

bannerSchema.index({ active: 1, order: 1 })

export const Banner: Model<IBanner> = model<IBanner>("Banner", bannerSchema)

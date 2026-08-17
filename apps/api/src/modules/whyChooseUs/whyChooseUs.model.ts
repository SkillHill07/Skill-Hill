import { Schema, model, type Document, type Model } from "mongoose"

export interface IWhyChooseUsItem extends Document {
  title: string
  description: string
  icon: string // emoji or icon key rendered by the frontend
  order: number
  active: boolean
}

const whyChooseUsSchema = new Schema<IWhyChooseUsItem>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title must be at most 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [1000, "Description must be at most 1000 characters"],
    },
    icon: {
      type: String,
      default: "✨",
      trim: true,
      maxlength: [100, "Icon must be at most 100 characters"],
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

whyChooseUsSchema.index({ active: 1, order: 1 })

export const WhyChooseUsItem: Model<IWhyChooseUsItem> = model<IWhyChooseUsItem>(
  "WhyChooseUsItem",
  whyChooseUsSchema,
)

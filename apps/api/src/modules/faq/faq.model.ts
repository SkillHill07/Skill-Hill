import { Schema, model, type Document, type Model } from "mongoose"

export interface IFaq extends Document {
  question: string
  answer: string
  category: string | null
  order: number
  active: boolean
}

const faqSchema = new Schema<IFaq>(
  {
    question: {
      type: String,
      required: [true, "Question is required"],
      trim: true,
      maxlength: [300, "Question must be at most 300 characters"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
      trim: true,
      maxlength: [5000, "Answer must be at most 5000 characters"],
    },
    category: {
      type: String,
      default: null,
      trim: true,
      maxlength: [60, "Category must be at most 60 characters"],
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

faqSchema.index({ active: 1, category: 1, order: 1 })

export const Faq: Model<IFaq> = model<IFaq>("Faq", faqSchema)

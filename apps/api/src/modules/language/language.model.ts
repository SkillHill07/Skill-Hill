import { Schema, model, type Document, type Model } from "mongoose"

export interface ILanguage extends Document {
  key: string // unique slug, referenced by problems (languageSupport)
  name: string
  version: string
  extension: string
  compileCommand: string | null // {file} placeholder, null for interpreted langs
  runCommand: string // {file} placeholder
  dockerImage: string
  logoUrl: string | null // hosted on Cloudflare R2, uploaded via POST /languages/:key/logo
  enabled: boolean
  order: number
}

const languageSchema = new Schema<ILanguage>(
  {
    key: {
      type: String,
      required: [true, "Key is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z][a-z0-9]*$/, "Key can only contain lowercase letters and numbers"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
      maxlength: [50, "Name must be at most 50 characters"],
    },
    version: {
      type: String,
      required: [true, "Version is required"],
      trim: true,
      maxlength: [50, "Version must be at most 50 characters"],
    },
    extension: {
      type: String,
      required: [true, "Extension is required"],
      trim: true,
      match: [/^[a-z0-9]+$/, "Extension must be alphanumeric without a leading dot"],
    },
    compileCommand: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "Compile command must be at most 500 characters"],
    },
    runCommand: {
      type: String,
      required: [true, "Run command is required"],
      trim: true,
      maxlength: [500, "Run command must be at most 500 characters"],
    },
    dockerImage: {
      type: String,
      required: [true, "Docker image is required"],
      trim: true,
      maxlength: [200, "Docker image must be at most 200 characters"],
    },
    logoUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, "Logo URL must be at most 500 characters"],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
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

languageSchema.index({ key: 1 }, { unique: true })
languageSchema.index({ enabled: 1, order: 1 })

export const Language: Model<ILanguage> = model<ILanguage>("Language", languageSchema)

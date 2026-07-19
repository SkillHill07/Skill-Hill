import { Schema, model, type Document, type Model } from "mongoose"
import bcrypt from "bcrypt"
import { encrypt, decrypt } from "../../utils/encryption.js"
import type { AccountStatus, AuthProvider, ContentStatus, KycStatus, Role } from "@skillcontest/shared-types"

export interface IUser extends Document {
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string | null
  phoneCountryCode: string | null

  isEmailVerified: boolean
  isPhoneVerified: boolean

  accountStatus: AccountStatus
  role: Role
  status: ContentStatus
  authProvider: AuthProvider
  googleId: string | null
  githubId: string | null
  avatarUrl: string | null

  panNumberEncrypted: string | null
  panVerified: boolean

  bankAccountNumberEncrypted: string | null
  ifscCodeEncrypted: string | null
  upiIdEncrypted: string | null
  kycStatus: KycStatus

  walletBalance: number
  refreshTokens: string[]
  lastLoginAt: Date | null
  deletedAt: Date | null

  // Virtuals
  fullName: string

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>
  getPanNumber(): string | null
  setPanNumber(pan: string): void
  getBankAccountNumber(): string | null
  setBankAccountNumber(accountNumber: string): void
  getIfscCode(): string | null
  setIfscCode(ifsc: string): void
  getUpiId(): string | null
  setUpiId(upi: string): void
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [1, "First name must be at least 1 character"],
      maxlength: [50, "First name must be at most 50 characters"],
      match: [/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, hyphens, and apostrophes"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [1, "Last name must be at least 1 character"],
      maxlength: [50, "Last name must be at most 50 characters"],
      match: [/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
      index: true,
    },
    password: {
      type: String,
      default: null,
      select: false, // Never return password by default
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      match: [/^\d{5,15}$/, "Phone number must be 5-15 digits"],
    },
    phoneCountryCode: {
      type: String,
      default: null,
      match: [/^\+\d{1,4}$/, "Country code must be like +91"],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      enum: {
        values: ["active", "inactive", "flagged", "banned"],
        message: "{VALUE} is not a valid account status",
      },
      default: "active",
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin", "creator"],
        message: "{VALUE} is not a valid role",
      },
      default: "user",
    },
    authProvider: {
      type: String,
      enum: {
        values: ["email", "google", "github"],
        message: "{VALUE} is not a valid auth provider",
      },
      default: "email",
    },
    googleId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    githubId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "published", "archived", "deleted"],
        message: "{VALUE} is not a valid content status",
      },
      default: "published",
    },
    panNumberEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    panVerified: {
      type: Boolean,
      default: false,
    },
    bankAccountNumberEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    ifscCodeEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    upiIdEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    kycStatus: {
      type: String,
      enum: {
        values: ["pending", "verified", "rejected"],
        message: "{VALUE} is not a valid KYC status",
      },
      default: "pending",
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        // Remove sensitive fields from JSON output
        delete ret.password
        delete ret.refreshTokens
        delete ret.panNumberEncrypted
        delete ret.bankAccountNumberEncrypted
        delete ret.ifscCodeEncrypted
        delete ret.upiIdEncrypted
        delete ret.__v
        return ret
      },
    },
  },
)

// Virtual: fullName
userSchema.virtual("fullName").get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`
})

// --- Indexes ---
userSchema.index({ email: 1, accountStatus: 1 })
userSchema.index({ role: 1 })
userSchema.index({ deletedAt: 1 })
userSchema.index({ createdAt: -1 })

// --- Pre-save hooks ---

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (err) {
    next(err as Error)
  }
})

// --- Instance methods ---

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false // Google OAuth users have no password
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.getPanNumber = function (this: IUser): string | null {
  if (!this.panNumberEncrypted) return null
  return decrypt(this.panNumberEncrypted)
}

userSchema.methods.setPanNumber = function (this: IUser, pan: string): void {
  this.panNumberEncrypted = encrypt(pan.toUpperCase())
}

userSchema.methods.getBankAccountNumber = function (this: IUser): string | null {
  if (!this.bankAccountNumberEncrypted) return null
  return decrypt(this.bankAccountNumberEncrypted)
}

userSchema.methods.setBankAccountNumber = function (this: IUser, accountNumber: string): void {
  this.bankAccountNumberEncrypted = encrypt(accountNumber)
}

userSchema.methods.getIfscCode = function (this: IUser): string | null {
  if (!this.ifscCodeEncrypted) return null
  return decrypt(this.ifscCodeEncrypted)
}

userSchema.methods.setIfscCode = function (this: IUser, ifsc: string): void {
  this.ifscCodeEncrypted = encrypt(ifsc.toUpperCase())
}

userSchema.methods.getUpiId = function (this: IUser): string | null {
  if (!this.upiIdEncrypted) return null
  return decrypt(this.upiIdEncrypted)
}

userSchema.methods.setUpiId = function (this: IUser, upi: string): void {
  this.upiIdEncrypted = encrypt(upi.toLowerCase())
}

export const User: Model<IUser> = model<IUser>("User", userSchema)

export type Role = "user" | "admin" | "creator"

export type AccountStatus = "active" | "inactive" | "flagged" | "banned"

export type ContentStatus = "draft" | "published" | "archived" | "deleted"

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface BaseModel {
  _id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  status: ContentStatus
}

export type AuthProvider = "email" | "google" | "github"

export type KycStatus = "pending" | "verified" | "rejected"

export interface User extends BaseModel {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  phoneCountryCode: string | null
  isEmailVerified: boolean
  isPhoneVerified: boolean
  accountStatus: AccountStatus
  role: Role
  authProvider: AuthProvider
  googleId: string | null
  githubId: string | null
  avatarUrl: string | null
  panVerified: boolean
  kycStatus: KycStatus
  walletBalance: number
  lastLoginAt: string | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// --- Contest Platform ---

export type ContestStatus = "draft" | "active" | "frozen" | "settled" | "cancelled"

export type ContestType = "free" | "paid"

export type ParticipationStatus =
  | "registered"
  | "started"
  | "completed"
  | "timedout"

export const SUBMISSION_STATUSES = [
  "pending",
  "running",
  "accepted",
  "rejected",
  "error",
  "timeout",
] as const

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export type Difficulty = "easy" | "medium" | "hard"

export type ProblemType = "coding" | "mcq"

export type ProblemStatus = "draft" | "published"

export const WALLET_STATUSES = ["active", "frozen"] as const

export type WalletStatus = (typeof WALLET_STATUSES)[number]

export const TRANSACTION_TYPES = [
  "deposit",
  "contest_fee",
  "prize",
  "refund",
  "withdrawal",
] as const

export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_REFERENCE_TYPES = [
  "payment",
  "contest",
  "prize",
  "withdrawal",
] as const

export type TransactionReferenceType = (typeof TRANSACTION_REFERENCE_TYPES)[number]

export const TRANSACTION_STATUSES = ["completed", "pending", "failed"] as const

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

// --- Payments (Razorpay) ---

/**
 * Lifecycle of a Razorpay order tracked by the payment module:
 * created → (attempted) → paid | failed, paid → refunded.
 */
export const PAYMENT_STATUSES = [
  "created",
  "attempted",
  "paid",
  "failed",
  "refunded",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** What a payment order pays for. Currently all orders credit the wallet. */
export const PAYMENT_PURPOSES = ["deposit", "contest"] as const

export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number]

export interface Payment {
  _id: string
  userId: string
  /** Optional contest the deposit is for (metadata — join still deducts from wallet). */
  contestId: string | null
  purpose: PaymentPurpose
  amount: number // paise (2000 = ₹20)
  currency: string // INR
  status: PaymentStatus
  idempotencyKey: string
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  receipt: string
  refundId: string | null
  failureReason: string | null
  paidAt: string | null
  refundedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Contest {
  _id: string
  title: string
  slug: string
  description: string
  problemIds: string[]
  startTime: string
  endTime: string
  type: ContestType // "free" forces entryFee = 0
  entryFee: number // paise (0 for free contests)
  prizePool: number // paise
  maxParticipants: number | null
  status: ContestStatus
  rules: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Participation {
  _id: string
  userId: string
  contestId: string
  joinedAt: string
  startedAt: string | null
  submittedAt: string | null
  totalScore: number
  rank: number | null
  status: ParticipationStatus
  createdAt: string
  updatedAt: string
}

// --- Wallet ---

export interface Wallet {
  _id: string
  userId: string
  balance: number // paise
  locked: number
  totalDeposited: number
  totalWithdrawn: number
  totalWon: number
  totalSpentOnFees: number
  status: WalletStatus
  createdAt: string
  updatedAt: string
}

export interface WalletTransaction {
  _id: string
  userId: string
  type: TransactionType
  amount: number // paise, always positive; type indicates direction
  balanceBefore: number
  balanceAfter: number
  referenceType: TransactionReferenceType
  referenceId: string
  description: string
  status: TransactionStatus
  createdAt: string
}

// --- Problem ---

export interface ProblemTestCase {
  _id: string
  input: string
  expectedOutput: string
  isPublic: boolean
  order: number
  description?: string
}

export interface Problem {
  _id: string
  contestId: string
  title: string
  slug: string
  description: string
  imageUrls: string[] // statement diagrams / images (Cloudflare R2)
  type: ProblemType // "coding" (judged by test cases) or "mcq" (multiple choice)
  difficulty: Difficulty
  points: number
  order: number
  timeLimit: number // ms (coding only)
  memoryLimit: number // MB (coding only)
  languageSupport: string[] // language keys (see Language) — empty for mcq
  solutionTemplate: Record<string, string> // coding only
  status: ProblemStatus
  createdAt: string
  updatedAt: string
  // Public-safe: hidden test cases and the correct answer are stripped from responses
  testCases: ProblemTestCase[]
  options: string[] // mcq only — answer choices
  correctAnswer: number | null // mcq only — 0-based index into options, NEVER returned publicly
}

// --- Submission ---

export interface SubmissionTestCaseResult {
  testCaseId: string
  passed: boolean
  executionTime: number // ms
  output: string // actual stdout (public cases only — hidden cases stored as counts)
  expectedOutput: string
}

export interface Submission {
  _id: string
  userId: string
  contestId: string
  problemId: string
  language: string | null // language key; null for mcq (code holds the chosen option index)
  code: string
  /** "run" = public test cases only, no leaderboard effect. "submit" = full judge. */
  mode: "run" | "submit"
  status: SubmissionStatus
  testResults: SubmissionTestCaseResult[] // public cases only — hidden cases stored as counts
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  totalScore: number
  executionTime: number // max ms across test cases
  memoryUsed: number // max KB across test cases
  compilerOutput: string | null
  submittedAt: string
  judgedAt: string | null
  createdAt: string
  updatedAt: string
}

// --- Site Content (public marketing site) ---

export interface SiteLogo {
  _id: string
  key: string // fixed "primary" — singleton marker
  logoUrl: string | null // Cloudflare R2
  altText: string
  tagline: string | null
  createdAt: string
  updatedAt: string
}

export interface WhyChooseUsItem {
  _id: string
  title: string
  description: string
  icon: string // emoji or icon key
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Banner {
  _id: string
  title: string
  subtitle: string | null
  imageUrl: string | null // Cloudflare R2
  ctaText: string | null
  ctaLink: string | null
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Faq {
  _id: string
  question: string
  answer: string
  category: string | null
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

// --- Prizes ---

/**
 * Prize distribution status. Wallet credits replace the plan's payout-queue
 * statuses (pending → processing → completed): a prize is `pending` the moment
 * it is recorded, then `credited` (wallet) or `failed` (credit error — retried
 * via the admin redistribute endpoint).
 */
export const PRIZE_STATUSES = ["pending", "credited", "failed"] as const

export type PrizeStatus = (typeof PRIZE_STATUSES)[number]

export interface Prize {
  _id: string
  contestId: string
  userId: string
  rank: number
  prizeAmount: number // paise
  status: PrizeStatus
  failureReason: string | null
  creditedAt: string | null
  createdAt: string
  updatedAt: string
}

// --- Realtime (socket.io) ---

/**
 * Payload for submission:queued / submission:running / submission:completed.
 * The completed event carries the public result fields (hidden cases only as
 * counts — never details, matching the REST response).
 */
export interface SubmissionStatusEvent {
  submissionId: string
  contestId: string
  problemId: string
  status: SubmissionStatus
  // present on "submission:completed"
  totalScore?: number
  publicPassed?: number
  publicTotal?: number
  hiddenPassed?: number
  hiddenTotal?: number
  executionTime?: number
  memoryUsed?: number
  compilerOutput?: string | null
  judgedAt?: string | null
}

// --- Language ---

export interface Language {
  _id: string
  key: string // unique slug, referenced by problems (languageSupport)
  name: string
  version: string
  extension: string
  compileCommand: string | null // {file} placeholder, null for interpreted
  runCommand: string // {file} placeholder
  dockerImage: string
  logoUrl: string | null // hosted on Cloudflare R2
  enabled: boolean
  order: number
  createdAt: string
  updatedAt: string
}

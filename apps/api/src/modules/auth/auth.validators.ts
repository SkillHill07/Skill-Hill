import { z } from "zod"

export const registerSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name must be at most 50 characters")
      .regex(/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, hyphens, and apostrophes")
      .trim(),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name must be at most 50 characters")
      .regex(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes")
      .trim(),
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    turnstileToken: z.string().min(1, "Turnstile verification is required"),
  }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim(),
    password: z.string().min(1, "Password is required"),
    turnstileToken: z.string().min(1, "Turnstile verification is required"),
  }),
})

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
})

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
})

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim(),
    turnstileToken: z.string().min(1, "Turnstile verification is required"),
  }),
})

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim(),
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
  }),
})

export const verifyOtpSchema = z.object({
  body: z.object({
    otp: z
      .string()
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d{6}$/, "OTP must be a 6-digit number"),
  }),
})

export const updateKycSchema = z.object({
  body: z.object({
    panNumber: z
      .string()
      .transform((val) => val.toUpperCase())
      .refine((val) => /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(val), "Invalid PAN format. Expected: ABCDE1234F")
      .optional(),
    bankAccountNumber: z
      .string()
      .regex(/^\d{9,18}$/, "Bank account must be 9-18 digits")
      .optional(),
    ifscCode: z
      .string()
      .transform((val) => val.toUpperCase())
      .refine((val) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val), "Invalid IFSC format. Expected: HDFC0001234")
      .optional(),
    upiId: z
      .string()
      .transform((val) => val.toLowerCase())
      .refine((val) => /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(val), "Invalid UPI format. Expected: username@handle")
      .optional(),
  }).refine(
    (data) => data.panNumber !== undefined || data.bankAccountNumber !== undefined || data.ifscCode !== undefined || data.upiId !== undefined,
    { message: "At least one KYC field must be provided" },
  ),
})

export type UpdateKycBody = z.infer<typeof updateKycSchema>["body"]

export const reviewKycSchema = z.object({
  body: z.object({
    action: z.enum(["approved", "rejected"], {
      errorMap: () => ({ message: "Action must be 'approved' or 'rejected'" }),
    }),
    rejectionReason: z
      .string()
      .min(1, "Rejection reason is required when rejecting KYC")
      .optional(),
  }).refine(
    (data) => {
      if (data.action === "rejected" && !data.rejectionReason) {
        return false
      }
      return true
    },
    { message: "Rejection reason is required when rejecting KYC" },
  ),
})

export const setPasswordSchema = z.object({
  body: z.object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    currentPassword: z
      .string()
      .optional(),
  }),
})

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name must be at most 50 characters")
      .regex(/^[a-zA-Z\s'-]+$/, "First name can only contain letters, spaces, hyphens, and apostrophes")
      .trim()
      .optional(),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name must be at most 50 characters")
      .regex(/^[a-zA-Z\s'-]+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes")
      .trim()
      .optional(),
    phone: z
      .string()
      .regex(/^\d{5,15}$/, "Phone number must be 5-15 digits")
      .nullable()
      .optional(),
    phoneCountryCode: z
      .string()
      .regex(/^\+\d{1,4}$/, "Country code must be like +91")
      .nullable()
      .optional(),
  }).refine(
    (data) => data.firstName !== undefined || data.lastName !== undefined || data.phone !== undefined || data.phoneCountryCode !== undefined,
    { message: "At least one field must be provided for update" },
  ),
})

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>["body"]

export const changeStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "inactive", "flagged", "banned"], {
      errorMap: () => ({ message: "Status must be one of: active, inactive, flagged, banned" }),
    }),
    reason: z
      .string()
      .max(500, "Reason must be at most 500 characters")
      .optional(),
  }),
})

export const changeRoleSchema = z.object({
  body: z.object({
    role: z.enum(["user", "admin", "creator"], {
      errorMap: () => ({ message: "Role must be one of: user, admin, creator" }),
    }),
  }),
})

export type RegisterBody = z.infer<typeof registerSchema>["body"]
export type LoginBody = z.infer<typeof loginSchema>["body"]
export type RefreshBody = z.infer<typeof refreshSchema>["body"]

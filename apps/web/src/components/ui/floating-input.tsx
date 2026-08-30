"use client"

import { cn } from "@/lib/utils"
import { forwardRef, useState, type InputHTMLAttributes } from "react"

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * Input with a floating label that animates up on focus/fill.
 * Drop-in replacement for <Label> + <Input> pairs.
 */
export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, className, error, id, ...props }, ref) => {
    const [hasValue, setHasValue] = useState(false)

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          placeholder=" "
          className={cn(
            "peer h-11 w-full rounded-lg border border-input bg-background px-4 pb-2 pt-5 text-sm shadow-sm transition-colors",
            "placeholder:text-transparent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:ring-red-500",
            className,
          )}
          onFocus={() => setHasValue(true)}
          onBlur={(e) => setHasValue(e.target.value !== "")}
          onChange={(e) => setHasValue(e.target.value !== "")}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200",
            "peer-focus:-top-1.5 peer-focus:left-3 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:bg-background peer-focus:px-1 peer-focus:text-orange-600",
            "peer-[:not(:placeholder-shown)]:-top-1.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:bg-background peer-[:not(:placeholder-shown)]:px-1",
          )}
        >
          {label}
        </label>
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  },
)

FloatingInput.displayName = "FloatingInput"

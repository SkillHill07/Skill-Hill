"use client"

import { cn } from "@/lib/utils"
import { forwardRef, useState, type InputHTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"

interface FloatingPasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string
  error?: string
}

/**
 * Password input with floating label and eye toggle to show/hide password.
 * Drop-in replacement for FloatingInput with type="password".
 */
export const FloatingPasswordInput = forwardRef<HTMLInputElement, FloatingPasswordInputProps>(
  ({ label, className, error, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          placeholder=" "
          className={cn(
            "peer h-11 w-full rounded-lg border border-input bg-background px-4 pb-2 pt-5 pr-11 text-sm shadow-sm transition-colors",
            "placeholder:text-transparent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:ring-red-500",
            className,
          )}
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
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  },
)

FloatingPasswordInput.displayName = "FloatingPasswordInput"

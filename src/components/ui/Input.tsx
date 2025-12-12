import { InputHTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-2 rounded-lg",
            "bg-[var(--input)] text-[var(--foreground)]",
            "border border-[var(--border)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]",
            "placeholder:text-[var(--foreground-muted)]",
            "transition-colors",
            error && "border-[var(--destructive)] focus:ring-[var(--destructive)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--destructive)]">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  rows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, rows = 4, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={cn(
            "w-full px-4 py-2 rounded-lg resize-none",
            "bg-[var(--input)] text-[var(--foreground)]",
            "border border-[var(--border)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]",
            "placeholder:text-[var(--foreground-muted)]",
            "transition-colors",
            error && "border-[var(--destructive)] focus:ring-[var(--destructive)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--destructive)]">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">{helperText}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = "Textarea"

import { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error"
}

export function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const variantStyles = {
    info: "bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] border-[var(--primary-dark)] text-[var(--primary)]",
    success: "bg-[color-mix(in_srgb,var(--success)_20%,transparent)] border-[var(--success)] text-[var(--success)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] border-[var(--warning)] text-[var(--warning)]",
    error: "bg-[color-mix(in_srgb,var(--destructive)_20%,transparent)] border-[var(--destructive)] text-[var(--destructive)]",
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function AlertTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("font-medium mb-1", className)}
      {...props}
    >
      {children}
    </h5>
  )
}

export function AlertDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn("text-sm opacity-90", className)}
      {...props}
    >
      {children}
    </div>
  )
}

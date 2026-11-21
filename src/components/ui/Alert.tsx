import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "danger" | "success" | "warning" | "info";

// Tinted surface + readable text. The text uses the *-text tokens, which stay AA in both themes.
const variantStyles: Record<AlertVariant, string> = {
  danger:
    "bg-[color-mix(in_srgb,var(--destructive)_8%,transparent)] border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] text-[var(--destructive-text)]",
  success:
    "bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border-[color-mix(in_srgb,var(--success)_30%,transparent)] text-[var(--success-text)]",
  warning:
    "bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] border-[color-mix(in_srgb,var(--warning)_30%,transparent)] text-[var(--warning-text)]",
  info: "bg-[color-mix(in_srgb,var(--info)_8%,transparent)] border-[color-mix(in_srgb,var(--info)_30%,transparent)] text-[var(--info-text)]",
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

/**
 * Inline status message. Errors are announced immediately (role="alert"), everything else
 * politely (role="status").
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", role, children, ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? (variant === "danger" ? "alert" : "status")}
      className={cn(
        "p-3 rounded-[var(--radius)] border text-sm",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Alert.displayName = "Alert";

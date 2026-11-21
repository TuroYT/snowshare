import { SelectHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, children, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    let describedBy: string | undefined;
    if (error) describedBy = `${id}-error`;
    else if (helperText) describedBy = `${id}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-xs text-[var(--foreground-muted)] mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-[var(--radius)]",
            "bg-[var(--input)] text-[var(--foreground)]",
            "border border-[var(--border)]",
            "focus:outline-none focus:border-[var(--foreground)]",
            "transition-colors duration-100",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[var(--destructive)] focus:border-[var(--destructive)]",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${id}-error`} className="mt-1 text-xs text-[var(--destructive-text)]">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--foreground-muted)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

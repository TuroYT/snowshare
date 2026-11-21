import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

const fieldStyles = (error?: string) =>
  cn(
    "w-full px-3 py-2 text-sm rounded-[var(--radius)]",
    "bg-[var(--input)] text-[var(--foreground)]",
    "border border-[var(--border)]",
    "focus:outline-none focus:border-[var(--foreground)]",
    "placeholder:text-[var(--foreground-subtle)]",
    "transition-colors duration-100",
    error && "border-[var(--destructive)] focus:border-[var(--destructive)]",
    "disabled:opacity-50 disabled:cursor-not-allowed"
  );

function FieldShell({
  id,
  label,
  error,
  helperText,
  children,
}: Readonly<{
  id: string;
  label?: string;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs text-[var(--foreground-muted)] mb-1.5">
          {label}
        </label>
      )}
      {children}
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

function describedBy(id: string, error?: string, helperText?: string) {
  if (error) return `${id}-error`;
  if (helperText) return `${id}-hint`;
  return undefined;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldShell id={id} label={label} error={error} helperText={helperText}>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, helperText)}
          className={cn(fieldStyles(error), className)}
          {...props}
        />
      </FieldShell>
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, rows = 4, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    return (
      <FieldShell id={id} label={label} error={error} helperText={helperText}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, helperText)}
          className={cn(fieldStyles(error), "resize-none", className)}
          {...props}
        />
      </FieldShell>
    );
  }
);

Textarea.displayName = "Textarea";

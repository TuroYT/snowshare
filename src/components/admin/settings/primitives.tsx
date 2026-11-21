"use client";

import { type ReactNode, useId } from "react";
import { Input } from "@/components/ui";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  activeColor?: string;
  disabled?: boolean;
  /** id of the element that names this switch */
  labelledBy?: string;
}

export function Toggle({
  checked,
  onChange,
  activeColor = "bg-[var(--primary)]",
  disabled,
  labelledBy,
}: Readonly<ToggleProps>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex shrink-0 h-8 w-14 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] ${
        checked ? activeColor : "bg-[var(--border-hover)]"
      }${disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer"}`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

interface ToggleRowProps {
  label: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  activeColor?: string;
}

export function ToggleRow({
  label,
  description,
  extra,
  checked,
  onChange,
  disabled,
  activeColor,
}: Readonly<ToggleRowProps>) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-lg)] border border-[var(--border)]">
      <div className="flex-1 min-w-0">
        <span id={labelId} className="text-[var(--foreground)] font-medium">
          {label}
        </span>
        {description && (
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{description}</p>
        )}
        {extra}
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        activeColor={activeColor}
        labelledBy={labelId}
      />
    </div>
  );
}

interface FieldInputProps {
  label: string;
  type?: "text" | "password" | "number";
  value: string | number;
  onChange: (value: string | null) => void;
  placeholder?: string;
  hint?: string;
}

export function FieldInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
}: Readonly<FieldInputProps>) {
  return (
    <Input
      label={label}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder}
      helperText={hint}
    />
  );
}

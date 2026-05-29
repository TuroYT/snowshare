"use client";

import { type ReactNode } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  activeColor?: string;
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  activeColor = "bg-[var(--primary)]",
  disabled,
}: ToggleProps) {
  return (
    <button
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
        checked ? activeColor : "bg-[var(--border-hover)]"
      }${disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer"}`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
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
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--surface)]/20 rounded-lg border border-[var(--border)]/50">
      <div>
        <label className="text-[var(--foreground)] font-medium">{label}</label>
        {description && (
          <p className="text-sm text-[var(--foreground-muted)] mt-1">{description}</p>
        )}
        {extra}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} activeColor={activeColor} />
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
  min?: number;
}

export function FieldInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  hint,
  min,
}: FieldInputProps) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--foreground)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        min={min}
        className="mt-1 w-full px-3 py-2 bg-[var(--surface)]/50 border border-[var(--border)]/50 rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      />
      {hint && <p className="text-xs text-[var(--foreground-muted)] mt-1">{hint}</p>}
    </div>
  );
}

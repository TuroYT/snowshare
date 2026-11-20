"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";
import { FIELD_FOCUS } from "./fieldStyles";

interface PasswordFieldProps {
  password: string;
  setPassword: (value: string) => void;
  label: string;
  placeholder: string;
  help: string;
}

const EYE_PATHS = {
  show: "M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3-8C7 4 2.7 7.1 1 12c1.7 4.9 6 8 11 8s9.3-3.1 11-8c-1.7-4.9-6-8-11-8z",
  hide: "M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10.5 10.5 0 0112 5c5 0 9.3 3.1 11 7a11.7 11.7 0 01-3.2 4.4M6.6 6.6A11.6 11.6 0 001 12c1.7 3.9 6 7 11 7 1.5 0 2.9-.3 4.2-.8",
};

const PasswordField: React.FC<PasswordFieldProps> = ({
  password,
  setPassword,
  label,
  placeholder,
  help,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const id = React.useId();
  const helpId = `${id}-help`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          aria-describedby={helpId}
          placeholder={placeholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`w-full bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-[var(--radius)] pl-3 pr-12 py-2 ${FIELD_FOCUS}`}
        />
        <Button
          type="button"
          variant="ghost"
          aria-pressed={visible}
          aria-label={
            visible
              ? t("shareform.hide_password", "Hide password")
              : t("shareform.show_password", "Show password")
          }
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 w-11 p-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={visible ? EYE_PATHS.hide : EYE_PATHS.show}
            />
          </svg>
        </Button>
      </div>
      <p id={helpId} className="text-xs text-[var(--foreground-muted)]">
        {help}
      </p>
    </div>
  );
};

export default PasswordField;

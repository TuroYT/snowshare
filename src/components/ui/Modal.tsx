"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = "lg",
}: Readonly<ModalProps>) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (
        e.shiftKey &&
        (active === first || active === dialogRef.current || !dialogRef.current.contains(active))
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Move focus into the dialog on open and give it back to the trigger on close.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-[95vw]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] border border-[var(--border)] animate-scale-in overflow-hidden flex flex-col focus:outline-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
          {title && (
            <h2 className="text-xl font-semibold text-[var(--foreground)] min-w-0 break-words text-balance">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-2 hover:bg-[var(--surface-hover)] rounded-full transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            aria-label={t("common.close", "Close")}
          >
            <svg
              className="w-5 h-5 text-[var(--foreground-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

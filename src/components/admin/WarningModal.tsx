"use client";

import { useTranslation } from "react-i18next";
import { Button, Modal } from "@/components/ui";

interface WarningModalProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function WarningModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: Readonly<WarningModalProps>) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={open} onClose={onCancel} title={title} size="sm">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 mt-0.5 shrink-0 text-[var(--warning-text)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="min-w-0 break-words text-[var(--foreground)] leading-relaxed whitespace-pre-line">
          {message}
        </p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelText || t("common.cancel")}
        </Button>
        <Button type="button" onClick={onConfirm}>
          {confirmText || t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}

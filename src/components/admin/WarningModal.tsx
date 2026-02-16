"use client"

import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material"
import { useTranslation } from "react-i18next"

interface WarningModalProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}

export default function WarningModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: WarningModalProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: {
          style: {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            opacity: 1,
          },
        },
        paper: {
          style: {
            backgroundColor: "var(--surface)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            backdropFilter: "none",
            opacity: 1,
          },
        },
      }}
    >
      <DialogTitle
        style={{
          color: "var(--foreground)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          backgroundColor: "var(--surface)",
        }}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: "var(--primary-hover)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {title}
      </DialogTitle>
      <DialogContent
        style={{
          paddingTop: "1rem",
          backgroundColor: "var(--surface)",
          opacity: 1,
        }}
      >
        <p
          style={{
            color: "var(--foreground)",
            lineHeight: "1.6",
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </p>
      </DialogContent>
      <DialogActions
        style={{
          padding: "1rem",
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          opacity: 1,
        }}
      >
        <Button
          onClick={onCancel}
          style={{
            color: "var(--foreground-muted)",
            textTransform: "none",
          }}
        >
          {cancelText || t("common.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          style={{
            backgroundColor: "var(--primary)",
            color: "white",
            textTransform: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--primary-hover)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--primary)"
          }}
        >
          {confirmText || t("common.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

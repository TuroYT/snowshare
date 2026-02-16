"use client"

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

interface SecurityWarningModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  type: "captcha" | "email"
}

export default function SecurityWarningModal({ open, onClose, onConfirm, type }: SecurityWarningModalProps) {
  const { t } = useTranslation()
  
  const titleKey = type === "captcha" ? "security.warning_modal.captcha_title" : "security.warning_modal.email_title"
  const messageKey = type === "captcha" ? "security.warning_modal.captcha_message" : "security.warning_modal.email_message"
  const recommendationKey = type === "captcha" ? "security.warning_modal.captcha_recommendation" : "security.warning_modal.email_recommendation"
  
  const riskKeys = type === "captcha" 
    ? ["security.warning_modal.captcha_risk_1", "security.warning_modal.captcha_risk_2", "security.warning_modal.captcha_risk_3"]
    : ["security.warning_modal.email_risk_1", "security.warning_modal.email_risk_2", "security.warning_modal.email_risk_3", "security.warning_modal.email_risk_4"]

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }
      }}
    >
      <DialogTitle sx={{ 
        color: 'var(--foreground)',
        borderBottom: '1px solid var(--border)',
        fontWeight: 600,
      }}>
        {t(titleKey)}
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: 'var(--foreground)', mb: 2 }}>
          {t(messageKey)}
        </Typography>

        <div className="p-4 bg-red-900/10 border border-red-800 rounded-lg mb-3">
          <Typography variant="subtitle2" sx={{ color: 'var(--foreground)', fontWeight: 600, mb: 1 }}>
            {t("security.warning_modal.potential_risks")}
          </Typography>
          <ul className="space-y-1 text-sm text-[var(--foreground-muted)]">
            {riskKeys.map((riskKey, index) => (
              <li key={index}>• {t(riskKey)}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg">
          <Typography variant="body2" sx={{ color: 'var(--foreground)' }}>
            {t(recommendationKey)}
          </Typography>
        </div>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid var(--border)', p: 2 }}>
        <Button 
          onClick={onClose}
          sx={{ 
            color: 'var(--foreground-muted)',
            '&:hover': { backgroundColor: 'var(--surface)' }
          }}
        >
          {t("security.warning_modal.cancel")}
        </Button>
        <Button 
          onClick={onConfirm}
          variant="contained"
          sx={{ 
            backgroundColor: 'var(--primary)',
            '&:hover': { backgroundColor: 'var(--primary-hover)' }
          }}
        >
          {t("security.warning_modal.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

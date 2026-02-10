"use client"

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material"

interface SecurityWarningModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  type: "captcha" | "email-verification"
}

export default function SecurityWarningModal({ open, onClose, onConfirm, type }: SecurityWarningModalProps) {
  const warnings = {
    captcha: {
      title: "⚠️ Enable CAPTCHA Protection?",
      message: "Important: Before enabling CAPTCHA, please test your configuration using the 'Test CAPTCHA' button.",
      risks: [
        "If CAPTCHA keys are incorrect, NO ONE will be able to register new accounts",
        "You may lock yourself out from creating new admin accounts",
        "Existing users won't be affected, but new signups will be blocked",
      ],
      recommendation: "✅ Recommended: Test your CAPTCHA configuration first, then enable it.",
    },
    "email-verification": {
      title: "⚠️ Enable Email Verification?",
      message: "Important: Before enabling email verification, please test your SMTP configuration.",
      risks: [
        "If SMTP settings are incorrect, users won't receive verification emails",
        "New users won't be able to complete registration",
        "You may lock yourself out if you create a new account",
        "Existing users will NOT be affected",
      ],
      recommendation: "✅ Recommended: Send a test email first to verify SMTP is working correctly.",
    },
  }

  const warning = warnings[type]

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
        {warning.title}
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: 'var(--foreground)', mb: 2 }}>
          {warning.message}
        </Typography>

        <div className="p-4 bg-red-900/10 border border-red-800 rounded-lg mb-3">
          <Typography variant="subtitle2" sx={{ color: 'var(--foreground)', fontWeight: 600, mb: 1 }}>
            ⚠️ Potential Risks:
          </Typography>
          <ul className="space-y-1 text-sm text-[var(--foreground-muted)]">
            {warning.risks.map((risk, index) => (
              <li key={index}>• {risk}</li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-[var(--primary)]/10 border border-[var(--primary-dark)]/30 rounded-lg">
          <Typography variant="body2" sx={{ color: 'var(--foreground)' }}>
            {warning.recommendation}
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
          Cancel
        </Button>
        <Button 
          onClick={onConfirm}
          variant="contained"
          sx={{ 
            backgroundColor: 'var(--primary)',
            '&:hover': { backgroundColor: 'var(--primary-hover)' }
          }}
        >
          I Understand, Enable It
        </Button>
      </DialogActions>
    </Dialog>
  )
}

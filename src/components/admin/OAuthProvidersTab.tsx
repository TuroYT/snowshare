"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  IconButton
} from "@mui/material"
import { Close as CloseIcon } from "@mui/icons-material"
import { availableProviders } from "@/lib/providers"
import Link from "next/link"

interface OAuthProvider {
  id: string
  name: string
  displayName: string
  enabled: boolean
  clientId: string | null
  updatedAt: string
}

const CALLBBACK_PATH = "/api/auth/callback/"

export default function OAuthProvidersTab() {
  const { t } = useTranslation()
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    clientId: "",
    clientSecret: "",
    enabled: false
  })
  const [origin, setOrigin] = useState("")

  

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/admin/oauth-providers")
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers)
      }
    } catch (error) {
      console.error("Failed to fetch providers", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
    setOrigin(window.location.origin)
  }, [])

  const handleEdit = (providerName: string) => {
    const provider = providers.find(p => p.name === providerName)
    if (provider) {
      setFormData({
        name: provider.name,
        displayName: provider.displayName,
        clientId: provider.clientId || "",
        clientSecret: "", // Never show secret
        enabled: provider.enabled
      })
    } else {
      const defaultName = availableProviders.find(p => p.id === providerName)?.name || providerName
      setFormData({
        name: providerName,
        displayName: defaultName,
        clientId: "",
        clientSecret: "",
        enabled: false
      })
    }
    setEditingProvider(providerName)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/admin/oauth-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        await fetchProviders()
        setEditingProvider(null)
      }
    } catch (error) {
      console.error("Failed to save provider", error)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom color="text.primary">
          {t("admin.oauth.title", "Fournisseurs OAuth")}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t("admin.oauth.description", "Configurez les fournisseurs d'authentification externes. Vous devrez créer une application OAuth sur la console développeur du fournisseur.")}
        </Typography>

        <Grid container spacing={3}>
          {availableProviders.map((p) => {
            const configured = providers.find(cp => cp.name === p.id)
            const isEnabled = configured?.enabled

            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={p.id}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderColor: isEnabled ? 'success.main' : 'divider',
                    bgcolor: isEnabled ? 'rgba(76, 175, 80, 0.04)' : 'background.default'
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {p.name}
                    </Typography>
                    <Chip 
                      label={isEnabled ? t("admin.oauth.enabled", "Activé") : t("admin.oauth.disabled", "Désactivé")}
                      color={isEnabled ? "success" : "default"}
                      size="small"
                      variant={isEnabled ? "filled" : "outlined"}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                    {configured 
                      ? `${t("admin.oauth.client_id", "Client ID")}: ${configured.clientId?.substring(0, 8)}...` 
                      : t("admin.oauth.not_configured", "Non configuré")}
                  </Typography>

                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={() => handleEdit(p.id)}
                  >
                    {configured ? t("admin.oauth.edit", "Configurer") : t("admin.oauth.setup", "Installer")}
                  </Button>
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      </Paper>

      <Dialog 
        open={!!editingProvider} 
        onClose={() => setEditingProvider(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            {t("admin.oauth.configure_provider", "Configurer {{provider}}", { provider: availableProviders.find(p => p.id === editingProvider)?.name })}
            <IconButton onClick={() => setEditingProvider(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <form onSubmit={handleSave}>
          <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 1 }}>
              <Typography variant="caption" display="block" gutterBottom fontWeight="bold">
                {t("admin.oauth.callback_url", "URL de Callback (Redirect URI)")}
              </Typography>
              
              <Box 
                component="code" 
                sx={{ 
                  display: 'block',
                  p: 1,
                  bgcolor: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  userSelect: 'all'
                }}
              >
                {origin}{CALLBBACK_PATH}{editingProvider}
              </Box>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                {t("admin.oauth.callback_help", "Copiez cette URL dans les paramètres de votre fournisseur OAuth.")}
              </Typography>
            </Alert>

            <Alert severity="info" sx={{ mb: 3, mt: 0 }}>
              <Typography variant="caption" display="block" gutterBottom fontWeight="bold">
                {t("admin.oauth.documentation", "Documentation du fournisseur")}
              </Typography>
              <Link 
                href={availableProviders.find(p => p.id === editingProvider)?.documentationUrl || "#"} 
                target="_BLANK" 
                rel="noopener noreferrer"
                style={{ wordBreak: 'break-all' }}
              >
                {availableProviders.find(p => p.id === editingProvider)?.documentationUrl}
              </Link>
            </Alert>

            <Box display="flex" flexDirection="column" gap={2}>
              

              <TextField
                label={t("admin.oauth.client_id_field", "Client ID")}
                value={formData.clientId}
                onChange={e => setFormData({...formData, clientId: e.target.value})}
                fullWidth
                required
                variant="outlined"
              />

              <TextField
                label={t("admin.oauth.client_secret", "Client Secret")}
                type="password"
                value={formData.clientSecret}
                onChange={e => setFormData({...formData, clientSecret: e.target.value})}
                fullWidth
                variant="outlined"
                placeholder={providers.find(p => p.name === editingProvider)?.clientId ? t("admin.oauth.secret_placeholder", "(Laisser vide pour ne pas changer)") : ""}
                helperText={t("admin.oauth.secret_help", "Le secret est chiffré avant d'être stocké.")}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={e => setFormData({...formData, enabled: e.target.checked})}
                    color="primary"
                  />
                }
                label={t("admin.oauth.enable_provider", "Activer ce fournisseur")}
              />
            </Box>
          </DialogContent>
          
          <DialogActions>
            <Button onClick={() => setEditingProvider(null)} color="inherit">
              {t("common.cancel", "Annuler")}
            </Button>
            <Button type="submit" variant="contained" color="primary">
              {t("common.save", "Enregistrer")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}

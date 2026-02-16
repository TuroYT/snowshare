"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useState, useEffect, SetStateAction } from "react"
import { useTheme } from "@/hooks/useTheme"
import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Typography,
  Select,
  SelectChangeEvent,
  FormControl,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material"
import {
  Menu as MenuIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  ExitToApp as LogoutIcon,
} from "@mui/icons-material"
import { languages } from "@/i18n/client"

export default function Navigation() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { branding, colors } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [showSignupButton, setShowSignupButton] = useState(true)

  // Fetch signup status from database
  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check")
        if (response.ok) {
          const data = await response.json()
          setShowSignupButton(data.allowSignup && data.onlySSOMode === false)
        }
      } catch (error) {
        console.error("Error fetching signup status:", error)
        setShowSignupButton(true) // Default to true on error
      }
    }

    fetchSignupStatus()
  }, [])

  const handleSignOut = async () => {
    setMobileOpen(false)
    setProfileMenuAnchor(null)
    await signOut({ redirect: false })
    router.push("/")
  }

  // Fetch user's profile to determine admin status (endpoint returns { isAdmin })
  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((data) => {
        if (!data) return
        setIsAdmin(data.user.isAdmin)
      })
  }, [status])

  // changeLang optionally closes the mobile menu and persists choice to localStorage.
  const changeLang = (lng: string, closeMenu = false) => {
    i18n.changeLanguage(lng)
    try {
      localStorage.setItem('i18nextLng', lng)
    } catch {
      // ignore if not available
    }
    if (closeMenu) setMobileOpen(false)
  }

  const currentLang = (i18n.language || 'en').split('-')[0]

  if (status === "loading") {
    return (
      <AppBar position="sticky" sx={{ bgcolor: 'var(--surface)', color: 'var(--foreground)' }}>
        <Toolbar>
          <Typography suppressHydrationWarning>{t('loading')}</Typography>
        </Toolbar>
      </AppBar>
    )
  }

  return (
    <>
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{ 
          bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 95%, transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${colors.borderColor} 50%, transparent)`,
        }}
      >
        <Toolbar sx={{ maxWidth: '1280px', width: '100%', mx: 'auto', px: { xs: 2, sm: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <Box sx={{ position: 'relative' }}>
                {branding.logoUrl ? (
                  <Image src={branding.logoUrl} alt={`${branding.appName} Logo`} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'contain' }} />
                ) : (
                  <Image src="/logo.svg" alt={`${branding.appName} Logo`} width={36} height={36} />
                )}
              </Box>
              <Typography
                variant="h6"
                component="span"
                sx={{
                  fontWeight: 700,
                  background: `linear-gradient(to right, var(--primary), var(--secondary))`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  '&:hover': { opacity: 0.8 }
                }}
              >
                {branding.appName}
              </Typography>
            </Link>
          </Box>

          {/* Desktop Navigation */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 2 }}>
            <FormControl size="small">
              <Select
                value={currentLang}
                onChange={(e: SelectChangeEvent<string>) => changeLang(e.target.value)}
                sx={{
                  bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 50%, transparent)`,
                  color: 'var(--foreground)',
                  border: `1px solid color-mix(in srgb, ${colors.borderColor} 50%, transparent)`,
                  borderRadius: '12px',
                  minWidth: '80px',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-select': { py: 1 }
                }}
              >
                {languages.map((lng) => (
                  <MenuItem key={lng.code} value={lng.code}>{lng.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {session ? (
              <>
                <IconButton
                  onClick={(e: { currentTarget: SetStateAction<HTMLElement | null> }) => setProfileMenuAnchor(e.currentTarget)}
                  sx={{ p: 0 }}
                >
                  <Avatar
                    sx={{
                      background: 'linear-gradient(to bottom right, var(--primary), var(--secondary))',
                      width: 36,
                      height: 36
                    }}
                  >
                    {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={profileMenuAnchor}
                  open={Boolean(profileMenuAnchor)}
                  onClose={() => setProfileMenuAnchor(null)}
                  PaperProps={{
                    sx: {
                      bgcolor: 'var(--surface)',
                      border: `1px solid color-mix(in srgb, ${colors.borderColor} 50%, transparent)`,
                      borderRadius: '12px',
                      minWidth: '220px'
                    }
                  }}
                >
                  <MenuItem
                    component={Link}
                    href="/profile"
                    onClick={() => setProfileMenuAnchor(null)}
                    sx={{ color: 'var(--foreground)' }}
                  >
                    <ListItemIcon>
                      <PersonIcon sx={{ color: 'var(--primary)' }} />
                    </ListItemIcon>
                    <ListItemText primary={t('nav.profile', 'Mon Profil')} />
                  </MenuItem>
                  {isAdmin && [
                    <Divider key="admin-divider" sx={{ borderColor: `color-mix(in srgb, ${colors.borderColor} 50%, transparent)` }} />,
                    <MenuItem
                      key="admin-item"
                      component={Link}
                      href="/admin"
                      onClick={() => setProfileMenuAnchor(null)}
                      sx={{ color: 'var(--foreground)' }}
                    >
                      <ListItemIcon>
                        <AdminIcon sx={{ color: '#f59e0b' }} />
                      </ListItemIcon>
                      <ListItemText primary={t('nav.admin', 'Admin')} />
                    </MenuItem>
                  ]}
                  <Divider sx={{ borderColor: `color-mix(in srgb, ${colors.borderColor} 50%, transparent)` }} />
                  <MenuItem
                    onClick={handleSignOut}
                    sx={{ color: '#f87171' }}
                  >
                    <ListItemIcon>
                      <LogoutIcon sx={{ color: '#f87171' }} />
                    </ListItemIcon>
                    <ListItemText primary={t('nav.signout', 'Déconnexion')} />
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  component={Link}
                  href="/auth/signin"
                  sx={{
                    color: 'var(--foreground)',
                    textTransform: 'none',
                    '&:hover': { bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 50%, transparent)` }
                  }}
                >
                  {t('nav.signin')}
                </Button>
                {showSignupButton && (
                  <Button
                    component={Link}
                    href="/auth/signup"
                    variant="contained"
                    sx={{
                      background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                      textTransform: 'none',
                      borderRadius: '12px',
                      '&:hover': {
                        boxShadow: '0 20px 25px -5px rgb(from var(--primary) r g b / 0.3)'
                      }
                    }}
                  >
                    {t('nav.signup')}
                  </Button>
                )}
              </>
            )}
          </Box>

          {/* Mobile Menu Button */}
          <IconButton
            sx={{ display: { xs: 'flex', sm: 'none' }, color: 'var(--foreground)' }}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 98%, transparent)`,
            color: 'var(--foreground)',
            width: '280px'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <FormControl fullWidth size="small">
            <Select
              value={currentLang}
              onChange={(e: SelectChangeEvent<string>) => changeLang(e.target.value, true)}
              sx={{
                bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 50%, transparent)`,
                color: 'var(--foreground)',
                border: `1px solid color-mix(in srgb, ${colors.borderColor} 50%, transparent)`,
                borderRadius: '12px',
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
              }}
            >
              {languages.map((lng) => (
                <MenuItem key={lng.code} value={lng.code}>{lng.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {session ? (
          <List>
            <ListItem sx={{ py: 2, px: 2 }}>
              <Avatar
                sx={{
                  background: 'linear-gradient(to bottom right, var(--primary), var(--secondary))',
                  mr: 2
                }}
              >
                {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || session.user?.email?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" noWrap>
                {session.user?.name || session.user?.email}
              </Typography>
            </ListItem>
            <Divider sx={{ borderColor: `color-mix(in srgb, ${colors.borderColor} 50%, transparent)` }} />
            <ListItem
              component={Link}
              href="/profile"
              onClick={() => setMobileOpen(false)}
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 50%, transparent)` } }}
            >
              <ListItemIcon>
                <PersonIcon sx={{ color: 'var(--primary)' }} />
              </ListItemIcon>
              <ListItemText primary={t('nav.profile', 'Mon Profil')} />
            </ListItem>
            {isAdmin && (
              <ListItem
                component={Link}
                href="/admin"
                onClick={() => setMobileOpen(false)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 50%, transparent)` } }}
              >
                <ListItemIcon>
                  <AdminIcon sx={{ color: '#f59e0b' }} />
                </ListItemIcon>
                <ListItemText primary={t('nav.admin', 'Admin')} />
              </ListItem>
            )}
            <Divider sx={{ borderColor: `color-mix(in srgb, ${colors.borderColor} 50%, transparent)` }} />
            <ListItem
              onClick={handleSignOut}
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(220, 38, 38, 0.2)' }, color: '#f87171' }}
            >
              <ListItemIcon>
                <LogoutIcon sx={{ color: '#f87171' }} />
              </ListItemIcon>
              <ListItemText primary={t('nav.signout', 'Déconnexion')} />
            </ListItem>
          </List>
        ) : (
          <List>
            <ListItem
              component={Link}
              href="/auth/signin"
              onClick={() => setMobileOpen(false)}
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: `color-mix(in srgb, ${colors.surfaceColor} 50%, transparent)` } }}
            >
              <ListItemText primary={t('nav.signin')} />
            </ListItem>
            {showSignupButton && (
              <ListItem
                component={Link}
                href="/auth/signup"
                onClick={() => setMobileOpen(false)}
                sx={{
                  cursor: 'pointer',
                  background: 'linear-gradient(to right, var(--primary), var(--secondary))',
                  borderRadius: '12px',
                  mx: 2,
                  mt: 1
                }}
              >
                <ListItemText primary={t('nav.signup')} sx={{ textAlign: 'center' }} />
              </ListItem>
            )}
          </List>
        )}
      </Drawer>
    </>
  )
}

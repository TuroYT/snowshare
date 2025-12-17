"use client"

import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ReactNode, useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface MuiThemeProviderProps {
  children: ReactNode
}

// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    const r = parseInt(result[1], 16)
    const g = parseInt(result[2], 16)
    const b = parseInt(result[3], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return hex
}

export default function MuiThemeProvider({ children }: MuiThemeProviderProps) {
  const { colors } = useTheme()

  const theme = useMemo(() => {
    // Use dynamic theme colors from ThemeContext
    const primaryColor = colors.primaryColor
    const primaryHover = colors.primaryHover
    const primaryDark = colors.primaryDark
    const secondaryColor = colors.secondaryColor
    const backgroundColor = colors.backgroundColor
    const surfaceColor = colors.surfaceColor
    const textColor = colors.textColor
    const textMuted = colors.textMuted
    const borderColor = colors.borderColor

    // Create rgba variants for transparency effects
    const surfaceTransparent = hexToRgba(surfaceColor, 0.95)
    const surfaceTransparentHigh = hexToRgba(surfaceColor, 0.98)
    const surfaceTransparentLow = hexToRgba(surfaceColor, 0.5)
    const borderTransparent = hexToRgba(borderColor, 0.5)
    const borderTransparentHigh = hexToRgba(borderColor, 0.7)
    
    return createTheme({
      palette: {
        mode: 'dark',
        primary: {
          main: primaryColor,
          light: primaryHover,
          dark: primaryDark,
        },
        secondary: {
          main: secondaryColor,
          light: colors.secondaryHover,
          dark: colors.secondaryDark,
        },
        background: {
          default: backgroundColor,
          paper: surfaceTransparent,
        },
        text: {
          primary: textColor,
          secondary: textMuted,
        },
        divider: borderTransparent,
      },
      typography: {
        fontFamily: 'var(--font-geist-sans), Arial, Helvetica, sans-serif',
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '12px',
              padding: '10px 24px',
            },
            contained: {
              boxShadow: 'none',
              '&:hover': {
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
              },
            },
          },
        },
        MuiTextField: {
          styleOverrides: {
            root: {
              '& .MuiOutlinedInput-root': {
                backgroundColor: surfaceTransparentLow,
                borderRadius: '12px',
                '& fieldset': {
                  borderColor: borderTransparent,
                },
                '&:hover fieldset': {
                  borderColor: borderTransparentHigh,
                },
                '&.Mui-focused fieldset': {
                  borderColor: primaryColor,
                },
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundColor: surfaceTransparent,
              borderRadius: '16px',
              border: `1px solid ${borderTransparent}`,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: surfaceTransparent,
              boxShadow: 'none',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backgroundColor: surfaceTransparentHigh,
              border: `1px solid ${borderTransparent}`,
            },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              '&:hover': {
                backgroundColor: borderTransparent,
              },
            },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: {
              borderRadius: '12px',
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: surfaceTransparentHigh,
            },
          },
        },
      },
    })
  }, [colors])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

"use client"

import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ReactNode, useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface MuiThemeProviderProps {
  children: ReactNode
}

export default function MuiThemeProvider({ children }: MuiThemeProviderProps) {
  const { colors } = useTheme()

  const theme = useMemo(() => {
    // Parse CSS color values
    const primaryColor = colors.primaryColor || '#3b82f6'
    const secondaryColor = colors.secondaryColor || '#8b5cf6'
    
    return createTheme({
      palette: {
        mode: 'dark',
        primary: {
          main: primaryColor,
        },
        secondary: {
          main: secondaryColor,
        },
        background: {
          default: '#111827',
          paper: 'rgba(31, 41, 55, 0.95)',
        },
        text: {
          primary: '#f9fafb',
          secondary: '#d1d5db',
        },
        divider: 'rgba(55, 65, 81, 0.5)',
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
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                borderRadius: '12px',
                '& fieldset': {
                  borderColor: 'rgba(75, 85, 99, 0.5)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(75, 85, 99, 0.7)',
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
              backgroundColor: 'rgba(31, 41, 55, 0.95)',
              borderRadius: '16px',
              border: '1px solid rgba(55, 65, 81, 0.5)',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: 'rgba(31, 41, 55, 0.95)',
              boxShadow: 'none',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backgroundColor: 'rgba(31, 41, 55, 0.98)',
              border: '1px solid rgba(55, 65, 81, 0.5)',
            },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              '&:hover': {
                backgroundColor: 'rgba(55, 65, 81, 0.5)',
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
              backgroundColor: 'rgba(31, 41, 55, 0.98)',
            },
          },
        },
      },
    })
  }, [colors.primaryColor, colors.secondaryColor])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

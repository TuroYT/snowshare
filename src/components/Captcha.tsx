"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useTheme } from "@/hooks/useTheme"

interface CaptchaProps {
  onVerify: (token: string) => void
  provider: string | null
  siteKey: string | null
}

// Script reference counting for proper lifecycle management
const scriptRefCount = new Map<string, number>()

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      render: (container: HTMLElement | string, params: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark'
        size?: 'normal' | 'compact'
      }) => number
      execute: {
        (widgetId: number): void
        (siteKey: string, options: { action: string }): Promise<string>
      }
      reset: (widgetId: number) => void
    }
    turnstile?: {
      ready: (callback: () => void) => void
      render: (container: HTMLElement | string, params: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
        size?: 'normal' | 'compact'
        retry?: 'auto' | 'never'
        'retry-interval'?: number
        language?: string
      }) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export default function Captcha({ onVerify, provider, siteKey }: CaptchaProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | string | null>(null)
  const { colors } = useTheme()
  const [captchaError, setCaptchaError] = useState(false)
  
  // Detect dark mode from background color
  const isDarkMode = useMemo(() => {
    if (!colors?.backgroundColor) return true
    
    // Parse hex color to RGB
    const hex = colors.backgroundColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Dark if luminance < 0.5
    return luminance < 0.5
  }, [colors])

  useEffect(() => {
    if (!provider || !siteKey) return

    let scriptSrc = ""
    
    if (provider === "recaptcha-v2") {
      scriptSrc = "https://www.google.com/recaptcha/api.js"
    } else if (provider === "recaptcha-v3") {
      scriptSrc = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    } else if (provider === "turnstile") {
      scriptSrc = "https://challenges.cloudflare.com/turnstile/v0/api.js"
    }

    // Check if script already exists (check base URL without query params)
    const baseScriptSrc = scriptSrc.split('?')[0]
    const existingScript = document.querySelector(`script[src^="${baseScriptSrc}"]`)
    if (existingScript) {
      setScriptLoaded(true)
      // Increment reference count
      const currentCount = scriptRefCount.get(scriptSrc) || 0
      scriptRefCount.set(scriptSrc, currentCount + 1)
      return
    }

    const script = document.createElement("script")
    script.src = scriptSrc
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
    
    // Initialize reference count
    scriptRefCount.set(scriptSrc, 1)

    return () => {
      // Decrement reference count
      const currentCount = scriptRefCount.get(scriptSrc) || 0
      const newCount = currentCount - 1
      
      if (newCount <= 0) {
        // Only remove script if no other instances are using it
        scriptRefCount.delete(scriptSrc)
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        
        // Cleanup global objects
        if (provider === "recaptcha-v2" || provider === "recaptcha-v3") {
          delete window.grecaptcha
        } else if (provider === "turnstile") {
          delete window.turnstile
        }
      } else {
        scriptRefCount.set(scriptSrc, newCount)
      }
    }
  }, [provider, siteKey])

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !siteKey) return

    const renderCaptcha = () => {
      if (provider === "recaptcha-v2" && window.grecaptcha) {
        window.grecaptcha.ready(() => {
          if (containerRef.current && !widgetIdRef.current) {
            try {
              widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
                sitekey: siteKey,
                callback: onVerify,
                'expired-callback': () => {
                  setCaptchaError(false)
                  onVerify("")
                },
                theme: isDarkMode ? 'dark' : 'light',
                size: 'normal',
              })
              setCaptchaError(false)
            } catch (err) {
              console.error("Error rendering reCAPTCHA:", err)
              setCaptchaError(true)
            }
          }
        })
      } else if (provider === "recaptcha-v3" && window.grecaptcha) {
        window.grecaptcha.ready(() => {
          window.grecaptcha!.execute(siteKey, { action: "register" }).then((token: string) => {
            onVerify(token)
            setCaptchaError(false)
          }).catch((err: Error) => {
            console.error("Error executing reCAPTCHA v3:", err)
            setCaptchaError(true)
          })
        })
      } else if (provider === "turnstile" && window.turnstile) {
        window.turnstile.ready(() => {
          if (containerRef.current && !widgetIdRef.current) {
            try {
              widgetIdRef.current = window.turnstile!.render(containerRef.current, {
                sitekey: siteKey,
                callback: onVerify,
                'expired-callback': () => {
                  setCaptchaError(false)
                  onVerify("")
                },
                'error-callback': () => {
                  console.error("Turnstile error callback triggered")
                  setCaptchaError(true)
                  onVerify("")
                },
                theme: 'auto', // Automatically matches system theme
                size: 'normal',
                retry: 'auto', // Automatically retry on network errors
                'retry-interval': 8000, // 8 seconds between retries
              })
              setCaptchaError(false)
            } catch (err) {
              console.error("Error rendering Turnstile:", err)
              setCaptchaError(true)
            }
          }
        })
      }
    }

    // Small delay to ensure DOM is ready
    setTimeout(renderCaptcha, 100)
    
    // Cleanup widget on unmount
    return () => {
      if (widgetIdRef.current !== null) {
        try {
          if (provider === "turnstile" && window.turnstile && typeof widgetIdRef.current === 'string') {
            window.turnstile.remove(widgetIdRef.current)
          }
        } catch (err) {
          console.error("Error cleaning up CAPTCHA widget:", err)
        }
        widgetIdRef.current = null
      }
    }
  }, [scriptLoaded, provider, siteKey, onVerify, colors, isDarkMode])

  // For reCAPTCHA v3, we don't need to render anything visible
  if (provider === "recaptcha-v3") {
    return null
  }

  return (
    <div>
      <div ref={containerRef} className="flex justify-center my-4">
        {!scriptLoaded && (
          <div className="text-sm text-[var(--foreground-muted)]">
            Loading CAPTCHA...
          </div>
        )}
      </div>
      {captchaError && (
        <div className="text-sm text-red-600 text-center mt-2">
          Failed to load CAPTCHA. Please refresh the page.
        </div>
      )}
    </div>
  )
}

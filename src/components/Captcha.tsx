"use client"

import { useEffect, useState, useRef } from "react"

interface CaptchaProps {
  onVerify: (token: string) => void
  provider: string | null
  siteKey: string | null
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      render: (container: HTMLElement | string, params: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
      }) => number
      execute: (widgetId: number) => void
      reset: (widgetId: number) => void
    }
    turnstile?: {
      ready: (callback: () => void) => void
      render: (container: HTMLElement | string, params: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
      }) => string
      reset: (widgetId: string) => void
    }
  }
}

export default function Captcha({ onVerify, provider, siteKey }: CaptchaProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | string | null>(null)

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

    // Check if script already exists
    const existingScript = document.querySelector(`script[src^="${scriptSrc}"]`)
    if (existingScript) {
      setScriptLoaded(true)
      return
    }

    const script = document.createElement("script")
    script.src = scriptSrc
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)

    return () => {
      // Cleanup if component unmounts
      if (script.parentNode) {
        script.parentNode.removeChild(script)
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
                'expired-callback': () => onVerify(""),
              })
            } catch (err) {
              console.error("Error rendering reCAPTCHA:", err)
            }
          }
        })
      } else if (provider === "recaptcha-v3" && window.grecaptcha) {
        window.grecaptcha.ready(() => {
          window.grecaptcha!.execute(siteKey, { action: "register" }).then((token: string) => {
            onVerify(token)
          })
        })
      } else if (provider === "turnstile" && window.turnstile) {
        window.turnstile.ready(() => {
          if (containerRef.current && !widgetIdRef.current) {
            try {
              widgetIdRef.current = window.turnstile!.render(containerRef.current, {
                sitekey: siteKey,
                callback: onVerify,
                'expired-callback': () => onVerify(""),
              })
            } catch (err) {
              console.error("Error rendering Turnstile:", err)
            }
          }
        })
      }
    }

    // Small delay to ensure DOM is ready
    setTimeout(renderCaptcha, 100)
  }, [scriptLoaded, provider, siteKey, onVerify])

  // For reCAPTCHA v3, we don't need to render anything visible
  if (provider === "recaptcha-v3") {
    return null
  }

  return (
    <div ref={containerRef} className="flex justify-center my-4">
      {!scriptLoaded && (
        <div className="text-sm text-[var(--foreground-muted)]">
          Loading CAPTCHA...
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"

export function useSignupStatus() {
  const [allowSignup, setAllowSignup] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check")
        if (response.ok) {
          const data = await response.json()
          setAllowSignup(data.allowSignup ?? true)
        }
      } catch (error) {
        console.error("Error fetching signup status:", error)
        // Default to true on error
        setAllowSignup(true)
      } finally {
        setLoading(false)
      }
    }

    fetchSignupStatus()
  }, [])

  return { allowSignup, loading }
}

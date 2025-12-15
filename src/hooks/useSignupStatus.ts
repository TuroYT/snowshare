"use client"

import { useState, useEffect } from "react"

export function useSignupStatus() {
  const [allowSignin, setallowSignin] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await fetch("/api/setup/check")
        if (response.ok) {
          const data = await response.json()
          setallowSignin(data.allowSignin ?? true)
        }
      } catch (error) {
        console.error("Error fetching signup status:", error)
        // Default to true on error
        setallowSignin(true)
      } finally {
        setLoading(false)
      }
    }

    fetchSignupStatus()
  }, [])

  return { allowSignin, loading }
}

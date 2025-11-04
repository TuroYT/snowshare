"use client"

//TODO

import { useState, useEffect } from "react"

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/user/profile")
        const data = await response.json()
        setIsAdmin(data.user.isAdmin)
      } catch (error) {
        console.error("Error fetching user role:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!isAdmin) {
    return <div>Access Denied. You do not have permission to view this page.</div>
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the admin panel. Here you can manage the application.</p>
    </div>
  )
}
"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"

interface User {
  id: string
  email: string
  name?: string
  isAdmin: boolean
  createdAt: string
  _count: {
    shares: number
  }
}

export default function UsersTab() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setUsers(data.users)
      setError(null)
    } catch (err) {
      setError(t("admin.error_load_data"))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleAction = async (userId: string, action: "promote" | "demote" | "delete") => {
    let confirmKey = "admin.users.confirm_delete"
    if (action === "promote") {
      confirmKey = "admin.users.confirm_make_admin"
    } else if (action === "demote") {
      confirmKey = "admin.users.confirm_remove_admin"
    }

    if (!window.confirm(t(confirmKey, { email: users.find(u => u.id === userId)?.email || "user" }))) {
      return
    }

    try {
      setActionLoading(userId)
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      })

      if (!response.ok) throw new Error("Failed to update user")
      
      // Refresh users list
      await fetchUsers()
      setError(null)
    } catch (err) {
      setError(t("admin.error_load_data"))
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(
    (user) => user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalUsers = users.length
  const adminUsers = users.filter((u) => u.isAdmin).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-400">{t("admin.loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-600/10 to-blue-800/10 border border-blue-700/30 rounded-xl p-4">
          <div className="text-sm text-gray-400">{t("admin.users.total_users")}</div>
          <div className="text-3xl font-bold text-blue-400 mt-1">{totalUsers}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600/10 to-purple-800/10 border border-purple-700/30 rounded-xl p-4">
          <div className="text-sm text-gray-400">{t("admin.users.admin_users")}</div>
          <div className="text-3xl font-bold text-purple-400 mt-1">{adminUsers}</div>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/10 border border-red-700/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder={t("admin.users.search_placeholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/30 border-b border-gray-700/50">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">{t("admin.users.table_headers.email")}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">{t("admin.users.table_headers.name")}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">{t("admin.users.table_headers.role")}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">{t("admin.users.table_headers.shares")}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">{t("admin.users.table_headers.created")}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">{t("admin.users.table_headers.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                  {t("admin.users.no_users")}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-700/20 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-300">{user.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{user.name || "-"}</td>
                  <td className="px-6 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isAdmin
                          ? "bg-yellow-600/20 border border-yellow-700/50 text-yellow-400"
                          : "bg-gray-700/50 border border-gray-600/50 text-gray-400"
                      }`}
                    >
                      {user.isAdmin ? t("admin.users.role_admin") : t("admin.users.role_user")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-400">{user._count.shares}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <div className="flex gap-2">
                      {!user.isAdmin ? (
                        <button
                          onClick={() => handleAction(user.id, "promote")}
                          disabled={actionLoading === user.id}
                          className="px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-700/50 rounded text-xs text-yellow-400 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === user.id ? "..." : t("admin.users.action_make_admin")}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(user.id, "demote")}
                          disabled={actionLoading === user.id}
                          className="px-2 py-1 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-700/50 rounded text-xs text-orange-400 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === user.id ? "..." : t("admin.users.action_remove_admin")}
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(user.id, "delete")}
                        disabled={actionLoading === user.id}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-700/50 rounded text-xs text-red-400 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.id ? "..." : t("admin.users.action_delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

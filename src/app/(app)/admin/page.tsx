"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield } from "lucide-react"

interface AdminUser {
  id: string
  name: string
  email: string
  role: "ADMIN" | "USER"
  createdAt: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const currentUser = session?.user as any

  useEffect(() => {
    if (status === "loading") return
    if (currentUser?.role !== "ADMIN") {
      router.replace("/dashboard")
      return
    }
    fetchUsers()
  }, [status, currentUser?.role])

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users")
      if (!res.ok) { router.replace("/dashboard"); return }
      const data = await res.json()
      setUsers(data)
    } catch {
      toast.error("Benutzer konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleRole(user: AdminUser) {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN"
    setTogglingId(user.id)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u)))
      toast.success(`Rolle von ${user.name} auf ${newRole} geändert.`)
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Ändern der Rolle.")
    } finally {
      setTogglingId(null)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Administration</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Benutzerverwaltung</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                E-Mail
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Rolle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Erstellt am
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                      {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
                    {user.id === currentUser?.id && (
                      <Badge variant="outline" className="text-xs">Du</Badge>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  {user.id !== currentUser?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleRole(user)}
                      disabled={togglingId === user.id}
                    >
                      {togglingId === user.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : user.role === "ADMIN" ? (
                        "Zu USER degradieren"
                      ) : (
                        "Zu ADMIN befördern"
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

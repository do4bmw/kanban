"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Shield, Users, Building2, LayoutDashboard, Trash2, Mail, Send, UserPlus } from "lucide-react"

interface AdminUser {
  id: string
  name: string
  email: string
  role: "ADMIN" | "USER"
  createdAt: string
}

interface AdminOrg {
  id: string
  name: string
  createdAt: string
  _count: { members: number; projects: number }
}

interface Stats {
  users: number
  orgs: number
  projects: number
  cards: number
}

type Tab = "overview" | "users" | "orgs" | "email"

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [orgs, setOrgs] = useState<AdminOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testMailTo, setTestMailTo] = useState("")
  const [sendingTest, setSendingTest] = useState(false)
  const [inviteTo, setInviteTo] = useState("")
  const [sendingInvite, setSendingInvite] = useState(false)

  const currentUser = session?.user as any

  useEffect(() => {
    if (status === "loading") return
    if (currentUser?.role !== "ADMIN") {
      router.replace("/dashboard")
      return
    }
    fetchAll()
  }, [status, currentUser?.role])

  async function fetchAll() {
    setLoading(true)
    try {
      const [statsRes, usersRes, orgsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
        fetch("/api/admin/orgs"),
      ])
      if (!statsRes.ok || !usersRes.ok || !orgsRes.ok) {
        router.replace("/dashboard")
        return
      }
      const [statsData, usersData, orgsData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        orgsRes.json(),
      ])
      setStats(statsData)
      setUsers(usersData)
      setOrgs(orgsData)
    } catch {
      toast.error("Daten konnten nicht geladen werden.")
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

  async function handleDeleteUser(user: AdminUser) {
    if (!confirm(`Benutzer "${user.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return
    setDeletingId(user.id)
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      setStats((s) => s ? { ...s, users: s.users - 1 } : s)
      toast.success(`Benutzer "${user.name}" gelöscht.`)
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Löschen.")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteOrg(org: AdminOrg) {
    if (!confirm(`Organisation "${org.name}" und alle zugehörigen Projekte wirklich löschen?`)) return
    setDeletingId(org.id)
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setOrgs((prev) => prev.filter((o) => o.id !== org.id))
      setStats((s) => s ? { ...s, orgs: s.orgs - 1 } : s)
      toast.success(`Organisation "${org.name}" gelöscht.`)
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Löschen.")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleTestMail(e: React.FormEvent) {
    e.preventDefault()
    setSendingTest(true)
    try {
      const res = await fetch("/api/admin/test-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testMailTo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Test-E-Mail an ${testMailTo} verschickt.`)
      setTestMailTo("")
    } catch (err: any) {
      toast.error(err.message || "Versand fehlgeschlagen.")
    } finally {
      setSendingTest(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSendingInvite(true)
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: inviteTo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Einladung an ${inviteTo} verschickt.`)
      setInviteTo("")
    } catch (err: any) {
      toast.error(err.message || "Versand fehlgeschlagen.")
    } finally {
      setSendingInvite(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Übersicht", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "users", label: "Benutzer", icon: <Users className="h-4 w-4" /> },
    { id: "orgs", label: "Organisationen", icon: <Building2 className="h-4 w-4" /> },
    { id: "email", label: "E-Mail", icon: <Mail className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Administration</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">System-Verwaltung</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Übersicht */}
      {tab === "overview" && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Benutzer", value: stats.users, icon: <Users className="h-5 w-5 text-indigo-600" /> },
            { label: "Organisationen", value: stats.orgs, icon: <Building2 className="h-5 w-5 text-emerald-600" /> },
            { label: "Projekte", value: stats.projects, icon: <LayoutDashboard className="h-5 w-5 text-amber-600" /> },
            { label: "Karten", value: stats.cards, icon: <Shield className="h-5 w-5 text-rose-600" /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                {stat.icon}
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Benutzer */}
      {tab === "users" && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {["Name", "E-Mail", "Rolle", "Registriert", "Aktionen"].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ${h === "Aktionen" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
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
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {user.id !== currentUser?.id && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleRole(user)}
                          disabled={togglingId === user.id || deletingId === user.id}
                        >
                          {togglingId === user.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : user.role === "ADMIN" ? (
                            "Zu USER"
                          ) : (
                            "Zu ADMIN"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                          onClick={() => handleDeleteUser(user)}
                          disabled={togglingId === user.id || deletingId === user.id}
                        >
                          {deletingId === user.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* E-Mail */}
      {tab === "email" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Test-Mail */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Test-E-Mail</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Sendet eine Test-E-Mail um die SMTP-Konfiguration zu prüfen.
            </p>
            <form onSubmit={handleTestMail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="test-mail-to">Empfänger</Label>
                <Input
                  id="test-mail-to"
                  type="email"
                  placeholder="test@example.com"
                  value={testMailTo}
                  onChange={(e) => setTestMailTo(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={sendingTest} className="w-full">
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Test-Mail senden
              </Button>
            </form>
          </div>

          {/* Benutzer einladen */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Benutzer einladen</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Sendet eine Einladungs-E-Mail mit einem Registrierungslink an eine externe E-Mail-Adresse.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-to">E-Mail-Adresse</Label>
                <Input
                  id="invite-to"
                  type="email"
                  placeholder="neuerpnutzer@example.com"
                  value={inviteTo}
                  onChange={(e) => setInviteTo(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={sendingInvite} className="w-full">
                {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Einladung senden
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Organisationen */}
      {tab === "orgs" && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {["Org-Name", "Mitglieder", "Projekte", "Erstellt", "Aktionen"].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 ${h === "Aktionen" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {org._count.members}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {org._count.projects}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(org.createdAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                      onClick={() => handleDeleteOrg(org)}
                      disabled={deletingId === org.id}
                    >
                      {deletingId === org.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

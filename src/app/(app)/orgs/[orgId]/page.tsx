"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Columns3,
  Copy,
  FolderKanban,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"

interface Project {
  id: string
  name: string
  description: string | null
  _count: { columns: number }
}

interface Member {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface OrgPageProps {
  params: Promise<{ orgId: string }>
}

export default function OrgPage({ params }: OrgPageProps) {
  const { orgId } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState<"projects" | "members">("projects")
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgName, setOrgName] = useState("")
  const [loading, setLoading] = useState(true)
  const [currentMemberRole, setCurrentMemberRole] = useState<string>("MEMBER")

  // Create project dialog
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")
  const [creating, setCreating] = useState(false)

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("MEMBER")
  const [inviting, setInviting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState("")

  useEffect(() => {
    fetchData()
  }, [orgId])

  async function fetchData() {
    setLoading(true)
    try {
      const [projRes, membRes] = await Promise.all([
        fetch(`/api/orgs/${orgId}/projects`),
        fetch(`/api/orgs/${orgId}/members`),
      ])

      if (!projRes.ok || !membRes.ok) {
        toast.error("Fehler beim Laden der Daten")
        return
      }

      const projData: Project[] = await projRes.json()
      const membData: Member[] = await membRes.json()

      setProjects(projData)
      setMembers(membData)

      // Get org name from members response or try another way
      if (membData.length > 0) {
        // Try to get org info
        const meRes = await fetch("/api/orgs")
        if (meRes.ok) {
          const orgs = await meRes.json()
          const org = orgs.find((o: any) => o.id === orgId)
          if (org) {
            setOrgName(org.name)
            // Determine current user role
            const currentUser = membData.find((m: any) => {
              return true // we'll get from session
            })
          }
        }
      }

      // Determine current user role from session
      const sessionRes = await fetch("/api/auth/session")
      if (sessionRes.ok) {
        const session = await sessionRes.json()
        const myId = session?.user?.id
        const me = membData.find((m) => m.user.id === myId)
        if (me) setCurrentMemberRole(me.role)
        if (!orgName) {
          const orgsRes = await fetch("/api/orgs")
          if (orgsRes.ok) {
            const orgs = await orgsRes.json()
            const org = orgs.find((o: any) => o.id === orgId)
            if (org) setOrgName(org.name)
          }
        }
      }
    } catch {
      toast.error("Fehler beim Laden")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() || undefined }),
      })
      if (!res.ok) throw new Error("Fehler")
      const project = await res.json()
      setProjects((prev) => [...prev, { ...project, _count: { columns: 0 } }])
      setProjectDialogOpen(false)
      setNewProjectName("")
      setNewProjectDesc("")
      toast.success(`Projekt "${project.name}" erstellt.`)
    } catch {
      toast.error("Projekt konnte nicht erstellt werden.")
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) throw new Error("Fehler")
      const data = await res.json()
      setInviteUrl(data.inviteUrl)
      toast.success("Einladung erstellt!")
    } catch {
      toast.error("Einladung konnte nicht erstellt werden.")
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Mitglied wirklich entfernen?")) return
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setMembers((prev) => prev.filter((m) => m.user.id !== userId))
      toast.success("Mitglied entfernt.")
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Entfernen.")
    }
  }

  const canManage = ["OWNER", "ADMIN"].includes(currentMemberRole)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Organisation</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{orgName || "Organisation"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) { setInviteUrl(""); setInviteEmail(""); } }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4" />
                  Einladen
                </Button>
              </DialogTrigger>
              <DialogContent>
                {!inviteUrl ? (
                  <form onSubmit={handleInvite}>
                    <DialogHeader>
                      <DialogTitle>Mitglied einladen</DialogTitle>
                      <DialogDescription>Sende einen Einladungslink an eine E-Mail-Adresse.</DialogDescription>
                    </DialogHeader>
                    <div className="my-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">E-Mail</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="name@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">Rolle</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger id="invite-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Mitglied</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="VIEWER">Betrachter</SelectItem>
                            <SelectItem value="OWNER">Eigentümer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Abbrechen
                      </Button>
                      <Button type="submit" disabled={inviting}>
                        {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Einladung erstellen
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Einladungslink</DialogTitle>
                      <DialogDescription>Kopiere diesen Link und sende ihn an {inviteEmail}.</DialogDescription>
                    </DialogHeader>
                    <div className="my-6">
                      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                        <code className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300">{inviteUrl}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Kopiert!") }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Der Link ist 7 Tage gültig.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => { setInviteDialogOpen(false); setInviteUrl(""); setInviteEmail("") }}>
                        Fertig
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Projekt erstellen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateProject}>
                <DialogHeader>
                  <DialogTitle>Neues Projekt</DialogTitle>
                  <DialogDescription>Erstelle ein neues Kanban-Projekt für diese Organisation.</DialogDescription>
                </DialogHeader>
                <div className="my-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Name</Label>
                    <Input
                      id="project-name"
                      placeholder="Mein Projekt"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-desc">Beschreibung (optional)</Label>
                    <Input
                      id="project-desc"
                      placeholder="Kurze Beschreibung..."
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Erstellen
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab("projects")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "projects"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <FolderKanban className="h-4 w-4" />
          Projekte ({projects.length})
        </button>
        <button
          onClick={() => setTab("members")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "members"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <Users className="h-4 w-4" />
          Mitglieder ({members.length})
        </button>
      </div>

      {tab === "projects" && (
        <>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
              <Columns3 className="mb-4 h-12 w-12 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Noch keine Projekte</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Erstelle dein erstes Projekt.</p>
              <Button className="mt-4" onClick={() => setProjectDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Projekt erstellen
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FolderKanban className="h-5 w-5 text-indigo-600" />
                        {project.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.description && (
                        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {project._count.columns} Spalten
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "members" && (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{member.user.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{member.role}</Badge>
                {canManage && member.role !== "OWNER" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
                    onClick={() => handleRemoveMember(member.user.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Loader2, Trash2, UserPlus, Building2, LayoutDashboard } from "lucide-react"

interface SimpleUser {
  id: string
  name: string
  email: string
}

interface Member {
  id: string
  role: string
  user: SimpleUser
}

interface ProjectWithMembers {
  id: string
  name: string
  members: Member[]
}

interface Props {
  org: { id: string; name: string } | null
  allUsers: SimpleUser[]
  onClose: () => void
}

const ORG_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"]
const PROJECT_ROLES = ["ADMIN", "MEMBER", "VIEWER"]

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Eigentümer",
  ADMIN: "Administrator",
  MEMBER: "Mitglied",
  VIEWER: "Betrachter",
}

export function OrgMembersDialog({ org, allUsers, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [busy, setBusy] = useState(false)

  // add-org-member form
  const [addUserId, setAddUserId] = useState("")
  const [addRole, setAddRole] = useState("MEMBER")

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}/members`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMembers(data.members ?? [])
      setProjects(data.projects ?? [])
    } catch {
      toast.error("Mitglieder konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [org])

  useEffect(() => {
    if (org) {
      setAddUserId("")
      setAddRole("MEMBER")
      load()
    }
  }, [org, load])

  async function addOrgMember() {
    if (!org || !addUserId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Fehler")
      setAddUserId("")
      await load()
      toast.success("Mitglied hinzugefügt.")
    } catch (err: any) {
      toast.error(err.message || "Konnte nicht hinzufügen.")
    } finally {
      setBusy(false)
    }
  }

  async function removeOrgMember(userId: string) {
    if (!org) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Fehler")
      await load()
      toast.success("Mitglied entfernt.")
    } catch (err: any) {
      toast.error(err.message || "Konnte nicht entfernen.")
    } finally {
      setBusy(false)
    }
  }

  async function addProjectMember(projectId: string, userId: string, role: string) {
    if (!userId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Fehler")
      await load()
      toast.success("Zum Projekt hinzugefügt.")
    } catch (err: any) {
      toast.error(err.message || "Konnte nicht hinzufügen.")
    } finally {
      setBusy(false)
    }
  }

  async function removeProjectMember(projectId: string, userId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Fehler")
      await load()
      toast.success("Aus Projekt entfernt.")
    } catch (err: any) {
      toast.error(err.message || "Konnte nicht entfernen.")
    } finally {
      setBusy(false)
    }
  }

  const memberIds = new Set(members.map((m) => m.user.id))
  const usersNotInOrg = allUsers.filter((u) => !memberIds.has(u.id))

  return (
    <Dialog open={!!org} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {org?.name}
          </DialogTitle>
          <DialogDescription>
            Mitglieder der Organisation und ihrer Projekte verwalten.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Org members */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Organisations-Mitglieder ({members.length})
              </h3>
              <ul className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                {members.length === 0 && (
                  <li className="px-3 py-3 text-sm text-gray-400">Keine Mitglieder.</li>
                )}
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{m.user.name}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{m.user.email}</p>
                    </div>
                    <Badge variant="secondary">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                      onClick={() => removeOrgMember(m.user.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={addUserId} onValueChange={setAddUserId}>
                  <SelectTrigger className="h-9 flex-1 min-w-[180px]">
                    <SelectValue placeholder="Benutzer wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersNotInOrg.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-gray-400">Alle Benutzer sind Mitglieder</div>
                    ) : (
                      usersNotInOrg.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name} · {u.email}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORG_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addOrgMember} disabled={busy || !addUserId}>
                  <UserPlus className="h-4 w-4" />
                  Hinzufügen
                </Button>
              </div>
            </section>

            {/* Projects */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                Projekte ({projects.length})
              </h3>
              <div className="space-y-3">
                {projects.length === 0 && (
                  <p className="text-sm text-gray-400">Keine Projekte in dieser Organisation.</p>
                )}
                {projects.map((p) => (
                  <ProjectMemberBlock
                    key={p.id}
                    project={p}
                    allUsers={allUsers}
                    busy={busy}
                    onAdd={addProjectMember}
                    onRemove={removeProjectMember}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProjectMemberBlock({
  project,
  allUsers,
  busy,
  onAdd,
  onRemove,
}: {
  project: ProjectWithMembers
  allUsers: SimpleUser[]
  busy: boolean
  onAdd: (projectId: string, userId: string, role: string) => void
  onRemove: (projectId: string, userId: string) => void
}) {
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState("MEMBER")

  const memberIds = new Set(project.members.map((m) => m.user.id))
  const candidates = allUsers.filter((u) => !memberIds.has(u.id))

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="mb-2 flex items-center gap-2">
        <LayoutDashboard className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
        <span className="text-xs text-gray-400">· {project.members.length} direkte Mitglieder</span>
      </div>
      {project.members.length > 0 && (
        <ul className="mb-2 space-y-1">
          {project.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">
                {m.user.name} <span className="text-xs text-gray-400">· {m.user.email}</span>
              </span>
              <Badge variant="secondary" className="text-xs">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                onClick={() => onRemove(project.id, m.user.id)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="h-8 flex-1 min-w-[160px] text-xs">
            <SelectValue placeholder="Benutzer wählen…" />
          </SelectTrigger>
          <SelectContent>
            {candidates.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-gray-400">Alle Benutzer sind Mitglieder</div>
            ) : (
              candidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name} · {u.email}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECT_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => { onAdd(project.id, userId, role); setUserId("") }}
          disabled={busy || !userId}
        >
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

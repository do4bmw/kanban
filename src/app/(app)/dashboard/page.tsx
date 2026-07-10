"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Building2, FolderKanban, Loader2, Plus, Users } from "lucide-react"

interface Org {
  id: string
  name: string
  slug: string
  createdAt: string
  _count: { members: number; projects: number }
}

interface MyProject {
  id: string
  name: string
  description: string | null
  myRole: string
  org: { id: string; name: string }
  _count: { columns: number }
}

export default function DashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [myProjects, setMyProjects] = useState<MyProject[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      const [orgsRes, projRes] = await Promise.all([
        fetch("/api/orgs"),
        fetch("/api/my/projects"),
      ])
      if (orgsRes.ok) setOrgs(await orgsRes.json())
      if (projRes.ok) setMyProjects(await projRes.json())
    } catch {
      toast.error("Daten konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      })
      if (!res.ok) throw new Error("Fehler beim Erstellen")
      const org = await res.json()
      setOrgs((prev) => [...prev, org])
      setDialogOpen(false)
      setNewOrgName("")
      toast.success(`Organisation "${org.name}" erstellt.`)
    } catch {
      toast.error("Organisation konnte nicht erstellt werden.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Deine Organisationen und Projekte
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Organisation erstellen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateOrg}>
              <DialogHeader>
                <DialogTitle>Neue Organisation</DialogTitle>
                <DialogDescription>
                  Erstelle eine neue Organisation um Projekte und Mitglieder zu verwalten.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  placeholder="Mein Team"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {/* Organisations */}
          {orgs.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Organisationen
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {orgs.map((org) => (
                  <Link key={org.id} href={`/orgs/${org.id}`}>
                    <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-indigo-600" />
                          {org.name}
                        </CardTitle>
                        <CardDescription>/{org.slug}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <FolderKanban className="h-4 w-4" />
                            {org._count.projects} Projekte
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {org._count.members} Mitglieder
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Direct project assignments */}
          {myProjects.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Meine Projekte
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FolderKanban className="h-5 w-5 text-indigo-600" />
                          {project.name}
                        </CardTitle>
                        <CardDescription>{project.org.name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <FolderKanban className="h-4 w-4" />
                            {project._count.columns} Spalten
                          </span>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                            {project.myRole}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {orgs.length === 0 && myProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
              <Building2 className="mb-4 h-12 w-12 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Keine Organisationen</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Erstelle deine erste Organisation um loszulegen.
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Organisation erstellen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

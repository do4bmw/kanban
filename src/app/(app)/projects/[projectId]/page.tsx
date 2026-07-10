"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CardDetailDialog } from "./card-detail"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Archive,
  Calendar,
  MoreVertical,
  Plus,
  Loader2,
  ArrowLeft,
  Eye,
  User,
  Trash2,
  Palette,
  UserPlus,
  Users,
  Zap,
} from "lucide-react"

const COLUMN_COLORS = [
  { label: "Grau", value: "#6b7280" },
  { label: "Blau", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violett", value: "#a855f7" },
  { label: "Pink", value: "#ec4899" },
  { label: "Rot", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Gelb", value: "#eab308" },
  { label: "Grün", value: "#22c55e" },
  { label: "Türkis", value: "#14b8a6" },
]

interface CardLabel {
  id: string
  name: string
  color: string
}

interface CardData {
  id: string
  title: string
  description: string | null
  order: number
  dueDate: string | null
  archived: boolean
  priority: string
  columnId: string
  assigneeId: string | null
  assignee: { id: string; name: string; email: string } | null
  labels: CardLabel[]
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW:    { label: "Niedrig", color: "#22c55e" },
  MEDIUM: { label: "Mittel",  color: "#eab308" },
  HIGH:   { label: "Hoch",    color: "#f97316" },
  URGENT: { label: "Dringend",color: "#ef4444" },
}

interface ColumnData {
  id: string
  name: string
  color: string | null
  order: number
  cards: CardData[]
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  orgId: string
  columns: ColumnData[]
}

interface ProjectMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface InviteResult {
  inviteUrl: string
  emailSent: boolean
}

interface ProjectPageProps {
  params: Promise<{ projectId: string }>
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [columns, setColumns] = useState<ColumnData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [userRole, setUserRole] = useState<string>("VIEWER")
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
  const [membersOpen, setMembersOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("MEMBER")
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)

  // Add column state
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")
  const newColumnInputRef = useRef<HTMLInputElement>(null)

  // Add card state: columnId -> boolean
  const [addingCardColumn, setAddingCardColumn] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState("")

  // Rename column state
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // Archive filter
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  useEffect(() => {
    if (addingColumn && newColumnInputRef.current) {
      newColumnInputRef.current.focus()
    }
  }, [addingColumn])

  async function fetchProject() {
    try {
      const [projectRes, sessionRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/auth/session"),
      ])

      if (!projectRes.ok) {
        toast.error("Projekt nicht gefunden oder kein Zugriff.")
        router.push("/dashboard")
        return
      }
      const data: ProjectData = await projectRes.json()
      setProject(data)
      setColumns(data.columns)

      // Get user's effective role (org membership or project membership)
      if (sessionRes.ok) {
        const session = await sessionRes.json()
        const myId = session?.user?.id
        if (myId && data.orgId) {
          const [orgMembRes, projMembRes] = await Promise.all([
            fetch(`/api/orgs/${data.orgId}/members`),
            fetch(`/api/projects/${projectId}/members`),
          ])
          let resolvedRole = "VIEWER"
          if (orgMembRes.ok) {
            const members = await orgMembRes.json()
            const me = members.find((m: any) => m.user.id === myId)
            if (me && ["OWNER", "ADMIN"].includes(me.role)) {
              resolvedRole = me.role
            }
          }
          if (projMembRes.ok) {
            const projMembers: ProjectMember[] = await projMembRes.json()
            setProjectMembers(projMembers)
            const me = projMembers.find((m) => m.user.id === myId)
            if (me && resolvedRole === "VIEWER") resolvedRole = me.role
          }
          setUserRole(resolvedRole)
        }
      }
    } catch {
      toast.error("Fehler beim Laden des Projekts.")
    } finally {
      setLoading(false)
    }
  }

  const canManage = userRole === "OWNER" || userRole === "ADMIN"
  const canEdit = userRole !== "VIEWER"
  const isViewer = userRole === "VIEWER"

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const sourceCol = columns.find((c) => c.id === source.droppableId)!
    const destCol = columns.find((c) => c.id === destination.droppableId)!

    if (source.droppableId === destination.droppableId) {
      const newCards = [...sourceCol.cards]
      const [moved] = newCards.splice(source.index, 1)
      newCards.splice(destination.index, 0, moved)
      const updated = newCards.map((c, i) => ({ ...c, order: i }))

      setColumns((cols) => cols.map((c) => (c.id === sourceCol.id ? { ...c, cards: updated } : c)))

      fetch(`/api/columns/${sourceCol.id}/cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: updated.map((c) => ({ id: c.id, columnId: c.columnId, order: c.order })) }),
      }).catch(() => toast.error("Reihenfolge konnte nicht gespeichert werden."))
    } else {
      const srcCards = [...sourceCol.cards]
      const dstCards = [...destCol.cards]
      const [moved] = srcCards.splice(source.index, 1)
      const movedCard = { ...moved, columnId: destination.droppableId }
      dstCards.splice(destination.index, 0, movedCard)

      const updSrc = srcCards.map((c, i) => ({ ...c, order: i }))
      const updDst = dstCards.map((c, i) => ({ ...c, order: i }))

      setColumns((cols) =>
        cols.map((c) => {
          if (c.id === sourceCol.id) return { ...c, cards: updSrc }
          if (c.id === destCol.id) return { ...c, cards: updDst }
          return c
        })
      )

      const allUpdated = [
        ...updSrc.map((c) => ({ id: c.id, columnId: c.columnId, order: c.order })),
        ...updDst.map((c) => ({ id: c.id, columnId: c.columnId, order: c.order })),
      ]

      fetch(`/api/columns/${destination.droppableId}/cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: allUpdated }),
      }).catch(() => toast.error("Karte konnte nicht verschoben werden."))
    }
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault()
    if (!newColumnName.trim()) return
    try {
      const res = await fetch(`/api/projects/${projectId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColumnName.trim() }),
      })
      if (!res.ok) throw new Error("Fehler")
      const col = await res.json()
      setColumns((prev) => [...prev, { ...col, cards: [] }])
      setNewColumnName("")
      setAddingColumn(false)
      toast.success(`Spalte "${col.name}" erstellt.`)
    } catch {
      toast.error("Spalte konnte nicht erstellt werden.")
    }
  }

  async function handleRenameColumn(columnId: string) {
    if (!renameValue.trim()) { setRenamingColumnId(null); return }
    try {
      const res = await fetch(`/api/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      if (!res.ok) throw new Error("Fehler")
      setColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, name: renameValue.trim() } : c)))
      setRenamingColumnId(null)
    } catch {
      toast.error("Spalte konnte nicht umbenannt werden.")
    }
  }

  async function handleDeleteProject() {
    if (!project) return
    if (!confirm(`Projekt "${project.name}" und alle Inhalte unwiderruflich löschen?`)) return
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Fehler")
      toast.success("Projekt gelöscht.")
      router.push(`/orgs/${project.orgId}`)
    } catch {
      toast.error("Projekt konnte nicht gelöscht werden.")
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) throw new Error("Fehler")
      const data = await res.json()
      setInviteResult({ inviteUrl: data.inviteUrl, emailSent: data.emailSent })
      toast.success("Einladung erstellt!")
    } catch {
      toast.error("Einladung konnte nicht erstellt werden.")
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveProjectMember(userId: string) {
    if (!confirm("Mitglied aus dem Projekt entfernen?")) return
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error("Fehler")
      setProjectMembers((prev) => prev.filter((m) => m.user.id !== userId))
      toast.success("Mitglied entfernt.")
    } catch {
      toast.error("Mitglied konnte nicht entfernt werden.")
    }
  }

  async function handleColorColumn(columnId: string, color: string | null) {
    try {
      await fetch(`/api/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      })
      setColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, color } : c)))
    } catch {
      toast.error("Farbe konnte nicht gespeichert werden.")
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (!confirm("Spalte und alle Karten darin löschen?")) return
    try {
      const res = await fetch(`/api/columns/${columnId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Fehler")
      setColumns((cols) => cols.filter((c) => c.id !== columnId))
      toast.success("Spalte gelöscht.")
    } catch {
      toast.error("Spalte konnte nicht gelöscht werden.")
    }
  }

  async function handleAddCard(columnId: string) {
    if (!newCardTitle.trim()) return
    try {
      const res = await fetch(`/api/columns/${columnId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newCardTitle.trim() }),
      })
      if (!res.ok) throw new Error("Fehler")
      const card = await res.json()
      setColumns((cols) =>
        cols.map((c) => (c.id === columnId ? { ...c, cards: [...c.cards, card] } : c))
      )
      setNewCardTitle("")
      setAddingCardColumn(null)
    } catch {
      toast.error("Karte konnte nicht erstellt werden.")
    }
  }

  function handleCardUpdate(updated: CardData) {
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.map((card) => (card.id === updated.id ? updated : card)),
      }))
    )
    setSelectedCard(null)
  }

  const columnsWithCount = columns.map((col) => ({
    ...col,
    visibleCount: col.cards.filter((c) => showArchived ? c.archived : !c.archived).length,
    archivedCount: col.cards.filter((c) => c.archived).length,
  }))

  function handleCardDelete(cardId: string) {
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.filter((card) => card.id !== cardId),
      }))
    )
    setSelectedCard(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Project header */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
          )}
        </div>
        {isViewer && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            Nur Ansicht
          </Badge>
        )}
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
          className="flex items-center gap-1.5"
        >
          <Archive className="h-4 w-4" />
          {showArchived ? "Archiv ausblenden" : "Archiv"}
        </Button>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMembersOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Users className="h-4 w-4" />
            Mitglieder
            {projectMembers.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                {projectMembers.length}
              </span>
            )}
          </Button>
        )}
        {(userRole === "OWNER" || userRole === "ADMIN") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteProject}
            className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full gap-4 p-6" style={{ minWidth: "max-content" }}>
            {columnsWithCount.map((column) => (
              <div
                key={column.id}
                className="flex w-72 shrink-0 flex-col rounded-xl bg-gray-100 dark:bg-gray-900"
              >
                {/* Column header */}
                <div
                  className="rounded-t-xl px-3 py-2.5"
                  style={{ backgroundColor: column.color ?? "#6b7280" }}
                >
                  <div className="flex items-center justify-between">
                    {renamingColumnId === column.id && canManage ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRenameColumn(column.id) }}
                        className="flex-1 mr-1"
                      >
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameColumn(column.id)}
                          className="h-7 border-white/40 bg-white/20 text-sm font-semibold text-white placeholder:text-white/60 focus-visible:ring-white/50"
                          autoFocus
                        />
                      </form>
                    ) : (
                      <button
                        className={`flex-1 text-left text-sm font-semibold text-white ${canManage ? "hover:text-white/80" : "cursor-default"}`}
                        onClick={() => {
                          if (canManage) { setRenamingColumnId(column.id); setRenameValue(column.name) }
                        }}
                      >
                        {column.name}
                        <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-medium">
                          {column.visibleCount}
                        </span>
                      </button>
                    )}
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-white/70 hover:bg-white/20 hover:text-white">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => { setRenamingColumnId(column.id); setRenameValue(column.name) }}
                          >
                            Umbenennen
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <div className="flex flex-col gap-2 px-2 py-1.5 cursor-default focus:bg-transparent">
                              <span className="flex items-center gap-1.5 text-sm">
                                <Palette className="h-3.5 w-3.5" />
                                Farbe wählen
                              </span>
                              <div className="grid grid-cols-5 gap-1.5">
                                {COLUMN_COLORS.map((c) => (
                                  <button
                                    key={c.value}
                                    title={c.label}
                                    onClick={(e) => { e.stopPropagation(); handleColorColumn(column.id, c.value) }}
                                    className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                    style={{
                                      backgroundColor: c.value,
                                      borderColor: column.color === c.value ? "white" : "transparent",
                                      outline: column.color === c.value ? `2px solid ${c.value}` : "none",
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 dark:text-red-400"
                            onClick={() => handleDeleteColumn(column.id)}
                          >
                            Spalte löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Cards droppable area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2 overflow-y-auto px-2 py-1 transition-colors ${
                        snapshot.isDraggingOver ? "bg-indigo-50 dark:bg-indigo-950/30" : ""
                      }`}
                      style={{ minHeight: "2rem" }}
                    >
                      {column.cards.filter((card) => showArchived ? card.archived : !card.archived).map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${
                                snapshot.isDragging ? "shadow-lg rotate-1" : ""
                              }`}
                              onClick={() => setSelectedCard(card)}
                            >
                              {/* Labels + priority row */}
                              {(card.labels.length > 0 || (card.priority && card.priority !== "NONE")) && (
                                <div className="mb-2 flex flex-wrap gap-1">
                                  {card.priority && card.priority !== "NONE" && (
                                    <span
                                      className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                                      style={{ backgroundColor: PRIORITY_META[card.priority]?.color }}
                                    >
                                      <Zap className="h-2.5 w-2.5" />
                                      {PRIORITY_META[card.priority]?.label}
                                    </span>
                                  )}
                                  {card.labels.map((label) => (
                                    <span
                                      key={label.id}
                                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                                      style={{ backgroundColor: label.color }}
                                    >
                                      {label.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {card.title}
                              </p>

                              {/* Card meta */}
                              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                {card.archived && (
                                  <span className="flex items-center gap-1 text-amber-500">
                                    <Archive className="h-3 w-3" />
                                  </span>
                                )}
                                {card.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(card.dueDate).toLocaleDateString("de-DE", {
                                      day: "2-digit",
                                      month: "2-digit",
                                    })}
                                  </span>
                                )}
                                {card.assignee && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {card.assignee.name.split(" ")[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add card — hidden for VIEWER */}
                {canEdit && (
                  <div className="px-2 pb-2">
                    {addingCardColumn === column.id ? (
                      <div className="space-y-1.5">
                        <Input
                          placeholder="Kartentitel..."
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddCard(column.id)
                            if (e.key === "Escape") { setAddingCardColumn(null); setNewCardTitle("") }
                          }}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 flex-1" onClick={() => handleAddCard(column.id)}>
                            Hinzufügen
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => { setAddingCardColumn(null); setNewCardTitle("") }}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingCardColumn(column.id); setNewCardTitle("") }}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <Plus className="h-4 w-4" />
                        Karte hinzufügen
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add column — OWNER/ADMIN only */}
            {canManage && (
              <div className="w-72 shrink-0">
                {addingColumn ? (
                  <div className="rounded-xl bg-gray-100 p-3 dark:bg-gray-900">
                    <form onSubmit={handleAddColumn} className="space-y-2">
                      <Input
                        ref={newColumnInputRef}
                        placeholder="Spaltenname..."
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setAddingColumn(false)}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-1.5">
                        <Button type="submit" size="sm" className="flex-1">
                          Erstellen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setAddingColumn(false)}
                        >
                          ✕
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
                  >
                    <Plus className="h-4 w-4" />
                    Spalte hinzufügen
                  </button>
                )}
              </div>
            )}
          </div>
        </DragDropContext>
      </div>

      {/* Project Members Dialog */}
      <Dialog open={membersOpen} onOpenChange={(o) => { setMembersOpen(o); if (!o) { setInviteResult(null); setInviteEmail(""); setInviteDialogOpen(false) } }}>
        <DialogContent className="max-w-md">
          {!inviteDialogOpen ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Projekt-Mitglieder
                </DialogTitle>
                <DialogDescription>
                  Personen mit direktem Zugang zu diesem Projekt (ohne die gesamte Organisation zu sehen).
                </DialogDescription>
              </DialogHeader>
              <div className="my-2 space-y-2">
                {projectMembers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Noch keine direkten Projektmitglieder.
                  </p>
                ) : (
                  projectMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{m.user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{m.role}</Badge>
                        {canManage && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleRemoveProjectMember(m.user.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {canManage && (
                <DialogFooter>
                  <Button onClick={() => setInviteDialogOpen(true)} className="w-full">
                    <UserPlus className="h-4 w-4" />
                    Person zum Projekt einladen
                  </Button>
                </DialogFooter>
              )}
            </>
          ) : !inviteResult ? (
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Zum Projekt einladen</DialogTitle>
                <DialogDescription>
                  Die eingeladene Person kann nur dieses Projekt sehen, nicht die gesamte Organisation.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proj-invite-email">E-Mail</Label>
                  <Input
                    id="proj-invite-email"
                    type="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-invite-role">Rolle</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="proj-invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Mitglied</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="VIEWER">Betrachter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>Zurück</Button>
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
                <DialogDescription>
                  {inviteResult.emailSent
                    ? `E-Mail wurde gesendet an ${inviteEmail}`
                    : "Kein SMTP konfiguriert — Link manuell teilen:"}
                </DialogDescription>
              </DialogHeader>
              <div className="my-4 space-y-3">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <code className="block break-all text-xs text-gray-700 dark:text-gray-300">{inviteResult.inviteUrl}</code>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(inviteResult!.inviteUrl); toast.success("Link kopiert!") }}>
                  Link kopieren
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteDialogOpen(false); setInviteResult(null); setInviteEmail(""); setMembersOpen(false) }}>Schließen</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Card Detail Dialog */}
      {selectedCard && (
        <CardDetailDialog
          card={selectedCard}
          orgId={project.orgId}
          projectId={projectId}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleCardUpdate}
          onDelete={handleCardDelete}
        />
      )}
    </div>
  )
}

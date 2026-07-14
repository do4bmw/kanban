"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Archive,
  ArchiveRestore,
  Calendar,
  ChevronDown,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  Tag,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react"

interface CardLabel {
  id: string
  name: string
  color: string
}

interface LabelTemplate {
  id: string
  name: string
  color: string
  order: number
}

interface CardNote {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string; email: string }
}

interface CardActivity {
  id: string
  type: string
  data: Record<string, unknown> | null
  createdAt: string
  user: { id: string; name: string } | null
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

interface Member {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface CardDetailProps {
  card: CardData
  orgId: string
  projectId: string
  onClose: () => void
  onUpdate: (updated: CardData) => void
  onDelete: (cardId: string) => void
}

const PRIORITIES = [
  { value: "NONE", label: "Keine", color: "#9ca3af" },
  { value: "LOW", label: "Niedrig", color: "#22c55e" },
  { value: "MEDIUM", label: "Mittel", color: "#eab308" },
  { value: "HIGH", label: "Hoch", color: "#f97316" },
  { value: "URGENT", label: "Dringend", color: "#ef4444" },
]

function getPriority(value: string) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0]
}

function activityLabel(activity: CardActivity): string {
  const who = activity.user?.name ?? "Jemand"
  const d = activity.data as any
  switch (activity.type) {
    case "CREATED": return `${who} hat die Karte erstellt`
    case "EDITED":
      if (d?.field === "title") return `${who} hat den Titel geändert`
      if (d?.field === "description") return `${who} hat die Beschreibung geändert`
      return `${who} hat die Karte bearbeitet`
    case "MOVED": return `${who} hat die Karte verschoben`
    case "ASSIGNED": return `${who} hat die Karte zugewiesen`
    case "UNASSIGNED": return `${who} hat die Zuweisung entfernt`
    case "DUE_DATE_SET": return `${who} hat ein Fälligkeitsdatum gesetzt`
    case "DUE_DATE_CLEARED": return `${who} hat das Fälligkeitsdatum entfernt`
    case "ARCHIVED": return `${who} hat die Karte archiviert`
    case "UNARCHIVED": return `${who} hat die Karte aus dem Archiv geholt`
    case "LABEL_ADDED": return `${who} hat ein Label hinzugefügt`
    case "LABEL_REMOVED": return `${who} hat ein Label entfernt`
    case "NOTE_ADDED": return `${who} hat eine Notiz hinzugefügt`
    case "PRIORITY_CHANGED":
      return `${who} hat die Priorität auf „${getPriority(d?.to).label}" gesetzt`
    default: return `${who} hat eine Aktion ausgeführt`
  }
}

export function CardDetailDialog({ card, orgId, projectId, onClose, onUpdate, onDelete }: CardDetailProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || "")
  const [dueDate, setDueDate] = useState(
    card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""
  )
  const [assigneeId, setAssigneeId] = useState(card.assigneeId || "")
  const [priority, setPriority] = useState(card.priority || "NONE")
  const [labels, setLabels] = useState<CardLabel[]>(card.labels)
  const [members, setMembers] = useState<Member[]>([])
  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false)
  const labelDropdownRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<"notes" | "activity">("notes")

  // Notes state
  const [notes, setNotes] = useState<CardNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [notifyOnNote, setNotifyOnNote] = useState(true)
  const [addingNote, setAddingNote] = useState(false)

  // Activity state
  const [activities, setActivities] = useState<CardActivity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  useEffect(() => {
    fetch("/api/label-templates")
      .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setTemplates(d) } })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setNotesLoading(true)
    fetch(`/api/cards/${card.id}/notes`)
      .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setNotes(d) } })
      .catch(() => {})
      .finally(() => setNotesLoading(false))
  }, [card.id])

  useEffect(() => {
    if (activeTab !== "activity") return
    setActivitiesLoading(true)
    fetch(`/api/cards/${card.id}/activity`)
      .then(async (r) => { if (r.ok) { const d = await r.json(); if (Array.isArray(d)) setActivities(d) } })
      .catch(() => {})
      .finally(() => setActivitiesLoading(false))
  }, [card.id, activeTab])

  useEffect(() => {
    // Assignees can be org members OR project-only members — merge both, deduped by user id.
    Promise.all([
      fetch(`/api/orgs/${orgId}/members`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/projects/${projectId}/members`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([orgMembers, projectMembers]) => {
        const combined = [
          ...(Array.isArray(orgMembers) ? orgMembers : []),
          ...(Array.isArray(projectMembers) ? projectMembers : []),
        ]
        const seen = new Set<string>()
        const deduped = combined.filter((m: Member) => {
          if (!m?.user?.id || seen.has(m.user.id)) return false
          seen.add(m.user.id)
          return true
        })
        setMembers(deduped)
      })
      .catch(() => {})
  }, [orgId, projectId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(e.target as Node)) {
        setLabelDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function handleSave() {
    if (!title.trim()) { toast.error("Titel darf nicht leer sein."); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          dueDate: dueDate || null,
          assigneeId: assigneeId || null,
          priority,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onUpdate({ ...updated, labels, archived: card.archived })
      toast.success("Karte gespeichert.")
      onClose()
    } catch {
      toast.error("Karte konnte nicht gespeichert werden.")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveToggle() {
    setArchiving(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !card.archived }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onUpdate({ ...updated, labels })
      toast.success(card.archived ? "Karte wiederhergestellt." : "Karte archiviert.")
      onClose()
    } catch {
      toast.error("Fehler beim Archivieren.")
    } finally {
      setArchiving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      onDelete(card.id)
      toast.success("Karte gelöscht.")
      onClose()
    } catch {
      toast.error("Karte konnte nicht gelöscht werden.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleLabel(tpl: LabelTemplate) {
    const existing = labels.find((l) => l.name === tpl.name && l.color === tpl.color)
    if (existing) {
      try {
        const res = await fetch(`/api/cards/${card.id}/labels`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelId: existing.id }),
        })
        if (!res.ok) throw new Error()
        setLabels((prev) => prev.filter((l) => l.id !== existing.id))
      } catch {
        toast.error("Label konnte nicht entfernt werden.")
      }
    } else {
      try {
        const res = await fetch(`/api/cards/${card.id}/labels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tpl.name, color: tpl.color }),
        })
        if (!res.ok) throw new Error()
        const label = await res.json()
        setLabels((prev) => [...prev, label])
      } catch {
        toast.error("Label konnte nicht hinzugefügt werden.")
      }
    }
  }

  async function handleRemoveLabel(labelId: string) {
    try {
      const res = await fetch(`/api/cards/${card.id}/labels`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      })
      if (!res.ok) throw new Error()
      setLabels((prev) => prev.filter((l) => l.id !== labelId))
    } catch {
      toast.error("Label konnte nicht entfernt werden.")
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNoteContent.trim()) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/cards/${card.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent.trim(), notify: notifyOnNote }),
      })
      if (!res.ok) throw new Error()
      const note = await res.json()
      setNotes((prev) => [...prev, note])
      setNewNoteContent("")
    } catch {
      toast.error("Notiz konnte nicht hinzugefügt werden.")
    } finally {
      setAddingNote(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      const res = await fetch(`/api/cards/${card.id}/notes/${noteId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch {
      toast.error("Notiz konnte nicht gelöscht werden.")
    }
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  const currentPriority = getPriority(priority)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Karte bearbeiten
            {card.archived && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Archiviert
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="card-title">Titel</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kartentitel"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="card-desc">Beschreibung</Label>
            <Textarea
              id="card-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="card-due" className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Fälligkeitsdatum
              </Label>
              <Input
                id="card-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Zugewiesen an
              </Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Niemand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Niemand</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              Priorität
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    priority === p.value
                      ? "border-transparent text-white shadow-sm"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                  }`}
                  style={priority === p.value ? { backgroundColor: p.color, borderColor: p.color } : {}}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: priority === p.value ? "rgba(255,255,255,0.6)" : p.color }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              Labels
            </Label>

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => (
                  <span
                    key={label.id}
                    className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                    <button
                      onClick={() => handleRemoveLabel(label.id)}
                      className="ml-0.5 rounded-full hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {templates.length > 0 && (
              <div className="relative" ref={labelDropdownRef}>
                <button
                  type="button"
                  onClick={() => setLabelDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Label hinzufügen
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
                {labelDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <div className="p-1">
                      {templates.map((tpl) => {
                        const active = labels.some((l) => l.name === tpl.name && l.color === tpl.color)
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleToggleLabel(tpl)}
                            className={`flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${active ? "font-medium" : ""}`}
                          >
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tpl.color }} />
                            <span className="flex-1 text-left text-gray-800 dark:text-gray-200">{tpl.name}</span>
                            {active && <span className="text-xs text-indigo-600 dark:text-indigo-400">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes & Activity tabs */}
          <div className="space-y-2">
            <div className="flex gap-0 rounded-md border border-gray-200 p-0.5 dark:border-gray-800 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === "notes"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                Notizen{notes.length > 0 && ` (${notes.length})`}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("activity")}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === "activity"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Clock className="h-3 w-3" />
                Aktivität
              </button>
            </div>

            {activeTab === "notes" && (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border border-gray-200 p-2 dark:border-gray-800">
                  {notesLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-3">Noch keine Notizen vorhanden.</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="group relative rounded-md bg-gray-50 p-3 dark:bg-gray-900">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {note.author.name}
                              </span>
                              <span className="text-xs text-gray-400">{formatDateTime(note.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                              {note.content}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-gray-400 hover:text-red-500"
                            title="Notiz löschen"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddNote} className="mt-1 space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Notiz hinzufügen..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" size="sm" variant="outline" disabled={addingNote || !newNoteContent.trim()}>
                      {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={notifyOnNote}
                      onChange={(e) => setNotifyOnNote(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    Beteiligte per E-Mail benachrichtigen (Zugewiesene, Ersteller, bisherige Kommentatoren)
                  </label>
                </form>
              </>
            )}

            {activeTab === "activity" && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 p-2 dark:border-gray-800">
                {activitiesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-3">Noch keine Aktivitäten aufgezeichnet.</p>
                ) : (
                  <div className="space-y-1">
                    {[...activities].reverse().map((a) => (
                      <div key={a.id} className="flex items-start gap-2 rounded px-2 py-1.5 text-sm">
                        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-700 dark:text-gray-300">{activityLabel(a)}</span>
                          <span className="ml-2 text-xs text-gray-400">{formatDateTime(a.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400"
                  onClick={handleArchiveToggle}
                  disabled={archiving}
                >
                  {archiving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : card.archived ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {card.archived ? "Wiederherstellen" : "Archivieren"}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 dark:text-red-400">Wirklich löschen?</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ja, löschen"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

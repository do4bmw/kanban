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
import { Calendar, ChevronDown, Loader2, MessageSquare, Send, Tag, Trash2, User, X } from "lucide-react"

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

interface CardData {
  id: string
  title: string
  description: string | null
  order: number
  dueDate: string | null
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

export function CardDetailDialog({ card, orgId, projectId, onClose, onUpdate, onDelete }: CardDetailProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || "")
  const [dueDate, setDueDate] = useState(
    card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""
  )
  const [assigneeId, setAssigneeId] = useState(card.assigneeId || "")
  const [labels, setLabels] = useState<CardLabel[]>(card.labels)
  const [members, setMembers] = useState<Member[]>([])
  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false)
  const labelDropdownRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<CardNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [addingNote, setAddingNote] = useState(false)

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
    fetch(`/api/orgs/${orgId}/members`)
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json()
          if (Array.isArray(data)) setMembers(data)
        } else {
          const r2 = await fetch(`/api/projects/${projectId}/members`)
          if (r2.ok) { const data = await r2.json(); if (Array.isArray(data)) setMembers(data) }
        }
      })
      .catch(() => {})
  }, [orgId, projectId])

  // Close label dropdown on outside click
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
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onUpdate({ ...updated, labels })
      toast.success("Karte gespeichert.")
      onClose()
    } catch {
      toast.error("Karte konnte nicht gespeichert werden.")
    } finally {
      setSaving(false)
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
      // remove
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
      // add
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
        body: JSON.stringify({ content: newNoteContent.trim() }),
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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Karte bearbeiten</DialogTitle>
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

          {/* Labels */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              Labels
            </Label>

            {/* Applied labels */}
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

            {/* Template dropdown */}
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
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: tpl.color }}
                            />
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

          {/* Notes / Activity */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              Notizen &amp; Aktivität
            </Label>
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
            <form onSubmit={handleAddNote} className="flex gap-2 mt-1">
              <Input
                placeholder="Notiz hinzufügen..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" variant="outline" disabled={addingNote || !newNoteContent.trim()}>
                {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
          {!confirmDelete ? (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </Button>
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

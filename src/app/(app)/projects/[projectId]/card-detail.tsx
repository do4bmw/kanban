"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar, Loader2, Tag, Trash2, User, X } from "lucide-react"

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
  onClose: () => void
  onUpdate: (updated: CardData) => void
  onDelete: (cardId: string) => void
}

const LABEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#6b7280",
]

export function CardDetailDialog({ card, orgId, onClose, onUpdate, onDelete }: CardDetailProps) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || "")
  const [dueDate, setDueDate] = useState(
    card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""
  )
  const [assigneeId, setAssigneeId] = useState(card.assigneeId || "")
  const [labels, setLabels] = useState<CardLabel[]>(card.labels)
  const [members, setMembers] = useState<Member[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // New label state
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[5])
  const [addingLabel, setAddingLabel] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/members`)
      .then((r) => r.json())
      .then((data) => setMembers(data))
      .catch(() => {})
  }, [orgId])

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
      if (!res.ok) throw new Error("Fehler")
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
      if (!res.ok) throw new Error("Fehler")
      onDelete(card.id)
      toast.success("Karte gelöscht.")
      onClose()
    } catch {
      toast.error("Karte konnte nicht gelöscht werden.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddLabel(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabelName.trim()) return
    setAddingLabel(true)
    try {
      const res = await fetch(`/api/cards/${card.id}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
      })
      if (!res.ok) throw new Error("Fehler")
      const label = await res.json()
      setLabels((prev) => [...prev, label])
      setNewLabelName("")
    } catch {
      toast.error("Label konnte nicht hinzugefügt werden.")
    } finally {
      setAddingLabel(false)
    }
  }

  async function handleRemoveLabel(labelId: string) {
    try {
      const res = await fetch(`/api/cards/${card.id}/labels`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      })
      if (!res.ok) throw new Error("Fehler")
      setLabels((prev) => prev.filter((l) => l.id !== labelId))
    } catch {
      toast.error("Label konnte nicht entfernt werden.")
    }
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
            <form onSubmit={handleAddLabel} className="flex gap-2 mt-1">
              <Input
                placeholder="Label hinzufügen..."
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                className="flex-1"
              />
              <div className="flex gap-1">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewLabelColor(color)}
                    className={`h-6 w-6 rounded-full transition-transform ${newLabelColor === color ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={addingLabel || !newLabelName.trim()}>
                {addingLabel ? <Loader2 className="h-3 w-3 animate-spin" /> : "+"}
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

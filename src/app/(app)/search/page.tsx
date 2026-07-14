"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, Loader2, Search, User, Zap } from "lucide-react"

interface SearchResult {
  id: string
  title: string
  description: string | null
  priority: string
  dueDate: string | null
  archived: boolean
  labels: { id: string; name: string; color: string }[]
  assignee: { id: string; name: string } | null
  column: {
    id: string
    name: string
    project: {
      id: string
      name: string
      org: { id: string; name: string }
    }
  }
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW:    { label: "Niedrig", color: "#22c55e" },
  MEDIUM: { label: "Mittel",  color: "#eab308" },
  HIGH:   { label: "Hoch",    color: "#f97316" },
  URGENT: { label: "Dringend",color: "#ef4444" },
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(t)
  }, [query, doSearch])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Suche</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Karte suchen..."
          className="pl-9 text-base"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12">
          Keine Karten für „{query}&ldquo; gefunden.
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {results.length} Ergebnis{results.length !== 1 ? "se" : ""}
          </p>
          {results.map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(`/projects/${card.column.project.id}`)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Labels + priority */}
                  {(card.labels.length > 0 || (card.priority && card.priority !== "NONE")) && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {card.priority && card.priority !== "NONE" && (
                        <span
                          className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: PRIORITY_META[card.priority]?.color }}
                        >
                          <Zap className="h-2.5 w-2.5" />
                          {PRIORITY_META[card.priority]?.label}
                        </span>
                      )}
                      {card.labels.map((l) => (
                        <span
                          key={l.id}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: l.color }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="font-medium text-gray-900 dark:text-gray-100">{card.title}</p>
                  {card.description && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                      {card.description}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {card.column.project.org.name} / {card.column.project.name}
                    </span>
                    <span>→ {card.column.name}</span>
                    {card.assignee && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {card.assignee.name}
                      </span>
                    )}
                    {card.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(card.dueDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                {card.archived && (
                  <Badge variant="secondary" className="shrink-0 text-amber-600 dark:text-amber-400">
                    Archiviert
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

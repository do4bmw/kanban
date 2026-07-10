"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, CheckCircle, FolderKanban, Loader2, LogIn, UserPlus, XCircle } from "lucide-react"

interface InviteInfo {
  orgId: string
  orgName: string
  projectId: string | null
  projectName: string | null
  email: string
  role: string
}

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState("")
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          setInviteError(data.error || "Einladung nicht gefunden.")
        } else {
          setInvite(await res.json())
        }
      })
      .catch(() => setInviteError("Fehler beim Laden der Einladung."))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept() {
    if (!session) return
    setAccepting(true)
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Einladung konnte nicht angenommen werden.")
        return
      }
      const data = await res.json()
      setAccepted(true)
      if (data.projectId) {
        toast.success(`Du hast dem Projekt "${data.projectName}" beigetreten.`)
        setTimeout(() => router.push(`/projects/${data.projectId}`), 1500)
      } else {
        toast.success(`Du bist jetzt Mitglied von "${data.orgName}".`)
        setTimeout(() => router.push(`/orgs/${data.orgId}`), 1500)
      }
    } catch {
      toast.error("Fehler beim Annehmen der Einladung.")
    } finally {
      setAccepting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    OWNER: "Eigentümer",
    ADMIN: "Admin",
    MEMBER: "Mitglied",
    VIEWER: "Betrachter",
  }

  const appName = typeof window !== "undefined"
    ? (document.title.split("—")[0].trim() || "Kanban")
    : "Kanban"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            {appName}
          </Link>
        </div>

        <Card>
          {loading ? (
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </CardContent>
          ) : inviteError ? (
            <>
              <CardHeader>
                <div className="flex justify-center">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
                <CardTitle className="text-center text-red-700 dark:text-red-400">
                  Ungültige Einladung
                </CardTitle>
                <CardDescription className="text-center">{inviteError}</CardDescription>
              </CardHeader>
              <CardFooter className="justify-center">
                <Button asChild variant="outline">
                  <Link href="/dashboard">Zum Dashboard</Link>
                </Button>
              </CardFooter>
            </>
          ) : accepted ? (
            <CardHeader>
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-center text-green-700 dark:text-green-400">
                Einladung angenommen!
              </CardTitle>
              <CardDescription className="text-center">Du wirst weitergeleitet...</CardDescription>
            </CardHeader>
          ) : invite ? (
            <>
              <CardHeader>
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
                    {invite.projectId
                      ? <FolderKanban className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                      : <Building2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                    }
                  </div>
                </div>
                <CardTitle className="text-center">
                  {invite.projectId ? "Projekteinladung" : "Organisationseinladung"}
                </CardTitle>
                <CardDescription className="text-center">
                  Du wurdest eingeladen beizutreten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  {invite.projectId ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Projekt</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{invite.projectName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Organisation</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{invite.orgName}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Rolle</span>
                    <Badge>{roleLabels[invite.role] || invite.role}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">E-Mail</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{invite.email}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                {status === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : session ? (
                  <>
                    <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                      {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Einladung annehmen
                    </Button>
                    <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                      Angemeldet als {session.user?.email}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                      Bitte melde dich an um die Einladung anzunehmen.
                    </p>
                    <div className="flex w-full gap-2">
                      <Button asChild variant="outline" className="flex-1">
                        <Link href={`/login?callbackUrl=/invite/${token}`}>
                          <LogIn className="h-4 w-4" />
                          Anmelden
                        </Link>
                      </Button>
                      <Button asChild className="flex-1">
                        <Link href={`/register?callbackUrl=/invite/${token}`}>
                          <UserPlus className="h-4 w-4" />
                          Registrieren
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardFooter>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

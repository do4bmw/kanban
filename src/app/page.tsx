import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Columns3 } from "lucide-react"

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || ""

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-6 flex justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={appName} className="h-16 w-auto object-contain" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
              <Columns3 className="h-8 w-8 text-white" />
            </div>
          )}
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl">
          {appName}
        </h1>

        <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
          Dein selbst-gehostetes Projekt-Management
        </p>

        <p className="mt-3 text-base text-gray-500 dark:text-gray-500">
          Organisiere Aufgaben, verwalte Teams und behalte den Überblick — vollständig in deiner eigenen Infrastruktur.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/login">Anmelden</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/register">Registrieren</Link>
          </Button>
        </div>

        <p className="mt-12 text-sm text-gray-400 dark:text-gray-600">
          Self-hosted · Open Source · Keine Nutzerdaten in der Cloud
        </p>
      </div>
    </div>
  )
}

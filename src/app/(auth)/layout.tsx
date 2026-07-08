import Link from "next/link"
import { Columns3 } from "lucide-react"

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || ""

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="mb-8 flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={appName} className="h-12 w-auto object-contain" />
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
                <Columns3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-indigo-600">{appName}</span>
            </>
          )}
        </Link>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

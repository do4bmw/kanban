import { redirect } from "next/navigation"
import { getServerSession, authOptions } from "@/lib/auth"
import { Navbar } from "@/components/layout/navbar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main>{children}</main>
    </div>
  )
}

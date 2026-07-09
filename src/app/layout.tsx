import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/layout/providers"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Kanban — Selbst-gehostetes Projektmanagement",
  description: "Dein selbst-gehostetes Kanban-Board für agiles Projektmanagement",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

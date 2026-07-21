import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { pruneAuditLog } from "@/lib/audit"

function isAdmin(session: unknown): boolean {
  return !!session && (session as { user?: { role?: string } }).user?.role === "ADMIN"
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Opportunistic retention cleanup (best-effort, fire-and-forget).
  void pruneAuditLog()

  const url = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 200)
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1)
  const action = url.searchParams.get("action") || undefined
  const q = url.searchParams.get("q")?.trim() || undefined

  const where: {
    action?: string
    OR?: Array<Record<string, unknown>>
  } = {}
  if (action) where.action = action
  if (q) {
    where.OR = [
      { userName: { contains: q, mode: "insensitive" } },
      { userEmail: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ]
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ entries, total, page, limit })
}

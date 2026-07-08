import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function requireAdmin(session: any) {
  if (!session) return false
  return (session.user as any).role === "ADMIN"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const orgs = await prisma.organization.findMany({
    include: {
      _count: { select: { members: true, projects: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(orgs)
}

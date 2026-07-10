import { NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          org: { select: { id: true, name: true } },
          _count: { select: { columns: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(memberships.map((m) => ({ ...m.project, myRole: m.role })))
}

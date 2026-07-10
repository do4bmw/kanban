import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getProjectAccess } from "@/lib/project-access"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: { select: { projectId: true } } },
  })
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const access = await getProjectAccess(userId, card.column.projectId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const activities = await prisma.cardActivity.findMany({
    where: { cardId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(activities)
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { canEditCards } from "@/lib/permissions"
import { getAccessForColumn } from "@/lib/project-access"
import { logActivity } from "@/lib/activity"
import { notifyCardAssigned } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import { OrgRole } from "@prisma/client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { columnId } = await params
  const userId = (session.user as any).id as string

  const access = await getAccessForColumn(userId, columnId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!canEditCards(access.role as OrgRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: { project: { select: { id: true, name: true } } },
  })
  if (!column) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const body = await req.json()
    const { title, description, dueDate, assigneeId } = body
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const maxOrder = await prisma.card.aggregate({ where: { columnId }, _max: { order: true } })
    const order = (maxOrder._max.order ?? -1) + 1

    const card = await prisma.card.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || null,
        createdById: userId,
        order,
        columnId,
      },
      include: {
        labels: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    })

    await logActivity(card.id, "CREATED", userId)
    await logAudit({
      action: "card.create",
      entityType: "card",
      entityId: card.id,
      summary: `Karte „${card.title}" erstellt`,
      actorId: userId,
      metadata: { projectName: column.project.name },
    })
    if (card.assigneeId) {
      await logActivity(card.id, "ASSIGNED", userId, { assigneeId: card.assigneeId })
      // Fire-and-forget so the response is instant (see cards/[cardId] route).
      void notifyCardAssigned({
        cardId: card.id,
        cardTitle: card.title,
        assigneeId: card.assigneeId,
        assignerId: userId,
        projectId: column.project.id,
        projectName: column.project.name,
      })
    }
    return NextResponse.json(card, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { columnId } = await params
  const userId = (session.user as any).id as string

  const access = await getAccessForColumn(userId, columnId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (access.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { cards } = body as { cards: { id: string; columnId: string; order: number }[] }
    if (!Array.isArray(cards)) return NextResponse.json({ error: "cards array required" }, { status: 400 })

    // Only accept target columns that belong to this project, so cards can't be
    // moved into another project's column by passing a foreign columnId.
    const projectColumns = await prisma.column.findMany({
      where: { projectId: access.projectId },
      select: { id: true },
    })
    const allowedColumnIds = new Set(projectColumns.map((c) => c.id))
    if (cards.some((c) => !allowedColumnIds.has(c.columnId))) {
      return NextResponse.json({ error: "Invalid target column" }, { status: 400 })
    }

    // updateMany scoped to this project ignores any card id that isn't in it,
    // preventing reordering of cards the caller can't access.
    await prisma.$transaction(
      cards.map((c) =>
        prisma.card.updateMany({
          where: { id: c.id, column: { projectId: access.projectId } },
          data: { columnId: c.columnId, order: c.order },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

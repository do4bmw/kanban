import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { canEditCards, canDeleteCards } from "@/lib/permissions"
import { getProjectAccess } from "@/lib/project-access"
import { logActivity } from "@/lib/activity"
import { notifyCardAssigned } from "@/lib/notify"
import { OrgRole, Priority } from "@prisma/client"

async function getCardWithAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      column: { select: { id: true, projectId: true, project: { select: { name: true } } } },
      labels: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  })
  if (!card) return { card: null, access: null }
  const access = await getProjectAccess(userId, card.column.projectId)
  return { card, access }
}

function canDeleteCard(card: { createdById: string | null }, userId: string, role: OrgRole): boolean {
  return canDeleteCards(role) || card.createdById === userId
}

const VALID_PRIORITIES = Object.values(Priority)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, access } = await getCardWithAccess(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(card)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, access } = await getCardWithAccess(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!canEditCards(access.role as OrgRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { title, description, dueDate, assigneeId, columnId, order, archived, priority } = body

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 })
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(columnId !== undefined && { columnId }),
        ...(order !== undefined && { order }),
        ...(archived !== undefined && { archived }),
        ...(priority !== undefined && { priority }),
      },
      include: {
        labels: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    })

    // Log activities
    if (title !== undefined && title !== card.title) {
      await logActivity(cardId, "EDITED", userId, { field: "title", from: card.title, to: title })
    }
    if (description !== undefined && description !== card.description) {
      await logActivity(cardId, "EDITED", userId, { field: "description" })
    }
    if (dueDate !== undefined) {
      const newDate = dueDate ? new Date(dueDate).toISOString() : null
      const oldDate = card.dueDate ? card.dueDate.toISOString() : null
      if (newDate !== oldDate) {
        await logActivity(cardId, dueDate ? "DUE_DATE_SET" : "DUE_DATE_CLEARED", userId, {
          date: dueDate || null,
        })
      }
    }
    if (assigneeId !== undefined) {
      const newAssignee = assigneeId || null
      if (newAssignee !== card.assigneeId) {
        await logActivity(cardId, newAssignee ? "ASSIGNED" : "UNASSIGNED", userId, {
          assigneeId: newAssignee,
        })
        // Email the newly-assigned user (best-effort, non-blocking on failure).
        if (newAssignee) {
          await notifyCardAssigned({
            cardId,
            cardTitle: updated.title,
            assigneeId: newAssignee,
            assignerId: userId,
            projectId: card.column.projectId,
            projectName: card.column.project.name,
          })
        }
      }
    }
    if (columnId !== undefined && columnId !== card.column.id) {
      await logActivity(cardId, "MOVED", userId, { columnId })
    }
    if (archived !== undefined && archived !== card.archived) {
      await logActivity(cardId, archived ? "ARCHIVED" : "UNARCHIVED", userId)
    }
    if (priority !== undefined && priority !== card.priority) {
      await logActivity(cardId, "PRIORITY_CHANGED", userId, { from: card.priority, to: priority })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, access } = await getCardWithAccess(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!canDeleteCard(card, userId, access.role as OrgRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  await prisma.card.delete({ where: { id: cardId } })
  return NextResponse.json({ success: true })
}

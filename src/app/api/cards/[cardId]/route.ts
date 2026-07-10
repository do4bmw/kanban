import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { canEditCards, canDeleteCards } from "@/lib/permissions"
import { getProjectAccess } from "@/lib/project-access"
import { OrgRole } from "@prisma/client"

async function getCardWithAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      column: { select: { projectId: true } },
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
    const { title, description, dueDate, assigneeId, columnId, order } = body

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(columnId !== undefined && { columnId }),
        ...(order !== undefined && { order }),
      },
      include: {
        labels: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    })
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

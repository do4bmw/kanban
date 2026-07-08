import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function getMembershipForCard(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      column: { include: { project: true } },
      labels: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  })
  if (!card) return { card: null, membership: null }
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: card.column.project.orgId } },
  })
  return { card, membership }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, membership } = await getMembershipForCard(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(card)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, membership } = await getMembershipForCard(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

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

  const { card, membership } = await getMembershipForCard(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  await prisma.card.delete({ where: { id: cardId } })
  return NextResponse.json({ success: true })
}

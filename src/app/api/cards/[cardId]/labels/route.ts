import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getProjectAccess } from "@/lib/project-access"

async function getCardWithAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: { select: { projectId: true } } },
  })
  if (!card) return { card: null, access: null }
  const access = await getProjectAccess(userId, card.column.projectId)
  return { card, access }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, access } = await getCardWithAccess(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (access.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { name, color } = body
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const label = await prisma.cardLabel.create({
      data: { name, color: color || "#6366f1", cardId },
    })
    return NextResponse.json(label, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, access } = await getCardWithAccess(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (access.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { labelId } = body
    if (!labelId) return NextResponse.json({ error: "labelId is required" }, { status: 400 })

    // Scope the delete to this card so a label from another card/project can't
    // be removed by passing its id.
    const result = await prisma.cardLabel.deleteMany({ where: { id: labelId, cardId } })
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

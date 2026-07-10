import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getProjectAccess } from "@/lib/project-access"
import { logActivity } from "@/lib/activity"

async function getCardWithAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: { select: { projectId: true } } },
  })
  if (!card) return { card: null, access: null }
  const access = await getProjectAccess(userId, card.column.projectId)
  return { card, access }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId } = await params
  const userId = (session.user as any).id as string

  const { card, access } = await getCardWithAccess(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const notes = await prisma.cardNote.findMany({
    where: { cardId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(notes)
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
    const { content } = body
    if (!content?.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 })

    const note = await prisma.cardNote.create({
      data: { content: content.trim(), cardId, authorId: userId },
      include: { author: { select: { id: true, name: true, email: true } } },
    })
    await logActivity(cardId, "NOTE_ADDED", userId)
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function getMembershipForCard(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: { include: { project: true } } },
  })
  if (!card) return { card: null, membership: null }
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: card.column.project.orgId } },
  })
  return { card, membership }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
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

  const { card, membership } = await getMembershipForCard(cardId, userId)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { labelId } = body
    if (!labelId) return NextResponse.json({ error: "labelId is required" }, { status: 400 })

    await prisma.cardLabel.delete({ where: { id: labelId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

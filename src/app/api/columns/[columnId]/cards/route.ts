import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { canEditCards } from "@/lib/permissions"
import { getAccessForColumn } from "@/lib/project-access"
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

  const column = await prisma.column.findUnique({ where: { id: columnId } })
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

    await prisma.$transaction(
      cards.map((c) =>
        prisma.card.update({ where: { id: c.id }, data: { columnId: c.columnId, order: c.order } })
      )
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

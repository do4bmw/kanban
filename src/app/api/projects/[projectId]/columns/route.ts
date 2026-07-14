import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { canManageColumns } from "@/lib/permissions"
import { getProjectAccess } from "@/lib/project-access"
import { OrgRole } from "@prisma/client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const access = await getProjectAccess(userId, projectId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!canManageColumns(access.role as OrgRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name } = body
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const maxOrder = await prisma.column.aggregate({
      where: { projectId },
      _max: { order: true },
    })
    const order = (maxOrder._max.order ?? -1) + 1

    const column = await prisma.column.create({ data: { name, order, projectId } })
    return NextResponse.json(column, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const access = await getProjectAccess(userId, projectId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (access.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { columns } = body as { columns: { id: string; order: number }[] }
    if (!Array.isArray(columns)) return NextResponse.json({ error: "columns array required" }, { status: 400 })

    // Scope each update to this project so columns of another project can't be
    // reordered by passing their ids.
    await prisma.$transaction(
      columns.map((c) =>
        prisma.column.updateMany({ where: { id: c.id, projectId }, data: { order: c.order } })
      )
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

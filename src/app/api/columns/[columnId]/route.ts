import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { canManageColumns } from "@/lib/permissions"
import { getAccessForColumn } from "@/lib/project-access"
import { OrgRole } from "@prisma/client"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { columnId } = await params
  const userId = (session.user as any).id as string

  const access = await getAccessForColumn(userId, columnId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!canManageColumns(access.role as OrgRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, color } = body
    if (!name && color === undefined) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const data: { name?: string; color?: string | null } = {}
    if (name) data.name = name
    if (color !== undefined) data.color = color || null

    const updated = await prisma.column.update({ where: { id: columnId }, data })
    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { columnId } = await params
  const userId = (session.user as any).id as string

  const access = await getAccessForColumn(userId, columnId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!canManageColumns(access.role as OrgRole)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  await prisma.column.delete({ where: { id: columnId } })
  return NextResponse.json({ success: true })
}

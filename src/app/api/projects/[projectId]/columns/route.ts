import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function getMembershipForProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return { project: null, membership: null }
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  })
  return { project, membership }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const { project, membership } = await getMembershipForProject(projectId, userId)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

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

  const { project, membership } = await getMembershipForProject(projectId, userId)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { columns } = body as { columns: { id: string; order: number }[] }
    if (!Array.isArray(columns)) return NextResponse.json({ error: "columns array required" }, { status: 400 })

    await prisma.$transaction(columns.map((c) => prisma.column.update({ where: { id: c.id }, data: { order: c.order } })))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

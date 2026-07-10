import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getProjectAccess } from "@/lib/project-access"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const access = await getProjectAccess(userId, projectId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
            include: {
              labels: true,
              assignee: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(project)
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
    const { name, description } = body
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { ...(name && { name }), ...(description !== undefined && { description }) },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const access = await getProjectAccess(userId, projectId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!["OWNER", "ADMIN"].includes(access.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  await prisma.project.delete({ where: { id: projectId } })
  return NextResponse.json({ success: true })
}

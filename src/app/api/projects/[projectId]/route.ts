import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function getProjectAndMembership(projectId: string, userId: string) {
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
  if (!project) return { project: null, membership: null }

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  })

  return { project, membership }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const { project, membership } = await getProjectAndMembership(projectId, userId)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const userId = (session.user as any).id as string

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

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

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: project.orgId } },
  })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  await prisma.project.delete({ where: { id: projectId } })
  return NextResponse.json({ success: true })
}

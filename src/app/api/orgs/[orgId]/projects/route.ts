import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function getMembership(userId: string, orgId: string) {
  return prisma.orgMember.findUnique({ where: { userId_orgId: { userId, orgId } } })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const userId = (session.user as any).id as string

  const membership = await getMembership(userId, orgId)
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const projects = await prisma.project.findMany({
    where: { orgId },
    include: { _count: { select: { columns: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const userId = (session.user as any).id as string

  const membership = await getMembership(userId, orgId)
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (membership.role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  try {
    const body = await req.json()
    const { name, description } = body
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const project = await prisma.project.create({
      data: { name, description, orgId },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { OrgRole } from "@prisma/client"

function isAdmin(session: unknown): boolean {
  return !!session && (session as { user?: { role?: string } }).user?.role === "ADMIN"
}

const VALID_ROLES: OrgRole[] = ["ADMIN", "MEMBER", "VIEWER"]

// POST: add a user (by id) directly to a project with a role.
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { projectId } = await params
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { userId, role = "MEMBER" } = await req.json()
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })

  const member = await prisma.projectMember.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(member, { status: 201 })
}

// DELETE: remove a user from a project.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { projectId } = await params
  const { userId } = await req.json()
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 })
  }

  const target = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!target) return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 })

  await prisma.projectMember.delete({ where: { userId_projectId: { userId, projectId } } })
  return NextResponse.json({ success: true })
}

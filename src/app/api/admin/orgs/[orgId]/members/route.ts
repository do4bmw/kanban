import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { OrgRole } from "@prisma/client"

function isAdmin(session: unknown): boolean {
  return !!session && (session as { user?: { role?: string } }).user?.role === "ADMIN"
}

const VALID_ROLES: OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"]

// GET: org members + projects (each with their members) for the management dialog.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { orgId } = await params

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [members, projects] = await Promise.all([
    prisma.orgMember.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ])

  return NextResponse.json({ members, projects })
}

// POST: add a user (by id) to the org with a role. Idempotent-ish: updates role if already a member.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { orgId } = await params
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { userId, role = "MEMBER" } = await req.json()
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })

  const member = await prisma.orgMember.upsert({
    where: { userId_orgId: { userId, orgId } },
    create: { userId, orgId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(member, { status: 201 })
}

// DELETE: remove a user from the org.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { orgId } = await params
  const { userId } = await req.json()
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId erforderlich" }, { status: 400 })
  }

  // Don't allow removing the last OWNER — an org must keep at least one owner.
  const target = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  })
  if (!target) return NextResponse.json({ error: "Mitglied nicht gefunden" }, { status: 404 })

  if (target.role === "OWNER") {
    const ownerCount = await prisma.orgMember.count({ where: { orgId, role: "OWNER" } })
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Der letzte Eigentümer kann nicht entfernt werden." },
        { status: 400 }
      )
    }
  }

  await prisma.orgMember.delete({ where: { userId_orgId: { userId, orgId } } })
  return NextResponse.json({ success: true })
}

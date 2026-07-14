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

  // Explicit project members + implicit ones: org OWNER/ADMIN have full access
  // to every project in the org without a ProjectMember row, so include them
  // (e.g. the org creator) and mark them as coming "via org" so the UI can
  // show them without offering a remove button.
  const [projectMembers, orgAdmins] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orgMember.findMany({
      where: { orgId: access.orgId, role: { in: ["OWNER", "ADMIN"] } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const seen = new Set<string>()
  const members: Array<{
    id: string
    role: string
    via: "org" | "project"
    user: { id: string; name: string; email: string }
  }> = []

  // Org owners/admins first — their org-level access takes precedence and is
  // not removable at the project level.
  for (const m of orgAdmins) {
    seen.add(m.user.id)
    members.push({ id: m.id, role: m.role, via: "org", user: m.user })
  }
  for (const m of projectMembers) {
    if (seen.has(m.user.id)) continue
    seen.add(m.user.id)
    members.push({ id: m.id, role: m.role, via: "project", user: m.user })
  }

  return NextResponse.json(members)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const callerId = (session.user as any).id as string

  const access = await getProjectAccess(callerId, projectId)
  if (!access || !["OWNER", "ADMIN"].includes(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })
  if (userId === callerId) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })

  await prisma.projectMember.deleteMany({ where: { projectId, userId } })
  return NextResponse.json({ success: true })
}

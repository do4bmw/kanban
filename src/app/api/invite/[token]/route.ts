import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      org: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })

  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  if (invitation.usedAt) return NextResponse.json({ error: "Invitation already used" }, { status: 400 })
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expired" }, { status: 400 })

  // Mask the email — show only the domain part so the UI can guide the user
  // without leaking the full address to unauthenticated callers.
  const [localPart, domain] = invitation.email.split("@")
  const maskedEmail = domain ? `${localPart[0] ?? "?"}***@${domain}` : invitation.email

  return NextResponse.json({
    orgId: invitation.orgId,
    orgName: invitation.org.name,
    projectId: invitation.projectId,
    projectName: invitation.project?.name ?? null,
    email: maskedEmail,
    role: invitation.role,
  })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { token } = await params
  const userId = (session.user as any).id as string
  const userEmail = session.user?.email as string

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { org: true, project: true },
  })

  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
  if (invitation.usedAt) return NextResponse.json({ error: "Invitation already used" }, { status: 400 })
  if (invitation.expiresAt < new Date()) return NextResponse.json({ error: "Invitation expired" }, { status: 400 })

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    return NextResponse.json({ error: "This invitation is for a different email address" }, { status: 403 })
  }

  if (invitation.projectId) {
    // Project-level invite → create ProjectMember
    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: invitation.projectId } },
    })
    if (!existing) {
      await prisma.projectMember.create({
        data: { userId, projectId: invitation.projectId, role: invitation.role },
      })
    }
    await prisma.invitation.update({ where: { token }, data: { usedAt: new Date() } })
    return NextResponse.json({
      projectId: invitation.projectId,
      projectName: invitation.project?.name,
      orgId: invitation.orgId,
    })
  } else {
    // Org-level invite → create OrgMember (existing behavior)
    const existing = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId: invitation.orgId } },
    })
    if (!existing) {
      await prisma.orgMember.create({
        data: { userId, orgId: invitation.orgId, role: invitation.role },
      })
    }
    await prisma.invitation.update({ where: { token }, data: { usedAt: new Date() } })
    return NextResponse.json({ orgId: invitation.orgId, orgName: invitation.org.name })
  }
}

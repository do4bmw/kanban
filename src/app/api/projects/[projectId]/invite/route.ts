import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getProjectAccess } from "@/lib/project-access"

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { projectId } = await params
  const callerId = (session.user as any).id as string

  const access = await getProjectAccess(callerId, projectId)
  if (!access || !["OWNER", "ADMIN"].includes(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { select: { id: true, name: true } } },
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const { email, role = "MEMBER" } = body
  if (!email || typeof email !== "string") return NextResponse.json({ error: "email required" }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  const normalizedEmail = email.toLowerCase().trim()

  const validRoles = ["ADMIN", "MEMBER", "VIEWER"]
  if (!validRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 })

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invitation = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      role,
      orgId: project.orgId,
      projectId,
      invitedBy: callerId,
      expiresAt,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const inviteUrl = `${baseUrl}/invite/${invitation.token}`

  let emailSent = false
  const { mailerEnabled, sendProjectInvitationEmail } = await import("@/lib/mailer")
  if (mailerEnabled()) {
    try {
      const caller = await prisma.user.findUnique({ where: { id: callerId }, select: { name: true } })
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Mail timeout")), 20_000)
      )
      await Promise.race([
        sendProjectInvitationEmail(normalizedEmail, project.name, caller?.name ?? "Jemand", inviteUrl, role),
        timeout,
      ])
      emailSent = true
    } catch (mailErr) {
      console.error("[project-invite] Failed to send email:", mailErr)
    }
  }

  return NextResponse.json({ invitation, inviteUrl, emailSent }, { status: 201 })
}

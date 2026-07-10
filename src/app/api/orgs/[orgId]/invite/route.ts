import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const callerId = (session.user as any).id as string

  const callerMembership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: callerId, orgId } },
  })
  if (!callerMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!["OWNER", "ADMIN"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { email, role } = body
    if (!email || !role || typeof email !== "string") return NextResponse.json({ error: "email and role are required" }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    const normalizedEmail = email.toLowerCase().trim()

    const validRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"]
    if (!validRoles.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invitation = await prisma.invitation.create({
      data: { email: normalizedEmail, role, orgId, invitedBy: callerId, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`

    let emailSent = false
    const { mailerEnabled, sendInvitationEmail } = await import("@/lib/mailer")
    if (mailerEnabled()) {
      try {
        const [caller, org] = await Promise.all([
          prisma.user.findUnique({ where: { id: callerId }, select: { name: true } }),
          prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        ])
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Mail timeout")), 20_000)
        )
        await Promise.race([
          sendInvitationEmail(normalizedEmail, org?.name ?? orgId, caller?.name ?? "Jemand", inviteUrl, role),
          timeout,
        ])
        emailSent = true
      } catch (mailErr) {
        console.error("[invite] Failed to send email:", mailErr)
      }
    }

    return NextResponse.json({ invitation, inviteUrl, emailSent }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

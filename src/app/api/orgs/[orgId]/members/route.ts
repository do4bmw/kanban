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

  const members = await prisma.orgMember.findMany({
    where: { orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(members)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orgId } = await params
  const callerId = (session.user as any).id as string

  const callerMembership = await getMembership(callerId, orgId)
  if (!callerMembership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!["OWNER", "ADMIN"].includes(callerMembership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId } = body
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const targetMembership = await getMembership(userId, orgId)
    if (!targetMembership) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    // Prevent removing last OWNER
    if (targetMembership.role === "OWNER") {
      const ownerCount = await prisma.orgMember.count({ where: { orgId, role: "OWNER" } })
      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last owner" }, { status: 400 })
      }
    }

    await prisma.orgMember.delete({ where: { userId_orgId: { userId, orgId } } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

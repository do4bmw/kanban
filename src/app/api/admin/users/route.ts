import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

async function requireAdmin(session: any) {
  if (!session) return false
  return (session.user as any).role === "ADMIN"
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(users)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId } = body
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const currentUserId = (session!.user as any).id
    if (userId === currentUserId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (targetUser.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 400 })
      }
    }

    await prisma.user.delete({ where: { id: userId } })
    await logAudit({
      action: "user.delete",
      entityType: "user",
      entityId: userId,
      summary: `Benutzer „${targetUser.name}" (${targetUser.email}) gelöscht`,
      actorId: currentUserId,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId, role } = body

    if (!userId || !role) return NextResponse.json({ error: "userId and role are required" }, { status: 400 })
    if (!["ADMIN", "USER"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 })

    // Prevent demoting last admin
    if (role === "USER") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
      const targetUser = await prisma.user.findUnique({ where: { id: userId } })
      if (targetUser?.role === "ADMIN" && adminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 })
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    })

    await logAudit({
      action: "user.role_change",
      entityType: "user",
      entityId: userId,
      summary: `Rolle von „${updated.name}" auf ${role} geändert`,
      actorId: (session!.user as any).id,
      metadata: { role },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

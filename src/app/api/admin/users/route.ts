import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

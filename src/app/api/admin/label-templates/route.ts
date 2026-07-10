import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

async function requireAdmin(req?: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const user = session.user as any
  if (user?.role !== "ADMIN") return null
  return session
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.labelTemplate.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const count = await prisma.labelTemplate.count()
  const template = await prisma.labelTemplate.create({
    data: { name: name.trim(), color: color || "#6366f1", order: count },
  })
  return NextResponse.json(template, { status: 201 })
}

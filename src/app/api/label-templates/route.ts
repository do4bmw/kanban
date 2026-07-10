import { NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.labelTemplate.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json(templates)
}

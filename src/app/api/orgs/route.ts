import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import { slugify } from "@/lib/utils"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string

  const orgs = await prisma.organization.findMany({
    where: { members: { some: { userId } } },
    include: {
      _count: { select: { members: true, projects: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(orgs)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string

  try {
    const body = await req.json()
    const { name } = body
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    let slug = slugify(name)
    let suffix = 2
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${slugify(name)}-${suffix++}`
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        members: { create: { userId, role: "OWNER" } },
      },
      include: { _count: { select: { members: true, projects: true } } },
    })

    return NextResponse.json(org, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

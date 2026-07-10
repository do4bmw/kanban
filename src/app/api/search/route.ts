import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  // Find all projects the user has access to
  const [orgMemberships, projectMemberships] = await Promise.all([
    prisma.orgMember.findMany({
      where: { userId },
      select: { orgId: true, role: true },
    }),
    prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    }),
  ])

  // Org OWNER/ADMIN can access all projects in their org
  const fullAccessOrgIds = orgMemberships
    .filter((m) => ["OWNER", "ADMIN"].includes(m.role))
    .map((m) => m.orgId)

  const explicitProjectIds = projectMemberships.map((m) => m.projectId)

  const cards = await prisma.card.findMany({
    where: {
      archived: false,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
      column: {
        project: {
          OR: [
            { orgId: { in: fullAccessOrgIds } },
            { id: { in: explicitProjectIds } },
          ],
        },
      },
    },
    include: {
      labels: true,
      assignee: { select: { id: true, name: true } },
      column: {
        select: {
          id: true,
          name: true,
          project: {
            select: {
              id: true,
              name: true,
              org: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  })

  return NextResponse.json(cards)
}

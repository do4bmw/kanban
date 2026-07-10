import prisma from "@/lib/prisma"

export type ProjectAccess = {
  role: string
  via: "org" | "project"
  projectId: string
  orgId: string
}

export async function getProjectAccess(
  userId: string,
  projectId: string
): Promise<ProjectAccess | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  })
  if (!project) return null

  const [orgMember, projectMember] = await Promise.all([
    prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId: project.orgId } },
    }),
    prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    }),
  ])

  // Org OWNER/ADMIN always have full access
  if (orgMember && ["OWNER", "ADMIN"].includes(orgMember.role)) {
    return { role: orgMember.role, via: "org", projectId, orgId: project.orgId }
  }

  // Explicit project member
  if (projectMember) {
    return { role: projectMember.role, via: "project", projectId, orgId: project.orgId }
  }

  // Org MEMBER/VIEWER without explicit project assignment → no access
  return null
}

export async function getAccessForColumn(
  userId: string,
  columnId: string
): Promise<ProjectAccess | null> {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    select: { projectId: true },
  })
  if (!column) return null
  return getProjectAccess(userId, column.projectId)
}

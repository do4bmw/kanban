import { NextRequest, NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { getProjectAccess } from "@/lib/project-access"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string; noteId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { cardId, noteId } = await params
  const userId = (session.user as any).id as string

  const note = await prisma.cardNote.findUnique({
    where: { id: noteId },
    include: { card: { include: { column: { select: { projectId: true } } } } },
  })
  if (!note || note.cardId !== cardId) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const access = await getProjectAccess(userId, note.card.column.projectId)
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Only the author or an admin/owner can delete notes
  const isPrivileged = ["OWNER", "ADMIN"].includes(access.role)
  if (note.authorId !== userId && !isPrivileged) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  await prisma.cardNote.delete({ where: { id: noteId } })
  return NextResponse.json({ success: true })
}

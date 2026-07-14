import prisma from "@/lib/prisma"

/**
 * Best-effort email notification when a card gets assigned to a user.
 * Never throws — assignment must succeed even if the mail fails.
 * Skips self-assignments (no point emailing yourself).
 */
export async function notifyCardAssigned(opts: {
  cardId: string
  cardTitle: string
  assigneeId: string
  assignerId: string
  projectId: string
  projectName: string
}) {
  try {
    if (opts.assigneeId === opts.assignerId) return

    const { mailerEnabled, sendCardAssignedEmail } = await import("@/lib/mailer")
    if (!mailerEnabled()) return

    const [assignee, assigner] = await Promise.all([
      prisma.user.findUnique({ where: { id: opts.assigneeId }, select: { name: true, email: true } }),
      prisma.user.findUnique({ where: { id: opts.assignerId }, select: { name: true } }),
    ])
    if (!assignee?.email) return

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const cardUrl = `${baseUrl}/projects/${opts.projectId}`

    await sendCardAssignedEmail(
      assignee.email,
      assignee.name || "dort",
      opts.cardTitle,
      opts.projectName,
      cardUrl,
      assigner?.name || "Jemand"
    )
  } catch (err) {
    console.error("[notify] Failed to send card-assigned email:", err)
  }
}

import prisma from "@/lib/prisma"

// Guards against duplicate assignment emails when the SAME assignment fires
// twice near-simultaneously (a double-submitted/raced request). One entry per
// card holds the last-notified assignee + time. A new assignee overwrites it,
// so reassigning back to a previous person is never blocked — only an
// identical (card, assignee) notification within the short window is skipped.
const recentlyNotified = new Map<string, { assigneeId: string; ts: number }>()
const DEDUPE_WINDOW_MS = 10_000

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

    const now = Date.now()
    const last = recentlyNotified.get(opts.cardId)
    if (last && last.assigneeId === opts.assigneeId && now - last.ts < DEDUPE_WINDOW_MS) {
      console.log(`[notify] skipped duplicate card-assigned email for ${opts.cardId}:${opts.assigneeId}`)
      return
    }
    recentlyNotified.set(opts.cardId, { assigneeId: opts.assigneeId, ts: now })
    // Opportunistic cleanup so the map can't grow unbounded.
    for (const [k, v] of recentlyNotified) {
      if (now - v.ts >= DEDUPE_WINDOW_MS) recentlyNotified.delete(k)
    }

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
    console.log(`[notify] card-assigned email sent to ${assignee.email} (card ${opts.cardId})`)
  } catch (err) {
    console.error("[notify] Failed to send card-assigned email:", err)
  }
}

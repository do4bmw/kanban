import prisma from "@/lib/prisma"

// Guards against duplicate assignment emails when the same assignment is
// submitted twice in quick succession (double-click, retried request, …).
// Keyed by cardId:assigneeId; entries expire after the window.
const recentlyNotified = new Map<string, number>()
const DEDUPE_WINDOW_MS = 30_000

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

    const key = `${opts.cardId}:${opts.assigneeId}`
    const now = Date.now()
    const last = recentlyNotified.get(key)
    if (last && now - last < DEDUPE_WINDOW_MS) {
      console.log(`[notify] skipped duplicate card-assigned email for ${key}`)
      return
    }
    recentlyNotified.set(key, now)
    // Opportunistic cleanup so the map can't grow unbounded.
    for (const [k, t] of recentlyNotified) {
      if (now - t >= DEDUPE_WINDOW_MS) recentlyNotified.delete(k)
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

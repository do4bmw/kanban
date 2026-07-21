import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const AUDIT_RETENTION_DAYS = 60

/**
 * Best-effort audit logging. Records who did what for the admin audit log.
 * Never throws — auditing must not block or fail the main operation.
 *
 * Pass the acting user's id (and, when handy, their name/email) so the entry
 * stays readable even after the user is later deleted.
 */
export async function logAudit(opts: {
  action: string
  entityType: string
  entityId?: string | null
  summary?: string | null
  actorId?: string | null
  actorName?: string | null
  actorEmail?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    let userName = opts.actorName ?? null
    let userEmail = opts.actorEmail ?? null
    if (opts.actorId && (!userName || !userEmail)) {
      const u = await prisma.user.findUnique({
        where: { id: opts.actorId },
        select: { name: true, email: true },
      })
      if (u) {
        userName = userName ?? u.name
        userEmail = userEmail ?? u.email
      }
    }

    await prisma.auditLog.create({
      data: {
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        summary: opts.summary ?? null,
        userId: opts.actorId ?? null,
        userName,
        userEmail,
        metadata: opts.metadata ? (opts.metadata as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err)
  }
}

/** Delete audit entries older than the retention window. Best-effort. */
export async function pruneAuditLog() {
  try {
    const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
  } catch (err) {
    console.error("[audit] Failed to prune audit log:", err)
  }
}

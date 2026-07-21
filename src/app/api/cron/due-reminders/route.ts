import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendMail } from "@/lib/mailer"
import { pruneAuditLog } from "@/lib/audit"

// Protected by a shared secret; call this endpoint from a cron job:
// curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/due-reminders
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Cards due within 24 hours, not yet reminded, not archived, with an assignee
  const cards = await prisma.card.findMany({
    where: {
      archived: false,
      dueDate: { gte: now, lte: in24h },
      reminderSentAt: null,
      assigneeId: { not: null },
    },
    include: {
      assignee: { select: { name: true, email: true } },
      column: {
        select: {
          name: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
  })

  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  let sent = 0

  for (const card of cards) {
    if (!card.assignee?.email) continue

    const dueDateStr = card.dueDate!.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    const projectUrl = `${baseUrl}/projects/${card.column.project.id}`

    const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><title>Fälligkeitserinnerung</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${appName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">⏰ Karte bald fällig</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        Hallo <strong>${card.assignee.name}</strong>,
      </p>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        die folgende Karte ist bald fällig:
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111827;">${card.title}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          Projekt: ${card.column.project.name} · Spalte: ${card.column.name}
        </p>
        <p style="margin:6px 0 0;font-size:13px;color:#ef4444;font-weight:500;">
          Fällig am: ${dueDateStr}
        </p>
      </div>
      <div style="text-align:center;">
        <a href="${projectUrl}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Zum Projekt
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Automatisch generiert — bitte nicht antworten.
      </p>
    </div>
  </div>
</body>
</html>`.trim()

    try {
      await sendMail({
        to: card.assignee.email,
        subject: `[${appName}] Erinnerung: "${card.title}" ist bald fällig`,
        html,
      })
      await prisma.card.update({
        where: { id: card.id },
        data: { reminderSentAt: now },
      })
      sent++
    } catch (err) {
      console.error(`[due-reminders] Failed to send for card ${card.id}:`, err)
    }
  }

  // Enforce audit-log retention on the same schedule.
  await pruneAuditLog()

  return NextResponse.json({ checked: cards.length, sent })
}

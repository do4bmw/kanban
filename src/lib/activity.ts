import prisma from "@/lib/prisma"
import type { ActivityType, Prisma } from "@prisma/client"

export async function logActivity(
  cardId: string,
  type: ActivityType,
  userId: string | null,
  data?: Record<string, unknown>
) {
  try {
    await prisma.cardActivity.create({
      data: {
        cardId,
        type,
        userId,
        data: data ? (data as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch {
    // Activity logging is best-effort — never block the main operation
  }
}

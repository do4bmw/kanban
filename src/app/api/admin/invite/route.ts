import { NextResponse } from "next/server"
import { getServerSession, authOptions } from "@/lib/auth"
import { sendPlatformInvitation, mailerEnabled } from "@/lib/mailer"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!mailerEnabled()) {
    return NextResponse.json({ error: "SMTP nicht konfiguriert." }, { status: 400 })
  }

  const { to } = await req.json()
  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "E-Mail-Adresse fehlt." }, { status: 400 })
  }

  try {
    await sendPlatformInvitation(to.trim(), user.name || "Administrator")
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Versand fehlgeschlagen." }, { status: 500 })
  }
}

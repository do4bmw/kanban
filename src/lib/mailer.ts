import nodemailer, { type Transporter } from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"

// A fresh (non-pooled) transporter per send. Pooled SMTP connections go stale
// when the server or a firewall drops idle sockets, which then hang until the
// socket timeout and fail intermittently. This app sends mail infrequently
// (invites, assignments, reminders), so the tiny cost of a fresh connection is
// well worth the reliability, especially now that sends run off the request
// path.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// Timeouts default generously: the observed "Error: Timeout" on the first
// attempt is nodemailer's greetingTimeout — the mail server delays its 220
// greeting on a cold connection (greylisting / anti-spam tarpit), and 8s was
// too short. Since sends run in the background, waiting longer costs nothing.
// All tunable per env without a rebuild.
const CONNECTION_TIMEOUT = envInt("SMTP_CONNECTION_TIMEOUT", 30_000)
const GREETING_TIMEOUT = envInt("SMTP_GREETING_TIMEOUT", 30_000)
const SOCKET_TIMEOUT = envInt("SMTP_SOCKET_TIMEOUT", 30_000)
const MAX_ATTEMPTS = envInt("SMTP_MAX_ATTEMPTS", 4)
const SMTP_DEBUG = process.env.SMTP_DEBUG === "true"

function createTransporterOptions(): SMTPTransport.Options {
  const host = process.env.SMTP_HOST as string
  const port = parseInt(process.env.SMTP_PORT || "587", 10)
  const secureEnv = process.env.SMTP_SECURE
  const secure = secureEnv !== undefined ? secureEnv === "true" : port === 465

  const options: SMTPTransport.Options = {
    host,
    port,
    secure,
    // For STARTTLS (port 587): require upgrade to TLS
    requireTLS: !secure && port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      // Allow self-signed certs on internal mail servers
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
    },
    connectionTimeout: CONNECTION_TIMEOUT,
    greetingTimeout: GREETING_TIMEOUT,
    socketTimeout: SOCKET_TIMEOUT,
    // Set SMTP_DEBUG=true to log the full SMTP handshake to stdout.
    logger: SMTP_DEBUG,
    debug: SMTP_DEBUG,
  }

  // Force IPv4. Some hosts publish an AAAA record whose SMTP port is
  // firewalled. `family` is passed through to net.connect but isn't in
  // nodemailer's typings.
  ;(options as SMTPTransport.Options & { family?: number }).family = 4

  return options
}

export function mailerEnabled(): boolean {
  return !!process.env.SMTP_HOST
}

async function sendOnce(opts: { to: string; subject: string; html: string }) {
  const transporter: Transporter = nodemailer.createTransport(createTransporterOptions())
  const from = process.env.SMTP_FROM || "Kanban <noreply@kanban.local>"
  try {
    await transporter.sendMail({ from, ...opts })
  } finally {
    transporter.close()
  }
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  if (!mailerEnabled()) {
    console.log("[mailer] SMTP not configured — would have sent:")
    console.log(`  To: ${opts.to}`)
    console.log(`  Subject: ${opts.subject}`)
    console.log(`  Body (text): ${opts.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`)
    return
  }

  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const started = Date.now()
    try {
      await sendOnce(opts)
      console.log(`[mailer] sent to ${opts.to} on attempt ${attempt}/${MAX_ATTEMPTS} in ${Date.now() - started}ms`)
      return
    } catch (err) {
      lastErr = err
      console.error(
        `[mailer] attempt ${attempt}/${MAX_ATTEMPTS} to ${opts.to} failed after ${Date.now() - started}ms:`,
        err instanceof Error ? err.message : err
      )
      // Exponential backoff: 2s, 4s, 8s … between attempts.
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  throw lastErr
}

export async function sendTestMail(to: string) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
  const subject = `[${appName}] Test-E-Mail`
  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${appName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Test-E-Mail</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        Diese E-Mail wurde über den Admin-Bereich von <strong>${appName}</strong> versandt.<br/>
        Der SMTP-Versand funktioniert korrekt. ✅
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Automatisch generiert — bitte nicht antworten.
      </p>
    </div>
  </div>
</body>
</html>`.trim()
  await sendMail({ to, subject, html })
}

export async function sendPlatformInvitation(to: string, inviterName: string) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const registerUrl = `${baseUrl}/register`
  const subject = `Du wurdest zu ${appName} eingeladen`
  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${appName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Du wurdest eingeladen!</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        <strong>${inviterName}</strong> hat dich eingeladen, <strong>${appName}</strong> zu nutzen.
      </p>
      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.6;">
        Registriere dich jetzt und starte sofort.
      </p>
      <div style="text-align:center;">
        <a href="${registerUrl}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Jetzt registrieren
        </a>
      </div>
      <p style="margin:32px 0 0;color:#6b7280;font-size:13px;text-align:center;">
        Oder kopiere diesen Link in deinen Browser:<br/>
        <a href="${registerUrl}" style="color:#4f46e5;word-break:break-all;">${registerUrl}</a>
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
      </p>
    </div>
  </div>
</body>
</html>`.trim()
  await sendMail({ to, subject, html })
}

export async function sendProjectInvitationEmail(
  to: string,
  projectName: string,
  inviterName: string,
  inviteUrl: string,
  role: string
) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
  const roleLabel: Record<string, string> = {
    ADMIN: "Administrator",
    MEMBER: "Mitglied",
    VIEWER: "Betrachter",
  }
  const roleName = roleLabel[role] ?? role
  const subject = `Du wurdest zum Projekt "${projectName}" eingeladen`
  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${appName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Projekteinladung</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        <strong>${inviterName}</strong> hat dich eingeladen, am Projekt
        <strong>${projectName}</strong> als <strong>${roleName}</strong> mitzuarbeiten.
      </p>
      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.6;">
        Klicke auf den Button unten, um die Einladung anzunehmen. Der Link ist 7 Tage gültig.
      </p>
      <div style="text-align:center;">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Einladung annehmen
        </a>
      </div>
      <p style="margin:32px 0 0;color:#6b7280;font-size:13px;text-align:center;">
        Oder kopiere diesen Link:<br/>
        <a href="${inviteUrl}" style="color:#4f46e5;word-break:break-all;">${inviteUrl}</a>
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
      </p>
    </div>
  </div>
</body>
</html>`.trim()
  await sendMail({ to, subject, html })
}

export async function sendCardAssignedEmail(
  to: string,
  assigneeName: string,
  cardTitle: string,
  projectName: string,
  cardUrl: string,
  assignerName: string
) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
  const subject = `Dir wurde eine Karte zugewiesen: "${cardTitle}"`
  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${appName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Neue Kartenzuweisung</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        Hallo ${assigneeName},<br/>
        <strong>${assignerName}</strong> hat dir eine Karte im Projekt
        <strong>${projectName}</strong> zugewiesen:
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${cardTitle}</p>
      </div>
      <div style="text-align:center;">
        <a href="${cardUrl}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Karte ansehen
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
  await sendMail({ to, subject, html })
}

export async function sendCardNoteEmail(
  to: string,
  recipientName: string,
  authorName: string,
  noteContent: string,
  cardTitle: string,
  projectName: string,
  cardUrl: string
) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Kanban"
  const subject = `Neue Notiz an "${cardTitle}"`
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const preview = noteContent.length > 500 ? `${noteContent.slice(0, 500)}…` : noteContent
  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${appName}</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Neue Notiz</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        Hallo ${escape(recipientName)},<br/>
        <strong>${escape(authorName)}</strong> hat eine Notiz an der Karte
        <strong>${escape(cardTitle)}</strong> (Projekt ${escape(projectName)}) hinterlassen:
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escape(preview)}</div>
      <div style="text-align:center;">
        <a href="${cardUrl}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Karte ansehen
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Du erhältst diese E-Mail, weil du an dieser Karte beteiligt bist.
      </p>
    </div>
  </div>
</body>
</html>`.trim()
  await sendMail({ to, subject, html })
}

export async function sendInvitationEmail(
  to: string,
  orgName: string,
  inviterName: string,
  inviteUrl: string,
  role: string
) {
  const subject = `Du wurdest zu ${orgName} eingeladen`

  const roleLabel: Record<string, string> = {
    OWNER: "Eigentümer",
    ADMIN: "Administrator",
    MEMBER: "Mitglied",
    VIEWER: "Betrachter",
  }
  const roleName = roleLabel[role] ?? role

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#4f46e5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Kanban</h1>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Du wurdest eingeladen!</h2>
      <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
        <strong>${inviterName}</strong> hat dich eingeladen, der Organisation
        <strong>${orgName}</strong> als <strong>${roleName}</strong> beizutreten.
      </p>
      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.6;">
        Klicke auf den Button unten, um die Einladung anzunehmen. Der Link ist 7 Tage gültig.
      </p>
      <div style="text-align:center;">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          Einladung annehmen
        </a>
      </div>
      <p style="margin:32px 0 0;color:#6b7280;font-size:13px;text-align:center;">
        Oder kopiere diesen Link in deinen Browser:<br/>
        <a href="${inviteUrl}" style="color:#4f46e5;word-break:break-all;">${inviteUrl}</a>
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()

  await sendMail({ to, subject, html })
}

import { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export { getServerSession } from "next-auth"

// How long a login stays valid, in hours. Configurable via env (e.g. 8 or 24)
// without a rebuild; defaults to 24 hours. The cookie/JWT maxAge derives from
// this, so users stay signed in across visits until it expires.
const sessionHours = (() => {
  const n = parseInt(process.env.SESSION_MAX_AGE_HOURS || "", 10)
  return Number.isFinite(n) && n > 0 ? n : 24
})()
const SESSION_MAX_AGE = sessionHours * 60 * 60

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: { maxAge: SESSION_MAX_AGE },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        // Emails are stored lowercased/trimmed at registration, so normalize
        // here too — otherwise "Benny@x.de" fails to match "benny@x.de".
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  pages: { signIn: "/login" },
}

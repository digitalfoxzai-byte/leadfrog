import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { query } from './db'

interface DbUser {
  id: number
  name: string
  email: string
  password: string
  role: string
  plan: string
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const users = await query<DbUser[]>(
          'SELECT * FROM users WHERE email = ? LIMIT 1',
          [credentials.email]
        )
        const user = users[0]
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        if (user.role === 'banned') return null
        return { id: String(user.id), name: user.name, email: user.email, role: user.role, plan: user.plan }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.plan = (user as { plan?: string }).plan
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // token.sub is auto-set by NextAuth from user.id; token.id is our explicit copy
        (session.user as { id?: string; role?: string; plan?: string }).id = (token.id ?? token.sub) as string
        ;(session.user as { id?: string; role?: string; plan?: string }).role = token.role as string
        ;(session.user as { id?: string; role?: string; plan?: string }).plan = token.plan as string
      }
      return session
    },
  },
}

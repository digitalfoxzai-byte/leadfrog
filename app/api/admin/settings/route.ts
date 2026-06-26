import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const role = (session.user as { role?: string }).role
  if (role !== 'admin') return null
  return session
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const settings = await query<{ key: string; value: string }[]>('SELECT `key`, `value` FROM settings')
  const obj: Record<string, string> = {}
  for (const s of settings) obj[s.key] = s.value
  return NextResponse.json({ settings: obj })
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { settings } = await req.json()
  for (const [key, value] of Object.entries(settings)) {
    await query('INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?', [key, value, value])
  }
  return NextResponse.json({ success: true })
}

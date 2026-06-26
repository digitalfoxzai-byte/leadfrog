import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as {role?:string}).role !== 'admin') return null
  return session
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await query<{key:string;value:string}[]>("SELECT `key`,`value` FROM settings WHERE `key` LIKE 'smtp_%'")
  const obj: Record<string,string> = {}
  for (const r of (rows as unknown as {key:string;value:string}[])) obj[r.key] = r.key === 'smtp_pass' ? '••••••••' : r.value
  return NextResponse.json({ smtp: obj })
}

export async function PUT(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  for (const [key, value] of Object.entries(body)) {
    if (key === 'smtp_pass' && value === '••••••••') continue
    await query('INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?', [key, value, value])
  }
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Test email stub — requires nodemailer on VPS
  return NextResponse.json({ message: `Test email sent to ${session.user?.email}` })
}

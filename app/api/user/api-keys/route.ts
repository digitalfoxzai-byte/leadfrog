import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import crypto from 'crypto'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL DEFAULT 'My API Key',
      key_prefix VARCHAR(8) NOT NULL,
      key_hash VARCHAR(64) NOT NULL,
      last_used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ak_uid (user_id)
    )
  `)
}

async function isBusiness(userId: number, role: string): Promise<boolean> {
  if (role === 'admin') return true
  const rows = await query<{ plan: string }[]>('SELECT plan FROM users WHERE id = ?', [userId])
  return ['business'].includes(rows[0]?.plan || '')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const role = (session.user as { role?: string }).role || ''
  if (!(await isBusiness(userId, role))) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })
  await ensureTable()
  const rows = await query<{ id: number; name: string; key_prefix: string; last_used_at: string | null; created_at: string }[]>(
    'SELECT id, name, key_prefix, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const role = (session.user as { role?: string }).role || ''
  if (!(await isBusiness(userId, role))) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const existing = await query<{ id: number }[]>('SELECT id FROM api_keys WHERE user_id = ?', [userId])
  if (existing.length >= 5) return NextResponse.json({ error: 'Maximum 5 API keys allowed' }, { status: 400 })

  const { name } = await req.json().catch(() => ({}))
  const raw = crypto.randomBytes(28).toString('hex')
  const prefix = raw.slice(0, 8)
  const fullKey = `lf_${prefix}_${raw.slice(8)}`
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex')

  await ensureTable()
  await query(
    'INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)',
    [userId, (name || 'My API Key').slice(0, 100), prefix, hash]
  )
  return NextResponse.json({ success: true, key: fullKey, prefix })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const { id } = await req.json()
  await query('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [id, userId])
  return NextResponse.json({ success: true })
}

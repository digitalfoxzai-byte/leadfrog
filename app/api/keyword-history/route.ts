import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS keyword_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      keyword VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      results INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_kh_uid (user_id)
    )
  `)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  await ensureTable()
  const rows = await query<{ id: number; keyword: string; location: string; results: number; created_at: string }[]>(
    'SELECT id, keyword, location, results, created_at FROM keyword_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [userId]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const { keyword, location, results } = await req.json()
  if (!keyword || !location) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  await ensureTable()
  await query(
    'INSERT INTO keyword_history (user_id, keyword, location, results) VALUES (?, ?, ?, ?)',
    [userId, keyword.trim(), location.trim(), results || 0]
  )
  // Keep only latest 20 per user
  await query(
    `DELETE FROM keyword_history WHERE user_id = ? AND id NOT IN (
      SELECT id FROM (SELECT id FROM keyword_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20) t
    )`,
    [userId, userId]
  )
  return NextResponse.json({ success: true })
}

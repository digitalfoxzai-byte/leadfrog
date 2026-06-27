import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUserId(session: any): number {
  const id = session?.user?.id
  return parseInt(id || '0', 10) || 0
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ leads: [] })

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')
  const keyword = searchParams.get('keyword')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '200', 10))
  const offset = (page - 1) * limit

  let sql = 'SELECT * FROM leads WHERE user_id = ?'
  const params: (string | number)[] = [userId]

  if (statusParam) { sql += ' AND status = ?'; params.push(statusParam) }
  if (keyword) { sql += ' AND (name LIKE ? OR category LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
  // Inline LIMIT/OFFSET to avoid prepared-statement binding issues
  sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`

  const leads = await query(sql, params)
  return NextResponse.json({ leads })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const body = await req.json()

  if (Array.isArray(body)) {
    for (const lead of body) {
      await query(
        'INSERT INTO leads (user_id,name,phone,email,address,website,category,rating,reviews,keyword,location) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [userId, lead.name, lead.phone ?? null, lead.email ?? null, lead.address, lead.website ?? null, lead.category, lead.rating ?? null, lead.reviews ?? 0, lead.keyword, lead.location]
      )
    }
    return NextResponse.json({ saved: body.length })
  }

  await query(
    'INSERT INTO leads (user_id,name,phone,email,address,website,category,rating,reviews,keyword,location) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [userId, body.name, body.phone ?? null, body.email ?? null, body.address, body.website ?? null, body.category, body.rating ?? null, body.reviews ?? 0, body.keyword, body.location]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = getUserId(session)
  if (!userId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { ids } = await req.json()
  if (ids === 'all') {
    await query('DELETE FROM leads WHERE user_id = ?', [userId])
  } else if (Array.isArray(ids)) {
    await query(`DELETE FROM leads WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [userId, ...ids])
  }
  return NextResponse.json({ success: true })
}

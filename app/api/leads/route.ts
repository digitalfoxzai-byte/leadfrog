import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const keyword = searchParams.get('keyword')
  const page = Number(searchParams.get('page') || 1)
  const limit = Number(searchParams.get('limit') || 50)
  const offset = (page - 1) * limit

  let sql = 'SELECT * FROM leads WHERE user_id = ?'
  const params: unknown[] = [(session.user as { id?: string }).id || session.user?.email]

  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (keyword) { sql += ' AND (name LIKE ? OR category LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const leads = await query(sql, params)
  return NextResponse.json({ leads })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const userId = (session.user as { id?: string }).id || session.user?.email

  if (Array.isArray(body)) {
    for (const lead of body) {
      await query(
        'INSERT INTO leads (user_id,name,phone,email,address,website,category,rating,reviews,keyword,location) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [userId, lead.name, lead.phone, lead.email, lead.address, lead.website, lead.category, lead.rating, lead.reviews, lead.keyword, lead.location]
      )
    }
    return NextResponse.json({ saved: body.length })
  }

  await query(
    'INSERT INTO leads (user_id,name,phone,email,address,website,category,rating,reviews,keyword,location) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [userId, body.name, body.phone, body.email, body.address, body.website, body.category, body.rating, body.reviews, body.keyword, body.location]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json()
  const userId = (session.user as { id?: string }).id
  if (ids === 'all') {
    await query('DELETE FROM leads WHERE user_id = ?', [userId])
  } else if (Array.isArray(ids)) {
    await query(`DELETE FROM leads WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [userId, ...ids])
  }
  return NextResponse.json({ success: true })
}

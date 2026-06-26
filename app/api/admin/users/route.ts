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
  const users = await query(`
    SELECT u.id, u.name, u.email, u.role, u.plan, u.plan_expires_at, u.scrape_count, u.created_at,
    (SELECT COUNT(*) FROM leads l WHERE l.user_id = u.id) as lead_count
    FROM users u WHERE u.role != 'admin' ORDER BY u.created_at DESC
  `)
  return NextResponse.json({ users })
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId, action, plan, cycle } = await req.json()

  if (action === 'ban') {
    const users = await query<{role:string}[]>('SELECT role FROM users WHERE id=?', [userId])
    if ((users[0] as unknown as {role:string})?.role === 'admin') return NextResponse.json({ error: 'Cannot ban admin' }, { status: 400 })
    await query("UPDATE users SET role='banned' WHERE id=?", [userId])
  } else if (action === 'unban') {
    await query("UPDATE users SET role='user' WHERE id=?", [userId])
  } else if (action === 'plan') {
    const months = cycle === 'yearly' ? 12 : 1
    if (plan === 'free') {
      await query("UPDATE users SET plan='free', plan_expires_at=NULL WHERE id=?", [userId])
    } else {
      await query(
        `UPDATE users SET plan=?, plan_expires_at=DATE_ADD(NOW(), INTERVAL ? MONTH) WHERE id=?`,
        [plan, months, userId]
      )
    }
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId } = await req.json()
  const users = await query<{role:string}[]>('SELECT role FROM users WHERE id=?', [userId])
  if ((users[0] as unknown as {role:string})?.role === 'admin') return NextResponse.json({ error: 'Cannot delete admin' }, { status: 400 })
  await query('DELETE FROM users WHERE id=?', [userId])
  return NextResponse.json({ success: true })
}

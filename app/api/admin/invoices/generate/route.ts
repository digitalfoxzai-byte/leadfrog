import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string }).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, plan, amount } = await req.json()
  if (!userId || !plan || amount == null)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (!['free', 'starter', 'pro', 'business'].includes(plan))
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0 || amt > 1_000_000)
    return NextResponse.json({ error: 'Amount must be between 1 and 1,000,000' }, { status: 400 })

  const uid = Number(userId)
  if (!Number.isInteger(uid) || uid <= 0)
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })

  const userExists = await query<{ id: number }[]>('SELECT id FROM users WHERE id = ? LIMIT 1', [uid])
  if (!userExists[0])
    return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const result = await query<{ insertId: number }>(
    `INSERT INTO subscriptions (user_id, plan, amount, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`,
    [uid, plan, Math.round(amt * 100)]
  )

  const id = (result as unknown as { insertId: number }).insertId
  const now = new Date()
  const invoiceNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${id}`

  return NextResponse.json({ success: true, invoiceId: id, invoiceNumber: invoiceNum })
}

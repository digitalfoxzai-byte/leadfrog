import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string }).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, plan, amount } = await req.json()
  if (!userId || !plan || !amount)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const result = await query<{ insertId: number }>(
    `INSERT INTO subscriptions (user_id, plan, amount, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`,
    [userId, plan, Math.round(amount * 100)]
  )

  const id = (result as unknown as { insertId: number }).insertId
  const now = new Date()
  const invoiceNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${id}`

  return NextResponse.json({ success: true, invoiceId: id, invoiceNumber: invoiceNum })
}

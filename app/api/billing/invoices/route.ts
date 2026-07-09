import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string }).id || '0', 10)

  const rows = await query<{
    id: number; plan: string; orderId: string; paymentId: string | null
    amount: number; status: string; date: string; due: string; cycle: string
  }[]>(
    `SELECT id, plan, razorpay_order_id as orderId, razorpay_payment_id as paymentId,
            ROUND(amount / 100) as amount, status,
            DATE_FORMAT(created_at, '%d %b %Y') as date,
            DATE_FORMAT(expires_at, '%d %b %Y') as due,
            CASE WHEN DATEDIFF(expires_at, starts_at) > 35 THEN 'Annual' ELSE 'Monthly' END as cycle
     FROM subscriptions WHERE user_id = ?
       AND NOT (status = 'pending' AND razorpay_order_id IS NOT NULL
         AND razorpay_payment_id IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))
     ORDER BY created_at DESC LIMIT 20`,
    [userId]
  )

  // Map status: active → paid
  const invoices = rows.map(r => ({
    ...r,
    status: r.status === 'active' ? 'paid' : r.status,
  }))

  return NextResponse.json(invoices)
}

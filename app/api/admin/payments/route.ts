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

  const invoices = await query(`
    SELECT s.id, s.razorpay_order_id, s.razorpay_payment_id, s.plan, s.amount, s.status,
           s.starts_at, s.expires_at, s.created_at, u.name as user_name, u.email as user_email
    FROM subscriptions s JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC LIMIT 100
  `)

  const upcoming = await query(`
    SELECT u.id, u.name, u.email, u.plan, u.plan_expires_at,
           DATEDIFF(u.plan_expires_at, NOW()) as days_left
    FROM users u
    WHERE u.plan_expires_at IS NOT NULL
      AND u.plan_expires_at > NOW()
      AND u.plan_expires_at <= DATE_ADD(NOW(), INTERVAL 30 DAY)
    ORDER BY u.plan_expires_at ASC
  `)

  const [[rev]] = [await query<{total:number}[]>("SELECT COALESCE(SUM(amount),0) as total FROM subscriptions WHERE status='active'")]
  const [[pend]] = [await query<{total:number}[]>("SELECT COALESCE(SUM(amount),0) as total FROM subscriptions WHERE status='pending'")]

  return NextResponse.json({
    invoices,
    upcoming,
    stats: {
      revenue: Math.round((rev as unknown as {total:number}).total / 100),
      pending: Math.round((pend as unknown as {total:number}).total / 100),
      upcomingCount: (upcoming as unknown[]).length,
    }
  })
}

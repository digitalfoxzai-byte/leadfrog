import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as {role?:string}).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = (rows: any, key = 'count') => ((rows as Record<string,number>[])[0]?.[key] ?? 0)

  const [total, paid, leads, revenue] = await Promise.all([
    query("SELECT COUNT(*) as count FROM users"),
    query("SELECT COUNT(*) as count FROM users WHERE plan != 'free'"),
    query("SELECT COUNT(*) as count FROM leads"),
    query("SELECT COALESCE(SUM(amount),0) as total FROM subscriptions WHERE status='active'"),
  ])

  return NextResponse.json({
    totalUsers: n(total),
    activeUsers: n(paid),
    totalLeads: n(leads),
    revenue: Math.round(n(revenue, 'total') / 100),
  })
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const LIMITS: Record<string, { leads: number; label: string; monthly: boolean; trialDays?: number }> = {
  free:     { leads: 50,    label: 'Free Trial', monthly: false, trialDays: 3 },
  starter:  { leads: 500,   label: 'Starter',    monthly: true },
  pro:      { leads: 2000,  label: 'Pro',         monthly: true },
  business: { leads: 10000, label: 'Business',    monthly: true },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const role = (session.user as { role?: string }).role

  if (!userId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  if (role === 'admin') {
    return NextResponse.json({
      plan: 'admin', label: 'Admin', isActive: true,
      leadsUsed: 0, leadsLimit: -1, leadsRemaining: -1,
      daysLeft: 999, trialEndsAt: null, planExpiresAt: null,
      expired: false, limitReached: false, percentUsed: 0,
    })
  }

  const users = await query<{ plan: string; plan_expires_at: string | null; created_at: string }[]>(
    'SELECT plan, plan_expires_at, created_at FROM users WHERE id = ?', [userId]
  )
  const user = users[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const plan = user.plan || 'free'
  const limits = LIMITS[plan] || LIMITS.free

  // Lead count: total for trial, monthly for paid plans
  let leadsUsed = 0
  if (limits.monthly) {
    const rows = await query<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')",
      [userId]
    )
    leadsUsed = Number(rows[0]?.count || 0)
  } else {
    const rows = await query<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM leads WHERE user_id = ?', [userId]
    )
    leadsUsed = Number(rows[0]?.count || 0)
  }

  let expired = false
  let daysLeft = 0
  let trialEndsAt: string | null = null

  if (plan === 'free' && limits.trialDays) {
    const trialEnd = new Date(new Date(user.created_at).getTime() + limits.trialDays * 24 * 60 * 60 * 1000)
    trialEndsAt = trialEnd.toISOString()
    expired = Date.now() > trialEnd.getTime()
    daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
  } else if (user.plan_expires_at) {
    const planExpiry = new Date(user.plan_expires_at)
    expired = Date.now() > planExpiry.getTime()
    daysLeft = Math.max(0, Math.ceil((planExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
  }

  const limitReached = leadsUsed >= limits.leads
  const isActive = !expired && !limitReached
  const leadsRemaining = Math.max(0, limits.leads - leadsUsed)
  const percentUsed = Math.min(100, Math.round((leadsUsed / limits.leads) * 100))

  return NextResponse.json({
    plan, label: limits.label, isActive, leadsUsed, leadsLimit: limits.leads, leadsRemaining,
    daysLeft, trialEndsAt, planExpiresAt: user.plan_expires_at || null,
    expired, limitReached, percentUsed,
  })
}

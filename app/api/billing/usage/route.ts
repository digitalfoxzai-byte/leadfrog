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

function fmt(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const role   = (session.user as { role?: string }).role

  if (role === 'admin') {
    return NextResponse.json({
      plan: 'admin', label: 'Admin', status: 'Active',
      isActive: true, planStarted: '—', nextBilling: '—',
      leadsUsed: 0, leadsLimit: -1, leadsRemaining: -1,
      percentUsed: 0, daysLeft: 999, trialEndsAt: null, planExpiresAt: null,
    })
  }

  const users = await query<{ plan: string; plan_expires_at: string | null; created_at: string; name: string }[]>(
    'SELECT plan, plan_expires_at, created_at, name FROM users WHERE id = ?', [userId]
  )
  const user = users[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const plan   = user.plan || 'free'
  const limits = LIMITS[plan] || LIMITS.free
  const isFree = plan === 'free'

  // Lead count
  let leadsUsed = 0
  if (limits.monthly) {
    const rows = await query<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')", [userId]
    )
    leadsUsed = Number(rows[0]?.count || 0)
  } else {
    const rows = await query<{ count: number }[]>('SELECT COUNT(*) as count FROM leads WHERE user_id = ?', [userId])
    leadsUsed = Number(rows[0]?.count || 0)
  }

  // Date calcs
  let daysLeft = 0
  let expired  = false
  let trialEndsAt:   string | null = null
  let planExpiresAt: string | null = null
  let planStarted = fmt(new Date(user.created_at))
  let nextBilling = '—'

  if (isFree && limits.trialDays) {
    const trialEnd = new Date(new Date(user.created_at).getTime() + limits.trialDays * 864e5)
    trialEndsAt = trialEnd.toISOString()
    expired     = Date.now() > trialEnd.getTime()
    daysLeft    = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 864e5))
    nextBilling = `Trial ends ${fmt(trialEnd)}`
  } else if (user.plan_expires_at) {
    const expiry = new Date(user.plan_expires_at)
    planExpiresAt = expiry.toISOString()
    expired    = Date.now() > expiry.getTime()
    daysLeft   = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 864e5))
    nextBilling = fmt(expiry)
    // Get subscription start date
    const subs = await query<{ starts_at: string }[]>(
      "SELECT DATE_FORMAT(starts_at, '%d %b %Y') as starts_at FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [userId]
    )
    if (subs[0]?.starts_at) planStarted = subs[0].starts_at
  }

  const limitReached  = leadsUsed >= limits.leads
  const isActive      = !expired && !limitReached
  const leadsRemaining = Math.max(0, limits.leads - leadsUsed)
  const percentUsed   = Math.min(100, Math.round((leadsUsed / limits.leads) * 100))

  let status = isActive ? 'Active' : (expired ? 'Expired' : 'Limit Reached')
  if (isFree && isActive) status = 'Trial Active'

  return NextResponse.json({
    plan, label: limits.label, status, isActive,
    planStarted, nextBilling,
    leadsUsed, leadsLimit: limits.leads, leadsRemaining, percentUsed,
    daysLeft, trialEndsAt, planExpiresAt, expired, limitReached,
    name: user.name,
  })
}

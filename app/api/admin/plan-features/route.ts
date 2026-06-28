import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { getAllPlanFeatures, ensureFeaturesTable, FEATURES } from '@/lib/plan-features'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const role = (session.user as { role?: string }).role
  return role === 'admin' ? session : null
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const features = await getAllPlanFeatures()
  return NextResponse.json(features)
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { feature, plan, enabled } = await req.json()
  if (!FEATURES.includes(feature) || !['free', 'starter', 'pro', 'business'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }
  await ensureFeaturesTable()
  await query(
    'INSERT INTO plan_features (feature, plan, enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE enabled = ?',
    [feature, plan, enabled ? 1 : 0, enabled ? 1 : 0]
  )
  return NextResponse.json({ success: true })
}

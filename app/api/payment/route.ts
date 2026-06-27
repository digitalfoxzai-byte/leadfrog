import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const PLANS: Record<string, { monthly: number; annual: number; name: string }> = {
  starter:  { monthly: 49900,  annual: 478800,  name: 'Starter'  },  // ₹499/mo → ₹399/mo × 12 = ₹4788/yr
  pro:      { monthly: 99900,  annual: 958800,  name: 'Pro'      },  // ₹999/mo → ₹799/mo × 12 = ₹9588/yr
  business: { monthly: 249900, annual: 2398800, name: 'Business' },  // ₹2499/mo → ₹1999/mo × 12 = ₹23988/yr
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, cycle = 'monthly' } = await req.json()
  if (!PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  const isAnnual = cycle === 'annual'

  const settings = await query<{ key: string; value: string }[]>('SELECT `key`, `value` FROM settings WHERE `key` IN (?, ?)', ['razorpay_key_id', 'razorpay_key_secret'])
  const keyId = settings.find(s => s.key === 'razorpay_key_id')?.value || process.env.RAZORPAY_KEY_ID
  const keySecret = settings.find(s => s.key === 'razorpay_key_secret')?.value || process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })

  const Razorpay = (await import('razorpay')).default
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  const planData = PLANS[plan]
  const amount = isAnnual ? planData.annual : planData.monthly
  const planName = `${planData.name}${isAnnual ? ' Annual' : ''}`

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: `leadfrog_${Date.now()}`,
    notes: { plan, cycle, user: session.user?.email || '' },
  })

  const userId = (session.user as { id?: string }).id
  await query('INSERT INTO subscriptions (user_id, plan, razorpay_order_id, amount, status) VALUES (?,?,?,?,?)',
    [userId, plan, order.id, amount, 'pending'])

  return NextResponse.json({ orderId: order.id, keyId, amount, planName })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId, paymentId, plan, cycle = 'monthly' } = await req.json()
  const userId = (session.user as { id?: string }).id
  const expires = new Date()
  if (cycle === 'annual') expires.setFullYear(expires.getFullYear() + 1)
  else expires.setMonth(expires.getMonth() + 1)

  await query('UPDATE subscriptions SET razorpay_payment_id=?, status=?, starts_at=NOW(), expires_at=? WHERE razorpay_order_id=?',
    [paymentId, 'active', expires, orderId])
  await query('UPDATE users SET plan=?, plan_expires_at=? WHERE id=?', [plan, expires, userId])

  return NextResponse.json({ success: true })
}

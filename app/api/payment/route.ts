import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { sendMail, emailTemplate } from '@/lib/mailer'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

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

  const { orderId, paymentId, signature, plan, cycle = 'monthly' } = await req.json()

  // Validate plan before anything else
  if (!PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  // Verify Razorpay signature — prevents fake payment activation
  const settings = await query<{ key: string; value: string }[]>(
    'SELECT `key`, `value` FROM settings WHERE `key` IN (?, ?)', ['razorpay_key_id', 'razorpay_key_secret']
  )
  const keySecret = settings.find(s => s.key === 'razorpay_key_secret')?.value || process.env.RAZORPAY_KEY_SECRET || ''
  const expectedSig = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
  if (expectedSig !== signature) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  const userId = (session.user as { id?: string }).id
  const expires = new Date()
  if (cycle === 'annual') expires.setFullYear(expires.getFullYear() + 1)
  else expires.setMonth(expires.getMonth() + 1)

  await query('UPDATE subscriptions SET razorpay_payment_id=?, status=?, starts_at=NOW(), expires_at=? WHERE razorpay_order_id=?',
    [paymentId, 'active', expires, orderId])
  await query('UPDATE users SET plan=?, plan_expires_at=? WHERE id=?', [plan, expires, userId])

  // Fetch user details for invoice
  const users = await query<{ name: string; email: string }[]>(
    'SELECT name, email FROM users WHERE id = ?', [userId]
  )
  const user = users[0]

  if (user) {
    const planData  = PLANS[plan]
    const isAnnual  = cycle === 'annual'
    const amount    = Math.round((isAnnual ? planData.annual : planData.monthly) / 100)
    const planName  = `${planData.name} Plan`
    const cycleLabel = isAnnual ? 'Annual' : 'Monthly'
    const dateStr   = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const validStr  = expires.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    // Fire-and-forget: generate PDF and send email
    generateInvoicePdf({
      orderId, paymentId,
      userName:   user.name,
      userEmail:  user.email,
      planName,
      cycleLabel,
      amount,
      date:       dateStr,
      validUntil: validStr,
      status:     'paid',
    }).then(pdf =>
      sendMail(
        user.email,
        `LeadFrog: Payment confirmed — ${planName} (${cycleLabel})`,
        emailTemplate('Payment Confirmed ✓', `
          <p>Hi ${user.name},</p>
          <p>Thank you! Your payment has been received and your LeadFrog subscription is now active.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
            <tr style="border-bottom:1px solid #E2E8F0;">
              <td style="padding:10px 0;color:#94A3B8;">Plan</td>
              <td style="padding:10px 0;color:#0F172A;text-align:right;font-weight:600;">${planName} — ${cycleLabel}</td>
            </tr>
            <tr style="border-bottom:1px solid #E2E8F0;">
              <td style="padding:10px 0;color:#94A3B8;">Order ID</td>
              <td style="padding:10px 0;color:#0F172A;text-align:right;font-family:monospace;font-size:12px;">${orderId}</td>
            </tr>
            <tr style="border-bottom:1px solid #E2E8F0;">
              <td style="padding:10px 0;color:#94A3B8;">Valid Until</td>
              <td style="padding:10px 0;color:#0F172A;text-align:right;font-weight:600;">${validStr}</td>
            </tr>
            <tr>
              <td style="padding:14px 0;color:#94A3B8;font-weight:600;font-size:15px;">Amount Paid</td>
              <td style="padding:14px 0;color:#16A34A;font-weight:700;font-size:20px;text-align:right;">₹${amount.toLocaleString('en-IN')}</td>
            </tr>
          </table>
          <p>Your PDF invoice is attached. You can also view all invoices on your <a href="https://leadfrog.digitalfoxz.com/dashboard/billing" style="color:#16A34A;font-weight:600;">billing page</a>.</p>
          <p style="margin-top:24px;">Start scraping leads now →<br><a href="https://leadfrog.digitalfoxz.com/dashboard" style="color:#16A34A;font-weight:600;">leadfrog.digitalfoxz.com/dashboard</a></p>
        `),
        [{ filename: `LeadFrog-Invoice-${orderId}.pdf`, content: pdf, contentType: 'application/pdf' }]
      )
    ).catch(() => {}) // never block the response
  }

  return NextResponse.json({ success: true })
}

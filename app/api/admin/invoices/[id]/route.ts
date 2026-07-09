import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { sendMail } from '@/lib/mailer'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string }).role !== 'admin') return null
  return session
}

function invoiceNumber(id: number, createdAt: string) {
  const d = new Date(createdAt)
  return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id}`
}

function invoiceHtml(inv: {
  id: number; plan: string; amount: number; status: string; created_at: string
  starts_at: string | null; expires_at: string | null
  razorpay_payment_id: string | null; razorpay_order_id: string | null
  user_name: string; user_email: string
}) {
  const num = invoiceNumber(inv.id, inv.created_at)
  const amt = Math.round(inv.amount / 100)
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const statusColor = inv.status === 'active' || inv.status === 'paid' ? '#16A34A' : inv.status === 'pending' ? '#D97706' : '#DC2626'
  const planLabel = inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${num} — LeadFrog Invoice</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #F8FAFC; color: #0F172A; padding: 40px 20px; }
    .page { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #050A06; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; }
    .brand { color: #A3E635; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .brand span { color: #4B6856; font-size: 12px; font-weight: 400; display: block; margin-top: 2px; }
    .inv-badge { text-align: right; }
    .inv-badge .num { color: #fff; font-size: 14px; font-weight: 700; }
    .inv-badge .date { color: #4B6856; font-size: 12px; margin-top: 4px; }
    .body { padding: 40px; }
    .row2 { display: flex; gap: 40px; margin-bottom: 36px; }
    .col { flex: 1; }
    .col h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 10px; }
    .col p { font-size: 14px; color: #0F172A; line-height: 1.7; }
    .col .muted { color: #64748B; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead tr { background: #F1F5F9; }
    thead th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; }
    tbody tr { border-bottom: 1px solid #F1F5F9; }
    tbody td { padding: 14px; font-size: 14px; color: #0F172A; }
    .total-row { background: #F0FDF4; }
    .total-row td { font-weight: 700; font-size: 15px; color: #15803D; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; color: ${statusColor}; background: ${statusColor}18; }
    .ref { background: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 28px; }
    .ref h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 8px; }
    .ref p { font-size: 12px; color: #64748B; font-family: monospace; }
    .footer { border-top: 1px solid #E2E8F0; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
    .footer p { font-size: 11px; color: #94A3B8; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:700px;margin:0 auto 16px;display:flex;gap:8px;justify-content:flex-end;">
    <button onclick="window.print()" style="padding:8px 18px;background:#A3E635;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">Download / Print</button>
  </div>
  <div class="page">
    <div class="header">
      <div class="brand">LeadFrog<span>Lead Intelligence Platform</span></div>
      <div class="inv-badge">
        <div class="num">${num}</div>
        <div class="date">Date: ${fmt(inv.created_at)}</div>
        <div style="margin-top:6px;"><span class="status-badge">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></div>
      </div>
    </div>
    <div class="body">
      <div class="row2">
        <div class="col">
          <h4>From</h4>
          <p><strong>LeadFrog</strong><br>
          <span class="muted">Lead Intelligence Platform<br>leadfrog.in</span></p>
        </div>
        <div class="col">
          <h4>Bill To</h4>
          <p><strong>${inv.user_name}</strong><br>
          <span class="muted">${inv.user_email}</span></p>
        </div>
        <div class="col">
          <h4>Period</h4>
          <p><span class="muted">Start: </span>${fmt(inv.starts_at)}<br>
          <span class="muted">Expires: </span>${fmt(inv.expires_at)}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Plan</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>LeadFrog ${planLabel} Plan — Monthly Subscription</td>
            <td><span style="background:#F0FDF4;color:#15803D;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;">${planLabel}</span></td>
            <td style="text-align:right;font-weight:600;">₹${amt.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2" style="text-align:right;padding:14px;">Total</td>
            <td style="text-align:right;padding:14px;">₹${amt.toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>

      ${inv.razorpay_payment_id || inv.razorpay_order_id ? `
      <div class="ref">
        <h4>Payment Reference</h4>
        ${inv.razorpay_payment_id ? `<p>Payment ID: ${inv.razorpay_payment_id}</p>` : ''}
        ${inv.razorpay_order_id ? `<p>Order ID: ${inv.razorpay_order_id}</p>` : ''}
      </div>` : ''}

      <p style="font-size:12px;color:#94A3B8;">Thank you for your business. For any billing queries, contact us at support@leadfrog.in</p>
    </div>
    <div class="footer">
      <p>LeadFrog &middot; leadfrog.in</p>
      <p>${num} &middot; Generated ${fmt(new Date().toISOString())}</p>
    </div>
  </div>
</body>
</html>`
}

// GET — view invoice as HTML
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await query<{
    id: number; plan: string; amount: number; status: string; created_at: string
    starts_at: string | null; expires_at: string | null
    razorpay_payment_id: string | null; razorpay_order_id: string | null
    user_name: string; user_email: string
  }[]>(
    `SELECT s.id, s.plan, s.amount, s.status, s.created_at, s.starts_at, s.expires_at,
            s.razorpay_payment_id, s.razorpay_order_id, u.name as user_name, u.email as user_email
     FROM subscriptions s JOIN users u ON s.user_id = u.id WHERE s.id = ?`,
    [params.id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new Response(invoiceHtml(rows[0]), { headers: { 'Content-Type': 'text/html' } })
}

// POST — send invoice email to client
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await query<{
    id: number; plan: string; amount: number; status: string; created_at: string
    starts_at: string | null; expires_at: string | null
    razorpay_payment_id: string | null; razorpay_order_id: string | null
    user_name: string; user_email: string
  }[]>(
    `SELECT s.id, s.plan, s.amount, s.status, s.created_at, s.starts_at, s.expires_at,
            s.razorpay_payment_id, s.razorpay_order_id, u.name as user_name, u.email as user_email
     FROM subscriptions s JOIN users u ON s.user_id = u.id WHERE s.id = ?`,
    [params.id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const inv = rows[0]
  const num = invoiceNumber(inv.id, inv.created_at)
  const amt = Math.round(inv.amount / 100)
  const planLabel = inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)

  const html = `
    <p>Hi ${inv.user_name},</p>
    <p>Please find your invoice <strong>${num}</strong> for your LeadFrog ${planLabel} Plan subscription.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
      <tr style="background:#F8FAFC;">
        <td style="padding:12px 16px;font-size:12px;color:#64748B;font-weight:600;">INVOICE</td>
        <td style="padding:12px 16px;font-size:12px;color:#64748B;font-weight:600;">PLAN</td>
        <td style="padding:12px 16px;font-size:12px;color:#64748B;font-weight:600;">AMOUNT</td>
        <td style="padding:12px 16px;font-size:12px;color:#64748B;font-weight:600;">STATUS</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:14px;font-weight:700;">${num}</td>
        <td style="padding:14px 16px;font-size:14px;">${planLabel}</td>
        <td style="padding:14px 16px;font-size:14px;font-weight:700;">₹${amt.toLocaleString('en-IN')}</td>
        <td style="padding:14px 16px;font-size:14px;color:${inv.status === 'active' ? '#16A34A' : '#D97706'};font-weight:600;">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</td>
      </tr>
    </table>
    <p style="color:#64748B;font-size:13px;">For any billing queries, reply to this email or contact us at support@leadfrog.in</p>
  `

  const { emailTemplate, sendMail: send } = await import('@/lib/mailer')
  const sent = await send(inv.user_email, `Your LeadFrog Invoice — ${num}`, emailTemplate(`Invoice ${num}`, html))

  if (!sent) return NextResponse.json({ error: 'Failed to send email — check SMTP settings' }, { status: 500 })
  return NextResponse.json({ success: true })
}

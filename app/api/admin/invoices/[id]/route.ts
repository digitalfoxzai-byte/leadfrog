import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string }).role !== 'admin') return null
  return session
}

async function getCompanySettings() {
  const rows = await query<{ key: string; value: string }[]>('SELECT `key`, `value` FROM settings').catch(() => [] as { key: string; value: string }[])
  const get = (k: string, fallback = '') => rows.find(r => r.key === k)?.value || fallback
  return {
    name:    get('company_name',    'LeadFrog'),
    email:   get('support_email',  '') || get('smtp_user', '') || get('smtp_from_email', ''),
    phone:   get('company_phone',  ''),
    address: get('company_address', ''),
  }
}

export function invoiceNumber(id: number, createdAt: string) {
  const d = new Date(createdAt)
  return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id}`
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function invoiceHtml(
  inv: {
    id: number; plan: string; amount: number; status: string; created_at: string
    starts_at: string | null; expires_at: string | null
    razorpay_payment_id: string | null; razorpay_order_id: string | null
    user_name: string; user_email: string
  },
  company: { name: string; email: string; phone: string; address: string }
) {
  const num   = invoiceNumber(inv.id, inv.created_at)
  const amt   = Math.round(inv.amount / 100)
  const fmtAmt = '₹' + amt.toLocaleString('en-IN')
  const plan  = inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)
  const isPaid = inv.status === 'active' || inv.status === 'paid'
  const statusLabel = isPaid ? 'PAID' : inv.status === 'pending' ? 'PENDING' : inv.status.toUpperCase()
  const statusColor = isPaid ? '#16A34A' : inv.status === 'pending' ? '#D97706' : '#DC2626'

  const issuedOn = fmt(inv.starts_at || inv.created_at)
  const dueDate  = fmt(inv.expires_at)

  const periodFrom = inv.starts_at ? new Date(inv.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const periodTo   = inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const addrLines = company.address.replace(/,\s*/g, ',<br>').replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${num} — Invoice</title>
  <style>
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/BaiJamjuree-Regular.woff2') format('woff2'),
           url('/fonts/BaiJamjuree-Regular.ttf') format('truetype');
      font-weight: 400; font-style: normal;
    }
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/BaiJamjuree-Medium.woff2') format('woff2');
      font-weight: 500; font-style: normal;
    }
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/BaiJamjuree-SemiBold.woff2') format('woff2');
      font-weight: 600; font-style: normal;
    }
    @font-face {
      font-family: 'Bai Jamjuree';
      src: url('/fonts/BaiJamjuree-Bold.woff2') format('woff2'),
           url('/fonts/BaiJamjuree-Bold.ttf') format('truetype');
      font-weight: 700; font-style: normal;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Bai Jamjuree', Arial, sans-serif;
      background: #F0F2F5;
      color: #1A1A2E;
      padding: 32px 16px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 720px; margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
    }

    /* ── HEADER ── */
    .header {
      background: linear-gradient(135deg, #1A1A0A 0%, #2D2400 40%, #3D1500 100%);
      padding: 32px 40px;
      display: flex;
      align-items: center;
      gap: 24px;
      position: relative;
      border-bottom: 3px solid #A3E635;
    }
    .header-logo {
      flex-shrink: 0;
    }
    .header-logo img {
      width: 64px; height: 64px;
      border-radius: 12px;
      object-fit: contain;
      background: rgba(255,255,255,0.1);
      padding: 6px;
    }
    .header-logo-text {
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 6px;
      text-align: center;
    }
    .header-title {
      flex: 1;
      text-align: center;
      color: #fff;
      font-size: 38px;
      font-weight: 700;
      letter-spacing: 12px;
      text-transform: uppercase;
    }
    .header-right {
      text-align: right;
      flex-shrink: 0;
      min-width: 180px;
    }
    .header-right .co-name {
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header-right .co-detail {
      color: rgba(255,255,255,0.65);
      font-size: 11px;
      line-height: 1.6;
    }
    .header-right .inv-label {
      color: rgba(255,255,255,0.5);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 12px;
    }
    .header-right .inv-num {
      color: #A3E635;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    /* ── SUMMARY STRIP ── */
    .summary {
      padding: 24px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #EAECEF;
    }
    .summary-amount-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8A9099;
      margin-bottom: 4px;
    }
    .summary-amount {
      font-size: 40px;
      font-weight: 700;
      color: #1A1A2E;
      letter-spacing: -1px;
    }
    .summary-amount span.rupee {
      font-size: 22px;
      font-weight: 500;
      vertical-align: super;
      margin-right: 2px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1.5px solid ${statusColor};
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 700;
      color: ${statusColor};
      letter-spacing: 0.5px;
    }
    .status-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: ${statusColor};
    }

    /* ── BILLED TO / INVOICE DETAILS ── */
    .details-row {
      display: flex;
      border-bottom: 1px solid #EAECEF;
    }
    .details-col {
      flex: 1;
      padding: 28px 40px;
    }
    .details-col:first-child {
      border-right: 1px solid #EAECEF;
    }
    .details-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8A9099;
      margin-bottom: 14px;
    }
    .billed-name {
      font-size: 15px;
      font-weight: 700;
      color: #1A1A2E;
      margin-bottom: 4px;
    }
    .billed-line {
      font-size: 13px;
      color: #6B7280;
      line-height: 1.7;
    }
    .billed-plan {
      font-size: 13px;
      font-weight: 700;
      color: #1A1A2E;
      margin-top: 8px;
    }
    .inv-details-table {
      width: 100%;
    }
    .inv-details-table tr td {
      padding: 5px 0;
      font-size: 13px;
    }
    .inv-details-table tr td:first-child {
      color: #8A9099;
      padding-right: 24px;
    }
    .inv-details-table tr td:last-child {
      color: #1A1A2E;
      font-weight: 600;
      text-align: right;
    }

    /* ── LINE ITEMS ── */
    .items-wrap {
      padding: 28px 40px;
      border-bottom: 1px solid #EAECEF;
    }
    .items-table {
      width: 100%;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      overflow: hidden;
      border-collapse: separate;
      border-spacing: 0;
    }
    .items-table thead tr {
      background: #F3F4F6;
    }
    .items-table thead th {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8A9099;
      padding: 12px 18px;
      text-align: left;
    }
    .items-table thead th:last-child { text-align: right; }
    .items-table tbody tr {
      border-top: 1px solid #E5E7EB;
    }
    .items-table tbody td {
      padding: 16px 18px;
      font-size: 14px;
      color: #1A1A2E;
      vertical-align: top;
    }
    .items-table tbody td:last-child {
      text-align: right;
      font-weight: 600;
    }
    .item-sub {
      font-size: 12px;
      color: #8A9099;
      margin-top: 3px;
    }
    .items-table tfoot tr {
      background: #F3F4F6;
      border-top: 1px solid #E5E7EB;
    }
    .items-table tfoot td {
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 700;
      color: #1A1A2E;
    }
    .items-table tfoot td:last-child {
      text-align: right;
      font-size: 18px;
    }

    /* ── FOOTER ── */
    .footer {
      background: #F9FAFB;
      padding: 22px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-left .thank {
      font-size: 14px;
      font-weight: 700;
      color: #1A1A2E;
      margin-bottom: 3px;
    }
    .footer-left .contact {
      font-size: 12px;
      color: #8A9099;
    }
    .footer-left .contact a {
      color: #C84B00;
      text-decoration: none;
      font-weight: 600;
    }
    .footer-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .footer-right img {
      width: 36px; height: 36px;
      border-radius: 8px;
      object-fit: contain;
      background: #1A1A2E;
      padding: 4px;
    }
    .footer-right .co {
      font-size: 14px;
      font-weight: 700;
      color: #1A1A2E;
    }

    /* ── PRINT ── */
    .no-print { }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:720px;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:10px;">
    <button onclick="window.print()" style="padding:9px 22px;background:#A3E635;border:none;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:0.3px;">
      Download / Print PDF
    </button>
  </div>

  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div class="header-logo">
        <img src="/logo.png" alt="${company.name}" onerror="this.style.display='none'" />
        <div class="header-logo-text">${company.name.toUpperCase()}</div>
      </div>
      <div class="header-title">I N V O I C E</div>
      <div class="header-right">
        <div class="co-name">${company.name}</div>
        <div class="co-detail">
          ${company.email ? company.email + '<br>' : ''}
          ${company.phone ? company.phone + '<br>' : ''}
          ${addrLines}
        </div>
        <div class="inv-label">INVOICE NO.</div>
        <div class="inv-num">${num}</div>
      </div>
    </div>

    <!-- SUMMARY STRIP -->
    <div class="summary">
      <div>
        <div class="summary-amount-label">Total Amount</div>
        <div class="summary-amount"><span class="rupee">₹</span>${amt.toLocaleString('en-IN')}</div>
      </div>
      <div class="status-pill">
        <span class="status-dot"></span>${statusLabel}
      </div>
    </div>

    <!-- BILLED TO / INVOICE DETAILS -->
    <div class="details-row">
      <div class="details-col">
        <div class="details-label">Billed To</div>
        <div class="billed-name">${inv.user_name}</div>
        <div class="billed-line">${inv.user_email}</div>
        <div class="billed-plan">${plan} Plan · Monthly</div>
      </div>
      <div class="details-col">
        <div class="details-label">Invoice Details</div>
        <table class="inv-details-table">
          <tr><td>Invoice No.</td><td>${num}</td></tr>
          <tr><td>Issued On</td><td>${issuedOn}</td></tr>
          <tr><td>Due Date</td><td>${dueDate}</td></tr>
        </table>
      </div>
    </div>

    <!-- LINE ITEMS -->
    <div class="items-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div>LeadFrog ${plan} Plan — Monthly Subscription</div>
              <div class="item-sub">Subscription · ${periodFrom} – ${periodTo}</div>
            </td>
            <td>${fmtAmt}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total Due</td>
            <td>${fmtAmt}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-left">
        <div class="thank">Thank you for your business!</div>
        <div class="contact">Queries? Contact <a href="mailto:${company.email}">${company.email || 'support@leadfrog.in'}</a></div>
      </div>
      <div class="footer-right">
        <img src="/logo.png" alt="${company.name}" onerror="this.style.display='none'" />
        <span class="co">${company.name}</span>
      </div>
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
  const company = await getCompanySettings()
  return new Response(invoiceHtml(rows[0], company), { headers: { 'Content-Type': 'text/html' } })
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
  const company = await getCompanySettings()
  const num = invoiceNumber(inv.id, inv.created_at)
  const amt = Math.round(inv.amount / 100)
  const plan = inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)

  const bodyHtml = `
    <p>Hi <strong>${inv.user_name}</strong>,</p>
    <p style="margin-top:12px;">Please find your invoice <strong>${num}</strong> for your LeadFrog ${plan} Plan subscription.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;border-collapse:collapse;">
      <tr style="background:#F8FAFC;">
        <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748B;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #E2E8F0;">Invoice</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748B;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #E2E8F0;">Plan</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748B;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #E2E8F0;">Amount</td>
        <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748B;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #E2E8F0;">Status</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#0F172A;">${num}</td>
        <td style="padding:14px 16px;font-size:14px;color:#0F172A;">${plan}</td>
        <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#0F172A;">₹${amt.toLocaleString('en-IN')}</td>
        <td style="padding:14px 16px;font-size:14px;font-weight:600;color:${inv.status === 'active' ? '#16A34A' : '#D97706'};">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</td>
      </tr>
    </table>
    <p style="color:#64748B;font-size:13px;">For any billing queries, contact us at <a href="mailto:${company.email}" style="color:#16A34A;">${company.email || 'support@leadfrog.in'}</a></p>
  `

  const { emailTemplate, sendMail } = await import('@/lib/mailer')
  const sent = await sendMail(inv.user_email, `Your Invoice — ${num}`, emailTemplate(`Invoice ${num}`, bodyHtml))

  if (!sent) return NextResponse.json({ error: 'Failed to send — check SMTP settings' }, { status: 500 })
  return NextResponse.json({ success: true })
}

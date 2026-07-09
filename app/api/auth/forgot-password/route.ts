import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createOtp } from '@/lib/otp'
import { sendMail, emailTemplate, escHtml } from '@/lib/mailer'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    if (!await rateLimit(`forgot:${ip}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })
    }

    const { email } = await req.json()
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const rows = await query<{ id: number; name: string }[]>(
      'SELECT id, name FROM users WHERE email = ? LIMIT 1', [email]
    )

    // Always return success — never reveal whether an email is registered
    if (rows.length > 0) {
      const code = await createOtp(email, 'reset')
      await sendMail(
        email,
        `Reset your LeadFrog password`,
        emailTemplate('Password Reset', `
          <p style="color:#0F172A;font-size:15px;">Hi ${escHtml(rows[0].name)},</p>
          <p style="color:#475569;">We received a request to reset your LeadFrog account password.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td align="center">
              <div style="display:inline-block;background:#F0FDF4;border:2px solid #16A34A;border-radius:8px;padding:16px 32px;">
                <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#15803D;font-family:Courier,monospace;">${code}</span>
              </div>
            </td></tr>
          </table>
          <p style="color:#64748B;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
          <p style="color:#94A3B8;font-size:12px;">If you did not request a password reset, please ignore this email. Your password will not change.</p>
        `)
      )
    }

    return NextResponse.json({ message: 'If that email is registered, a reset code has been sent.' })
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

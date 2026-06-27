import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createOtp } from '@/lib/otp'
import { sendMail, emailTemplate, getSmtpSettings } from '@/lib/mailer'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`send-otp:${ip}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })
    }

    const { email } = await req.json()
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const smtp = await getSmtpSettings()
    if (!smtp) {
      return NextResponse.json({ skipVerification: true })
    }

    const existing = await query<{ id: number }[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const code = await createOtp(email, 'signup')
    const sent = await sendMail(
      email,
      `LeadFrog: Your verification code is ${code}`,
      emailTemplate('Email Verification', `
        <p style="color:#0F172A;font-size:15px;">You requested a verification code to create your LeadFrog account.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr><td align="center">
            <div style="display:inline-block;background:#F0FDF4;border:2px solid #16A34A;border-radius:8px;padding:16px 32px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#15803D;font-family:Courier,monospace;">${code}</span>
            </div>
          </td></tr>
        </table>
        <p style="color:#64748B;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <p style="color:#94A3B8;font-size:12px;">If you did not request this, please ignore this email. No action is needed.</p>
      `)
    )

    if (!sent) {
      return NextResponse.json({ skipVerification: true })
    }
    return NextResponse.json({ message: 'Verification code sent' })
  } catch (err) {
    console.error('send-otp error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

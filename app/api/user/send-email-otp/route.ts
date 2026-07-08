import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { createOtp } from '@/lib/otp'
import { sendMail, emailTemplate } from '@/lib/mailer'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`email-otp:${ip}`, 3, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })
  }

  const { newEmail } = await req.json()
  if (typeof newEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const currentEmail = session.user?.email
  if (newEmail.toLowerCase() === currentEmail?.toLowerCase()) {
    return NextResponse.json({ error: 'New email must be different from current email' }, { status: 400 })
  }

  const existing = await query<{ id: number }[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [newEmail])
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Email already in use by another account' }, { status: 400 })
  }

  const code = await createOtp(newEmail, 'email_change')
  const sent = await sendMail(
    newEmail,
    `Verify your new email address`,
    emailTemplate('Email Change Verification', `
      <p style="color:#0F172A;font-size:15px;">You requested to change your LeadFrog account email to this address.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr><td align="center">
          <div style="display:inline-block;background:#F0FDF4;border:2px solid #16A34A;border-radius:8px;padding:16px 32px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#15803D;font-family:Courier,monospace;">${code}</span>
          </div>
        </td></tr>
      </table>
      <p style="color:#64748B;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <p style="color:#94A3B8;font-size:12px;">If you did not request this, please ignore this email. Your account email will not change.</p>
    `)
  )

  if (!sent) return NextResponse.json({ error: 'Failed to send verification email. Check SMTP settings.' }, { status: 500 })
  return NextResponse.json({ message: 'Verification code sent to new email' })
}

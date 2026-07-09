import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { verifyOtp } from '@/lib/otp'
import { sendMail, sendAdminMail, emailTemplate, getSmtpSettings, escHtml } from '@/lib/mailer'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`register:${ip}`, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 })
    }

    const { name, email, password, otp } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }
    if (typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'Name is too long' }, { status: 400 })
    }
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Password must be 8–128 characters' }, { status: 400 })
    }

    const existing = await query<{ id: number }[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // OTP verification — required when SMTP is configured
    const smtpConfigured = (await getSmtpSettings()) !== null
    if (smtpConfigured) {
      if (!otp) {
        return NextResponse.json({ error: 'Verification code required', needOtp: true }, { status: 400 })
      }
      const valid = await verifyOtp(email, 'signup', String(otp))
      if (!valid) {
        return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
      }
    }

    const hashed = await bcrypt.hash(password, 12)
    await query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashed])

    // Welcome email (fire-and-forget)
    sendMail(
      email,
      'Welcome to LeadFrog — Your account is ready',
      emailTemplate(`Welcome, ${escHtml(name)}!`, `
        <p>Your LeadFrog account is ready. Start scraping leads right away:</p>
        <ol style="color:#475569;font-size:14px;line-height:2;">
          <li>Log in to your <a href="https://leadfrog.digitalfoxz.com/dashboard" style="color:#16A34A;font-weight:600;">dashboard</a></li>
          <li>Enter a keyword + location in the Scraper</li>
          <li>Export your leads as CSV or Excel</li>
        </ol>
        <p>You're on the <strong>Free Trial</strong> — 50 leads to get you started. Upgrade anytime for up to 10,000 leads/month.</p>
        <p style="margin-top:24px;">
          <a href="https://leadfrog.digitalfoxz.com/dashboard" style="background:#16A34A;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block;">
            Open Dashboard
          </a>
        </p>
      `)
    ).catch(() => {})

    // Admin notification (fire-and-forget)
    sendAdminMail(
      `New signup: ${escHtml(name)}`,
      emailTemplate('New user registered', `
        <p><b>Name:</b> ${escHtml(name)}</p>
        <p><b>Email:</b> ${escHtml(email)}</p>
        <p><b>Plan:</b> Free Trial</p>
        <p><b>Time:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
      `)
    ).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { verifyOtp } from '@/lib/otp'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`reset:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 })
    }

    const { email, otp, password } = await req.json()

    if (typeof email !== 'string' || typeof otp !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Password must be 8–128 characters' }, { status: 400 })
    }

    const valid = await verifyOtp(email, 'reset', otp)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)
    await query('UPDATE users SET password = ? WHERE email = ?', [hashed, email])

    return NextResponse.json({ message: 'Password reset successfully. You can now log in.' })
  } catch (err) {
    console.error('reset-password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

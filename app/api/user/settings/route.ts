import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { verifyOtp } from '@/lib/otp'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const rows = await query<{ name: string; email: string }[]>('SELECT name, email FROM users WHERE id = ?', [userId])
  if (!rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt((session.user as { id?: string }).id || '0', 10)

  const { type, name, currentPassword, newPassword, newEmail, otp } = await req.json()

  // ── Update name ──────────────────────────────────────────────────────────
  if (type === 'name') {
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Name must be 2–100 characters' }, { status: 400 })
    }
    await query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId])
    return NextResponse.json({ success: true })
  }

  // ── Update password ───────────────────────────────────────────────────────
  if (type === 'password') {
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both passwords are required' }, { status: 400 })
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return NextResponse.json({ error: 'New password must be 8–128 characters' }, { status: 400 })
    }
    const rows = await query<{ password: string }[]>('SELECT password FROM users WHERE id = ?', [userId])
    if (!rows[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const valid = await bcrypt.compare(currentPassword, rows[0].password)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    const hashed = await bcrypt.hash(newPassword, 12)
    await query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId])
    return NextResponse.json({ success: true })
  }

  // ── Update email (requires OTP) ───────────────────────────────────────────
  if (type === 'email') {
    if (!newEmail || !otp) return NextResponse.json({ error: 'Email and verification code required' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Check not taken by another user
    const existing = await query<{ id: number }[]>('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, userId])
    if (existing.length > 0) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const valid = await verifyOtp(newEmail, 'email_change', String(otp))
    if (!valid) return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })

    await query('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId])
    return NextResponse.json({ success: true, message: 'Email updated. Please sign in again.' })
  }

  return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
}

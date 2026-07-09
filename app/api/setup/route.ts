import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, secret } = await req.json()

    // Basic protection — require setup secret. Fail closed if it isn't configured
    // so no weak default can be used to create the first admin.
    const setupSecret = process.env.SETUP_SECRET
    if (!setupSecret || secret !== setupSecret) {
      return NextResponse.json({ error: 'Invalid setup secret' }, { status: 403 })
    }

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    }

    // Check if admin already exists
    const existing = await query<{ id: number }[]>('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin'])
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Admin already exists. Use the database to manage admins.' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    await query(
      'INSERT INTO users (name, email, password, role, plan) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, 'admin', 'business']
    )

    return NextResponse.json({ success: true, message: 'Admin account created successfully' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as {role?:string}).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { currentPassword, newEmail, newPassword } = await req.json()
  if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
  if (!newEmail && !newPassword) return NextResponse.json({ error: 'Provide new email or password' }, { status: 400 })

  const users = await query<{id:number;password:string}[]>('SELECT id, password FROM users WHERE email=?', [session.user?.email])
  const user = (users[0] as unknown as {id:number;password:string})
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'Wrong current password' }, { status: 401 })

  if (newEmail) {
    const ex = await query<{id:number}[]>('SELECT id FROM users WHERE email=? AND id!=?', [newEmail, user.id])
    if ((ex as unknown[]).length > 0) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    await query('UPDATE users SET email=? WHERE id=?', [newEmail, user.id])
  }
  if (newPassword) {
    if (newPassword.length < 8) return NextResponse.json({ error: 'Password must be 8+ chars' }, { status: 400 })
    const hashed = await bcrypt.hash(newPassword, 12)
    await query('UPDATE users SET password=? WHERE id=?', [hashed, user.id])
  }
  return NextResponse.json({ success: true })
}

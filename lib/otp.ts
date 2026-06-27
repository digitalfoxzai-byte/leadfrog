import crypto from 'crypto'
import { query } from '@/lib/db'

async function ensureOtpTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS EmailOtp (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      email     VARCHAR(254) NOT NULL,
      purpose   ENUM('signup','reset','email_change') NOT NULL,
      codeHash  VARCHAR(64) NOT NULL,
      expiresAt DATETIME NOT NULL,
      attempts  INT NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT NOW(),
      KEY idx_email_purpose (email, purpose)
    )
  `)
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function createOtp(email: string, purpose: 'signup' | 'reset' | 'email_change'): Promise<string> {
  await ensureOtpTable()
  const code = String(crypto.randomInt(100000, 1000000))
  await query('DELETE FROM EmailOtp WHERE email = ? AND purpose = ?', [email, purpose])
  await query(
    'INSERT INTO EmailOtp (email, purpose, codeHash, expiresAt) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
    [email, purpose, hashCode(code)]
  )
  return code
}

export async function verifyOtp(email: string, purpose: 'signup' | 'reset' | 'email_change', code: string): Promise<boolean> {
  await ensureOtpTable()
  const rows = await query<{ id: number; codeHash: string; attempts: number; expired: number }[]>(
    'SELECT id, codeHash, attempts, expiresAt < NOW() as expired FROM EmailOtp WHERE email = ? AND purpose = ? LIMIT 1',
    [email, purpose]
  )
  if (rows.length === 0) return false
  const row = rows[0]

  if (row.expired || row.attempts >= 5) {
    await query('DELETE FROM EmailOtp WHERE id = ?', [row.id])
    return false
  }

  if (row.codeHash !== hashCode(code)) {
    await query('UPDATE EmailOtp SET attempts = attempts + 1 WHERE id = ?', [row.id])
    return false
  }

  await query('DELETE FROM EmailOtp WHERE id = ?', [row.id])
  return true
}

import type { NextRequest } from 'next/server'
import { query } from '@/lib/db'

// In-memory fallback (per-process) used only if the DB limiter errors.
const buckets = new Map<string, { count: number; resetAt: number }>()

function memoryLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= max) return false
  bucket.count++
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key)
  }
}, 60_000).unref?.()

let tableReady = false
async function ensureTable() {
  if (tableReady) return
  await query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket   VARCHAR(191) PRIMARY KEY,
      count    INT NOT NULL,
      reset_at BIGINT NOT NULL
    )
  `)
  tableReady = true
}

/**
 * Shared, DB-backed rate limiter — consistent across all PM2 cluster workers
 * and durable across restarts. Falls back to per-process memory if the DB is
 * unreachable (fails open so auth flows keep working).
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const resetAt = now + windowMs
  try {
    await ensureTable()
    // Atomic upsert: reset the window if it has elapsed, otherwise increment.
    await query(
      `INSERT INTO rate_limits (bucket, count, reset_at) VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
         count    = IF(reset_at < ?, 1, count + 1),
         reset_at = IF(reset_at < ?, ?, reset_at)`,
      [key, resetAt, now, now, resetAt]
    )
    const rows = await query<{ count: number }[]>(
      'SELECT count FROM rate_limits WHERE bucket = ?', [key]
    )
    return Number(rows[0]?.count || 0) <= max
  } catch {
    return memoryLimit(key, max, windowMs)
  }
}

/**
 * Trustworthy client IP. nginx overwrites X-Real-IP with the real peer address
 * on every request, so (unlike the appendable X-Forwarded-For) a client cannot
 * spoof it. Falls back to the last XFF hop, then 'unknown'.
 */
export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1] // last hop = added by our proxy
  }
  return 'unknown'
}

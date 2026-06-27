import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const BASE = 'https://maps.googleapis.com/maps/api/place'

const PLAN_LIMITS: Record<string, { leads: number; monthly: boolean; trialDays?: number }> = {
  free:     { leads: 50,    monthly: false, trialDays: 3 },
  starter:  { leads: 500,   monthly: true },
  pro:      { leads: 2000,  monthly: true },
  business: { leads: 10000, monthly: true },
}

interface PlaceResult {
  place_id: string
  name: string
  formatted_address: string
  rating?: number
  user_ratings_total?: number
  types?: string[]
}

interface PlaceDetail {
  name?: string
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  types?: string[]
}

async function textSearch(q: string, pageToken?: string): Promise<{ results: PlaceResult[]; next_page_token?: string }> {
  const params = new URLSearchParams({ key: API_KEY!, query: q })
  if (pageToken) params.set('pagetoken', pageToken)
  const res = await fetch(`${BASE}/textsearch/json?${params}`)
  return res.json()
}

async function getDetails(placeId: string): Promise<PlaceDetail> {
  const params = new URLSearchParams({
    key: API_KEY!,
    place_id: placeId,
    fields: 'name,formatted_phone_number,international_phone_number,website,formatted_address,rating,user_ratings_total,types',
  })
  const res = await fetch(`${BASE}/details/json?${params}`)
  const data = await res.json()
  return data.result || {}
}

function formatCategory(types: string[] = []): string {
  const skip = new Set(['point_of_interest', 'establishment', 'premise', 'street_address'])
  const t = types.find(x => !skip.has(x))
  if (!t) return 'Business'
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function checkPlanLimit(userId: number, role: string): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  if (role === 'admin') return { allowed: true, remaining: 9999 }

  const users = await query<{ plan: string; plan_expires_at: string | null; created_at: string }[]>(
    'SELECT plan, plan_expires_at, created_at FROM users WHERE id = ?', [userId]
  )
  const user = users[0]
  if (!user) return { allowed: false, remaining: 0, error: 'User not found' }

  const plan = user.plan || 'free'
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free

  if (plan === 'free' && limits.trialDays) {
    const trialEnd = new Date(new Date(user.created_at).getTime() + limits.trialDays * 24 * 60 * 60 * 1000)
    if (Date.now() > trialEnd.getTime()) return { allowed: false, remaining: 0, error: 'trial_expired' }
  } else if (user.plan_expires_at && Date.now() > new Date(user.plan_expires_at).getTime()) {
    return { allowed: false, remaining: 0, error: 'plan_expired' }
  }

  let leadsUsed = 0
  if (limits.monthly) {
    const rows = await query<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM leads WHERE user_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')", [userId]
    )
    leadsUsed = Number(rows[0]?.count || 0)
  } else {
    const rows = await query<{ count: number }[]>('SELECT COUNT(*) as count FROM leads WHERE user_id = ?', [userId])
    leadsUsed = Number(rows[0]?.count || 0)
  }

  const remaining = Math.max(0, limits.leads - leadsUsed)
  if (remaining === 0) return { allowed: false, remaining: 0, error: 'limit_reached' }
  return { allowed: true, remaining }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!API_KEY) return NextResponse.json({ error: 'Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to your .env file.' }, { status: 500 })

  const userId = parseInt((session.user as { id?: string }).id || '0', 10)
  const role = (session.user as { role?: string }).role || 'user'

  const { keyword, location, maxResults = 20 } = await req.json()
  if (!keyword || !location) return NextResponse.json({ error: 'keyword and location required' }, { status: 400 })

  // Server-side plan enforcement
  const planCheck = await checkPlanLimit(userId, role)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.error }, { status: 403 })
  }

  // Cap requested results to plan remaining
  const count = Math.min(Number(maxResults), 60, planCheck.remaining)
  const searchQuery = `${keyword} in ${location}`
  const collected: PlaceResult[] = []

  let pageToken: string | undefined
  for (let page = 0; page < 3 && collected.length < count; page++) {
    if (page > 0) await new Promise(r => setTimeout(r, 2000))
    const data = await textSearch(searchQuery, pageToken)
    if (data.results) collected.push(...data.results)
    pageToken = data.next_page_token
    if (!pageToken) break
  }

  const places = collected.slice(0, count)

  const BATCH = 5
  const leads = []
  for (let i = 0; i < places.length; i += BATCH) {
    const batch = places.slice(i, i + BATCH)
    const details = await Promise.all(batch.map(p => getDetails(p.place_id)))
    for (let j = 0; j < batch.length; j++) {
      const p = batch[j]
      const d = details[j]
      leads.push({
        name: d.name || p.name,
        phone: d.formatted_phone_number || d.international_phone_number || null,
        email: null,
        address: d.formatted_address || p.formatted_address,
        website: d.website || null,
        category: formatCategory(d.types || p.types),
        rating: d.rating ?? p.rating ?? null,
        reviews: d.user_ratings_total ?? p.user_ratings_total ?? 0,
        keyword,
        location,
        status: 'new',
      })
    }
  }

  return NextResponse.json({ leads, total: leads.length })
}

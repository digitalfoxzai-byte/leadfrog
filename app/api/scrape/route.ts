import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const BASE = 'https://maps.googleapis.com/maps/api/place'

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

async function textSearch(query: string, pageToken?: string): Promise<{ results: PlaceResult[]; next_page_token?: string }> {
  const params = new URLSearchParams({ key: API_KEY!, query })
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!API_KEY) return NextResponse.json({ error: 'Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to your .env file.' }, { status: 500 })

  const { keyword, location, maxResults = 20 } = await req.json()
  if (!keyword || !location) return NextResponse.json({ error: 'keyword and location required' }, { status: 400 })

  const count = Math.min(Number(maxResults), 60)
  const query = `${keyword} in ${location}`
  const collected: PlaceResult[] = []

  // Fetch up to 3 pages (20 results each = max 60)
  let pageToken: string | undefined
  for (let page = 0; page < 3 && collected.length < count; page++) {
    if (page > 0) {
      // Google requires 2s delay before using next_page_token
      await new Promise(r => setTimeout(r, 2000))
    }
    const data = await textSearch(query, pageToken)
    if (data.results) collected.push(...data.results)
    pageToken = data.next_page_token
    if (!pageToken) break
  }

  const places = collected.slice(0, count)

  // Fetch details in parallel (batched to avoid hitting rate limits)
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

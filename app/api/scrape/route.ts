import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BIZ_DB: Record<string, { names: string[]; category: string }> = {
  saloon: { category: 'Beauty & Hair', names: ['Royal Cuts Studio','Blade & Style','The Grooming Den','Sharp Edge Salon','Crown Barber Co','Fade Masters','Classic Cuts','Style Hub','The Barbershop','Prestige Cuts'] },
  salon: { category: 'Beauty & Hair', names: ['Glamour Studio','Beauty Lounge','Silk & Style','Luxe Hair Co','The Beauty Bar','Velvet Touch','Shine Salon','Aura Beauty','Glow Studio','Radiance Salon'] },
  restaurant: { category: 'Food & Dining', names: ['Spice Garden','The Urban Kitchen','Flavors Bistro','Royal Dine','Casa Bella','The Curry House','Tandoor Palace','Bites & Brews','The Grill House','Pepper & Salt'] },
  hotel: { category: 'Hospitality', names: ['Grand Stay Inn','City Comfort Hotel','The Luxe Suites','Park View Hotel','Metro Inn','Heritage Palace','The Boulevard','Skyline Residency','Elite Stays','Prestige Suites'] },
  dentist: { category: 'Dental Care', names: ['Bright Smiles Clinic','Dental Care Plus','PearlWhite Dental','City Dental Centre','The Smile Studio','Perfect Teeth','Oral Health Hub','SmileCraft','Dental Experts','Care Dental'] },
  gym: { category: 'Fitness & Wellness', names: ['Iron Forge Gym','FitLife Studio','Peak Performance','PowerHouse Gym','Body Republic','The Fitness Hub','Muscle Factory','Active Zone','FitCore','Flex Fitness'] },
  spa: { category: 'Spa & Wellness', names: ['Serenity Spa','Zen Wellness','The Bliss Spa','Tranquil Touch','Pure Relaxation','Harmony Spa','Lotus Retreat','Oasis Wellness','Soul Spa','Revive & Restore'] },
  school: { category: 'Education', names: ['Bright Minds Academy','Learning Tree School','Excel Academy','Knowledge Hub','Sunrise Institute','Future Stars School','Global Academy','Vision Institute','Premier School','Scholar Hub'] },
  clinic: { category: 'Healthcare', names: ['City Health Clinic','MedCare Centre','Wellness Clinic','LifeCare Medical','Prime Health','Family Clinic','Care Plus','Health First','MediPoint','Total Care Clinic'] },
  realestate: { category: 'Real Estate', names: ['Prime Properties','Urban Realty','Dream Homes','Landmark Estates','City Brokers','Elite Realtors','Property Hub','Home Solutions','Key Estates','Nest Finders'] },
  marketing: { category: 'Marketing & Advertising', names: ['PixelMind Agency','Digital Spark','GrowthLab','Click Boost','Social Surge','Brand Craft','Lead Matrix','Conversion Pro','Digital Edge','Scale Up Agency'] },
}

function getBizList(keyword: string) {
  const k = (keyword || '').toLowerCase().replace(/s$/, '')
  for (const [key, data] of Object.entries(BIZ_DB)) {
    if (k.includes(key) || key.includes(k)) return data
  }
  return BIZ_DB.marketing
}

const STREETS = ['MG Road','Brigade Road','Jubilee Hills','Anna Salai','FC Road','Baner Road','SV Road','Park Street','Linking Road','Residency Road']
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyword, location, maxResults = 20 } = await req.json()
  if (!keyword || !location) return NextResponse.json({ error: 'keyword and location required' }, { status: 400 })

  await new Promise(r => setTimeout(r, 1500))

  const biz = getBizList(keyword)
  const count = Math.min(Number(maxResults), 50)
  const leads = Array.from({ length: count }, (_, i) => ({
    name: biz.names[i % biz.names.length] + (i >= biz.names.length ? ` ${Math.floor(i / biz.names.length) + 1}` : ''),
    phone: `+91 ${rand(7000000000, 9999999999)}`,
    email: Math.random() > 0.4 ? `info@${biz.names[i % biz.names.length].toLowerCase().replace(/\s+/g, '')}.com` : null,
    address: `${rand(1, 200)}, ${STREETS[rand(0, STREETS.length - 1)]}, ${location}`,
    website: Math.random() > 0.5 ? `www.${biz.names[i % biz.names.length].toLowerCase().replace(/\s+/g, '')}.com` : null,
    category: biz.category,
    rating: (rand(35, 50) / 10),
    reviews: rand(10, 2500),
    keyword,
    location,
    status: 'new',
  }))

  return NextResponse.json({ leads, total: leads.length })
}

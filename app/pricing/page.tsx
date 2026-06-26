'use client'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Check, Zap } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: 0,
    leads: '100',
    color: 'border-[#122016]',
    features: ['100 leads/month', 'CSV Export', 'Basic filters', 'Community support'],
  },
  {
    name: 'Starter',
    price: 499,
    leads: '500',
    color: 'border-[#122016]',
    features: ['500 leads/month', 'CSV Export', 'Basic filters', 'Email support', 'Phone data'],
  },
  {
    name: 'Pro',
    price: 999,
    leads: '2,000',
    popular: true,
    color: 'border-[#A3E635]/40',
    features: ['2,000 leads/month', 'CSV + Excel Export', 'Advanced filters', 'Phone + Email data', 'Priority support', 'Keyword history'],
  },
  {
    name: 'Business',
    price: 2499,
    leads: '10,000',
    color: 'border-[#122016]',
    features: ['10,000 leads/month', 'All Pro features', 'Team dashboard', 'API access', 'Dedicated account manager', 'Custom integrations'],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#050A06] px-6 py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(22,101,52,0.1)_0%,_transparent_60%)] pointer-events-none" />

      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#122016]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/"><Image src="/logo.png" alt="LeadFrog" width={90} height={36} className="object-contain" /></Link>
          <div className="flex gap-3">
            <Link href="/login" className="text-sm text-[#94A3B8] hover:text-white px-4 py-2 transition-colors">Login</Link>
            <Link href="/signup" className="btn-lime text-sm px-5 py-2 rounded-xl">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto pt-16">
        <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#A3E635]/20 bg-[#A3E635]/5 text-[#A3E635] text-sm mb-6">
            <Zap size={14} /> Simple pricing, no surprises
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 font-heading">Choose your plan</h1>
          <p className="text-[#94A3B8] text-lg">All plans include a 7-day free trial. Cancel anytime.</p>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        >
          {PLANS.map(({ name, price, leads, popular, color, features }) => (
            <div key={name} className={`glass-card p-7 border ${color} relative flex flex-col ${popular ? 'ring-1 ring-[#A3E635]/30 scale-[1.02]' : ''}`}>
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#A3E635] text-[#050A06] text-xs font-bold">
                  POPULAR
                </div>
              )}
              <div className="text-[#94A3B8] text-sm mb-3 font-medium">{name}</div>
              <div className="font-heading">
                <span className="text-4xl font-bold text-white">{price === 0 ? 'Free' : `₹${price}`}</span>
                {price > 0 && <span className="text-[#4B6856] text-sm">/month</span>}
              </div>
              <div className="text-[#A3E635] text-sm mt-1 mb-6">{leads} leads/month</div>
              <ul className="space-y-3 flex-1 mb-8">
                {features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#94A3B8]">
                    <Check size={14} className="text-[#A3E635] shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`w-full py-3 rounded-xl text-sm font-semibold text-center block cursor-pointer transition-all ${popular ? 'btn-lime' : 'border border-[#122016] text-[#94A3B8] hover:border-[#A3E635]/30 hover:text-white'}`}
              >
                {price === 0 ? 'Start Free' : 'Get Started'}
              </Link>
            </div>
          ))}
        </motion.div>

        <div className="mt-16 glass-card p-8 max-w-3xl mx-auto">
          <h3 className="text-xl font-bold text-white mb-6 text-center font-heading">Frequently asked questions</h3>
          <div className="space-y-5">
            {[
              ['Can I cancel anytime?', 'Yes. Cancel with one click from your dashboard. No questions asked.'],
              ['What payment methods are accepted?', 'We accept all major credit/debit cards, UPI, and net banking via Razorpay.'],
              ['Is the data accurate?', 'Our scraper pulls live data from Google Maps — accuracy is typically 95%+.'],
              ['Can I upgrade or downgrade my plan?', 'Yes, you can change your plan at any time from the billing section.'],
            ].map(([q, a]) => (
              <div key={q} className="border-b border-[#122016] pb-5">
                <div className="text-white font-medium text-sm mb-2">{q}</div>
                <div className="text-[#94A3B8] text-sm leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

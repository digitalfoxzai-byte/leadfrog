'use client'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Database, Download, Shield, Zap, Users, ChevronRight, Star, Check } from 'lucide-react'

const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.1 } } }

const FEATURES = [
  { icon: Search, title: 'Google Maps Scraping', desc: 'Extract business leads from any city, keyword, or category in minutes.' },
  { icon: Database, title: 'Lead Management', desc: 'Organize, filter, and track all your leads in one powerful dashboard.' },
  { icon: Download, title: 'CSV / Excel Export', desc: 'Export leads instantly to CSV or Excel for your CRM or outreach tool.' },
  { icon: Zap, title: 'Real-Time Results', desc: 'Fast scraping engine delivers results in 1–5 minutes per search.' },
  { icon: Shield, title: 'Data Quality', desc: 'Each lead includes name, phone, email, website, rating, and address.' },
  { icon: Users, title: 'Team Dashboards', desc: 'Business plan supports multiple users and shared lead pools.' },
]

const TESTIMONIALS = [
  { name: 'Rahul Sharma', role: 'Digital Marketing Agency', text: 'LeadFrog saved us 20+ hours a week. We generate 500 qualified leads every day.', rating: 5 },
  { name: 'Priya Nair', role: 'Real Estate Consultant', text: 'Best lead tool we have used. The quality of data is exceptional and the price is unbeatable.', rating: 5 },
  { name: 'Arun Mehta', role: 'SaaS Founder', text: 'We closed 12 new clients in our first month using LeadFrog. Absolute game changer.', rating: 5 },
]

const PLANS = [
  { name: 'Starter', price: 499, leads: '500', color: 'border-[#122016]', features: ['500 leads/month', 'CSV Export', 'Basic filters', 'Email support'] },
  { name: 'Pro', price: 999, leads: '2,000', color: 'border-lime', popular: true, features: ['2,000 leads/month', 'CSV + Excel Export', 'Advanced filters', 'Phone + Email data', 'Priority support'] },
  { name: 'Business', price: 2499, leads: '10,000', color: 'border-[#122016]', features: ['10,000 leads/month', 'All Pro features', 'Team dashboard', 'API access', 'Dedicated support'] },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050A06] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#122016]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="LeadFrog" width={70} height={28} className="object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(163,230,53,0.3))' }} />
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#94A3B8]">
            <Link href="#features" className="hover:text-[#A3E635] transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-[#A3E635] transition-colors">Pricing</Link>
            <Link href="#testimonials" className="hover:text-[#A3E635] transition-colors">Reviews</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[#94A3B8] hover:text-white transition-colors px-4 py-2 cursor-pointer">Login</Link>
            <Link href="/signup" className="btn-lime text-sm px-5 py-2 rounded-xl">Get Started Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 px-6 overflow-hidden">
        {/* Static glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#A3E635]/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-[#166534]/20 blur-[80px] pointer-events-none" />

        {/* Floating particles */}
        {[...Array(18)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              background: i % 4 === 0 ? '#A3E635' : '#4ADE80',
              left: `${5 + (i * 17) % 90}%`,
              top: `${10 + (i * 13) % 80}%`,
              opacity: 0.25 + (i % 4) * 0.1,
            }}
            animate={{
              y: [0, -30 - (i % 3) * 15, 0],
              x: [0, (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 8), 0],
              opacity: [0.15, 0.5, 0.15],
            }}
            transition={{
              duration: 4 + (i % 5) * 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: (i * 0.4) % 3,
            }}
          />
        ))}

        {/* Animated grid lines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(163,230,53,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <motion.div
          className="relative text-center max-w-4xl mx-auto"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#A3E635]/20 bg-[#A3E635]/5 text-[#A3E635] text-sm font-medium mb-8">
            <Zap size={14} /> New: Real Google Maps Scraping coming soon
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="text-white">Find Business Leads</span>
            <br />
            <span className="bg-gradient-to-r from-[#A3E635] to-[#4ADE80] bg-clip-text text-transparent">10x Faster</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-xl text-[#94A3B8] max-w-2xl mx-auto mb-10 leading-relaxed">
            LeadFrog scrapes Google Maps to deliver verified business leads — name, phone, email, website, rating — in minutes. No manual searching. Ever.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="btn-lime px-8 py-4 rounded-2xl text-base flex items-center gap-2 justify-center">
              Start Scraping Free <ChevronRight size={18} />
            </Link>
            <Link href="/dashboard" className="px-8 py-4 rounded-2xl border border-[#122016] text-[#94A3B8] hover:border-[#A3E635]/30 hover:text-white transition-all text-base flex items-center gap-2 justify-center cursor-pointer">
              View Dashboard
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-12 flex items-center justify-center gap-8 text-sm text-[#4B6856]">
            <span className="flex items-center gap-2"><Check size={14} className="text-[#A3E635]" /> No credit card required</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-[#A3E635]" /> Free plan included</span>
            <span className="flex items-center gap-2"><Check size={14} className="text-[#A3E635]" /> Cancel anytime</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-[#122016]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[['50,000+', 'Leads Scraped'], ['2,400+', 'Active Users'], ['99.2%', 'Data Accuracy'], ['< 5 min', 'Per Scrape']].map(([val, label]) => (
            <motion.div key={label} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
              <div className="text-3xl font-bold bg-gradient-to-r from-[#A3E635] to-[#4ADE80] bg-clip-text text-transparent font-heading">{val}</div>
              <div className="text-sm text-[#4B6856] mt-1">{label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything you need to <span className="text-[#A3E635]">close more deals</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
              From scraping to export, LeadFrog handles the entire lead generation workflow.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
          >
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="glass-card p-6 group hover:border-[#A3E635]/20 transition-all duration-300 cursor-default">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A1F0C] to-[#0D2E10] flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_rgba(163,230,53,0.2)] transition-all">
                  <Icon size={22} className="text-[#A3E635]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-heading">{title}</h3>
                <p className="text-[#94A3B8] text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-6 border-t border-[#122016]">
        <div className="max-w-7xl mx-auto">
          <motion.h2 className="text-4xl font-bold text-center text-white mb-4" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            Trusted by growth teams
          </motion.h2>
          <motion.p className="text-center text-[#94A3B8] mb-16" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            See what our customers are saying about LeadFrog
          </motion.p>
          <motion.div className="grid md:grid-cols-3 gap-6" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            {TESTIMONIALS.map(({ name, role, text, rating }) => (
              <motion.div key={name} variants={fadeUp} className="glass-card p-6">
                <div className="flex gap-1 mb-4">
                  {Array(rating).fill(0).map((_, i) => <Star key={i} size={16} className="text-[#A3E635] fill-[#A3E635]" />)}
                </div>
                <p className="text-[#94A3B8] text-sm leading-relaxed mb-6 italic">&ldquo;{text}&rdquo;</p>
                <div>
                  <div className="text-white font-semibold text-sm">{name}</div>
                  <div className="text-[#4B6856] text-xs">{role}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-[#122016]">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-4">Simple, transparent pricing</motion.h2>
            <motion.p variants={fadeUp} className="text-[#94A3B8]">Start free. Scale as you grow.</motion.p>
          </motion.div>

          <motion.div className="grid md:grid-cols-3 gap-6" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            {PLANS.map(({ name, price, leads, color, popular, features }) => (
              <motion.div key={name} variants={fadeUp}
                className={`glass-card p-8 border ${color} relative ${popular ? 'ring-1 ring-[#A3E635]/30 scale-105' : ''}`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#A3E635] text-[#050A06] text-xs font-bold">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-[#94A3B8] text-sm mb-2">{name}</div>
                <div className="text-4xl font-bold text-white mb-1 font-heading">₹{price}<span className="text-lg font-normal text-[#4B6856]">/mo</span></div>
                <div className="text-[#A3E635] text-sm mb-6">{leads} leads/month</div>
                <ul className="space-y-3 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                      <Check size={14} className="text-[#A3E635] shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center cursor-pointer transition-all ${popular ? 'btn-lime' : 'border border-[#122016] text-[#94A3B8] hover:border-[#A3E635]/30 hover:text-white'}`}>
                  Get Started
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-[#122016]">
        <motion.div className="max-w-3xl mx-auto text-center" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to find your next <span className="text-[#A3E635]">1,000 leads?</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[#94A3B8] mb-10 text-lg">
            Join thousands of businesses using LeadFrog to generate leads on autopilot.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link href="/signup" className="btn-lime inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-lg">
              Start Free Today <ChevronRight size={20} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#122016] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#4B6856]">
          <Image src="/logo.png" alt="LeadFrog" width={80} height={32} className="object-contain opacity-70" />
          <span>© {new Date().getFullYear()} LeadFrog. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-[#A3E635] transition-colors">Login</Link>
            <Link href="/pricing" className="hover:text-[#A3E635] transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

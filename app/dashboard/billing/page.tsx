'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Users, CreditCard, RefreshCw, Calendar, ChevronDown, ChevronUp,
  CheckCircle, Zap, Crown, Shield, Eye, LogOut, Settings,
  TrendingUp, Target, Loader2,
} from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any

const ease = [0.32, 0.72, 0, 1] as [number, number, number, number]

const PLANS = {
  monthly: [
    {
      key: 'free', name: 'Free Trial', price: 0, icon: Shield, color: '#4B6856',
      border: 'border-[var(--ds-bd1)]',
      desc: 'Try LeadFrog free for 3 days.',
      features: ['50 leads total', 'Google Maps scraping', 'CSV export', 'Basic filters', 'Standard support'],
    },
    {
      key: 'starter', name: 'Starter', price: 499, icon: Zap, color: '#4ADE80',
      border: 'border-[#4ADE80]/25',
      desc: 'For freelancers and small teams.',
      features: ['500 leads / month', 'Google Maps scraping', 'CSV + JSON export', 'Advanced filters', 'Email support'],
    },
    {
      key: 'pro', name: 'Pro', price: 999, icon: Zap, color: '#A3E635', badge: 'Most Popular',
      border: 'border-[#A3E635]/30',
      desc: 'For agencies and growing businesses.',
      features: ['2,000 leads / month', 'Google Maps scraping', 'CSV + JSON export', 'Bulk actions', 'Priority support', 'Keyword history'],
      extra: '+2 more',
    },
    {
      key: 'business', name: 'Business', price: 2499, icon: Crown, color: '#A855F7',
      border: 'border-purple-500/25',
      desc: 'For large teams and enterprises.',
      features: ['10,000 leads / month', 'All Pro features', 'API access', 'Dedicated manager', '24/7 support'],
      extra: '+4 more',
    },
  ],
  annual: [
    {
      key: 'free', name: 'Free Trial', price: 0, icon: Shield, color: '#4B6856',
      border: 'border-[var(--ds-bd1)]',
      desc: 'Try LeadFrog free for 3 days.',
      features: ['50 leads total', 'Google Maps scraping', 'CSV export', 'Basic filters', 'Standard support'],
    },
    {
      key: 'starter', name: 'Starter', price: 399, icon: Zap, color: '#4ADE80',
      border: 'border-[#4ADE80]/25',
      desc: 'For freelancers and small teams.',
      features: ['500 leads / month', 'Google Maps scraping', 'CSV + JSON export', 'Advanced filters', 'Email support'],
    },
    {
      key: 'pro', name: 'Pro', price: 799, icon: Zap, color: '#A3E635', badge: 'Most Popular',
      border: 'border-[#A3E635]/30',
      desc: 'For agencies and growing businesses.',
      features: ['2,000 leads / month', 'Google Maps scraping', 'CSV + JSON export', 'Bulk actions', 'Priority support', 'Keyword history'],
      extra: '+2 more',
    },
    {
      key: 'business', name: 'Business', price: 1999, icon: Crown, color: '#A855F7',
      border: 'border-purple-500/25',
      desc: 'For large teams and enterprises.',
      features: ['10,000 leads / month', 'All Pro features', 'API access', 'Dedicated manager', '24/7 support'],
      extra: '+4 more',
    },
  ],
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free Trial', starter: 'Starter Plan', pro: 'Pro Plan', business: 'Business Plan',
}

interface UsageData {
  plan: string; label: string; status: string; isActive: boolean
  planStarted: string; nextBilling: string
  leadsUsed: number; leadsLimit: number; leadsRemaining: number
  percentUsed: number; daysLeft: number; name: string
}

interface Invoice {
  id: number; orderId: string; paymentId: string | null
  plan: string; amount: number; status: string; date: string; due: string; cycle: string
}

function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [usage, setUsage]         = useState<UsageData | null>(null)
  const [invoices, setInvoices]   = useState<Invoice[]>([])
  const [loading, setLoading]     = useState(true)
  const [expandedInv, setExpandedInv] = useState<number | null>(null)
  const [paying, setPaying]       = useState<string | null>(null)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, iRes] = await Promise.all([
        fetch('/api/billing/usage'),
        fetch('/api/billing/invoices'),
      ])
      if (uRes.ok) setUsage(await uRes.json())
      if (iRes.ok) setInvoices(await iRes.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') router.push('/admin')
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated') fetchData()
  }, [status, fetchData])

  const currentPlan    = usage?.plan || 'free'
  const plans          = PLANS[cycle]
  const currentPlanDef = plans.find(p => p.key === currentPlan) || plans[0]

  const handleUpgrade = async (planKey: string) => {
    if (planKey === 'free') return
    setPaying(planKey)
    try {
      const ok = await loadRazorpay()
      if (!ok) { showToast('Failed to load payment gateway.', false); setPaying(null); return }

      const res = await fetch('/api/payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, cycle }),
      })
      const { orderId, keyId, amount, planName, error } = await res.json()
      if (error) { showToast(error, false); setPaying(null); return }

      new window.Razorpay({
        key: keyId, order_id: orderId, amount, currency: 'INR',
        name: 'LeadFrog', description: planName,
        prefill: { email: session?.user?.email || '', name: usage?.name || '' },
        theme: { color: '#A3E635' },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch('/api/payment', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature, plan: planKey, cycle }),
          })
          if (verifyRes.ok) {
            showToast(`Upgraded to ${planName}! Dashboard is now active.`)
            await fetchData()
          } else {
            showToast('Payment verification failed. Contact support.', false)
          }
          setPaying(null)
        },
        modal: { ondismiss: () => setPaying(null) },
      }).open()
    } catch {
      showToast('Something went wrong. Please try again.', false)
      setPaying(null)
    }
  }

  const handlePayInvoice = async (inv: Invoice) => {
    setPaying(`inv-${inv.id}`)
    try {
      const ok = await loadRazorpay()
      if (!ok) { showToast('Failed to load payment gateway.', false); setPaying(null); return }

      const res = await fetch('/api/payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: inv.plan, cycle: inv.cycle === 'Annual' ? 'annual' : 'monthly' }),
      })
      const { orderId, keyId, amount, planName, error } = await res.json()
      if (error) { showToast(error, false); setPaying(null); return }

      new window.Razorpay({
        key: keyId, order_id: orderId, amount, currency: 'INR',
        name: 'LeadFrog', description: `Invoice – ${planName}`,
        prefill: { email: session?.user?.email || '', name: usage?.name || '' },
        theme: { color: '#A3E635' },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          await fetch('/api/payment', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature, plan: inv.plan, cycle: inv.cycle === 'Annual' ? 'annual' : 'monthly' }),
          })
          showToast('Payment successful!')
          await fetchData()
          setPaying(null)
        },
        modal: { ondismiss: () => setPaying(null) },
      }).open()
    } catch {
      showToast('Something went wrong.', false)
      setPaying(null)
    }
  }

  if (status === 'unauthenticated') return null

  const usageStats = [
    {
      label: 'Leads Used', sublabel: currentPlan === 'free' ? 'Trial Total' : 'This Month',
      value: String(usage?.leadsUsed ?? 0),
      max: String(usage?.leadsLimit ?? 50),
      icon: TrendingUp, color: 'text-[#4ADE80]',
      pct: usage?.percentUsed ?? 0,
    },
    {
      label: 'Leads Left', sublabel: 'Remaining',
      value: usage?.leadsLimit === -1 ? '∞' : String(usage?.leadsRemaining ?? 0),
      max: String(usage?.leadsLimit ?? 50),
      icon: Target, color: 'text-[#A3E635]',
      pct: 100 - (usage?.percentUsed ?? 0),
    },
    {
      label: 'Scraper', sublabel: 'Tool Access',
      value: usage?.isActive ? 'Active' : 'Blocked',
      icon: Search, color: usage?.isActive ? 'text-emerald-400' : 'text-red-400',
      included: true,
      includedColor: usage?.isActive ? '#4ADE80' : '#ef4444',
    },
    {
      label: 'Lead Limit', sublabel: currentPlan === 'free' ? 'Trial Cap' : 'Per Month',
      value: usage?.leadsLimit === -1 ? '∞' : String(usage?.leadsLimit ?? 50),
      icon: Users, color: 'text-purple-400',
      included: true,
      includedColor: '#A855F7',
    },
  ]

  return (
    <div className="flex h-screen bg-[var(--ds-bg0)] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-[var(--ds-bd1)] bg-[var(--ds-bg1)]">
        <div className="p-4 border-b border-[var(--ds-bd1)] flex flex-col items-center gap-1.5">
          <Image src="/logo.png" alt="LeadFrog" width={110} height={44} className="object-contain" />
          <span className="text-[8px] text-[var(--ds-muted)] tracking-[2px] uppercase">Lead Intelligence</span>
        </div>
        <nav className="flex-1 p-3 text-sm overflow-hidden">
          <div className="text-[9px] text-[var(--ds-muted)] uppercase tracking-[2.5px] px-3 py-2 font-semibold">Workspace</div>
          {[
            { label: 'Scraper',   icon: Search, href: '/dashboard' },
            { label: 'All Leads', icon: Users,  href: '/dashboard?view=leads' },
          ].map(({ label, icon: Icon, href }) => (
            <button key={label} onClick={() => router.push(href)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer border-l-2 border-transparent text-[var(--ds-muted)] hover:text-[var(--ds-dim)] hover:bg-white/[0.03] transition-all text-[13.5px] font-medium">
              <Icon size={14} /> {label}
            </button>
          ))}
          <div className="h-px bg-[var(--ds-bd1)] my-2" />
          <div className="text-[9px] text-[var(--ds-muted)] uppercase tracking-[2.5px] px-3 py-2 font-semibold">Account</div>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer border-l-2 border-[#A3E635] bg-[var(--ds-active-bg)] text-[#A3E635] text-[13.5px] font-medium">
            <CreditCard size={14} /> Billing
          </button>
          <button onClick={() => router.push('/dashboard/settings')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer border-l-2 border-transparent text-[var(--ds-muted)] hover:text-[var(--ds-dim)] hover:bg-white/[0.03] transition-all text-[13.5px] font-medium">
            <Settings size={14} /> Settings
          </button>
        </nav>
        <div className="p-3 space-y-1 text-sm border-t border-[var(--ds-bd1)]">
          {(session?.user as { role?: string })?.role === 'admin' && (
            <button onClick={() => router.push('/admin')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--ds-muted)] hover:text-[#A3E635] hover:bg-white/[0.03] text-left cursor-pointer text-[13.5px]">
              <Settings size={14} /> Admin
            </button>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--ds-muted)] hover:text-red-400 hover:bg-white/[0.03] text-left cursor-pointer text-[13.5px]">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto scrollbar-dark">
        {(status === 'loading' || loading) ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={30} className="animate-spin text-[#4ADE80]" />
          </div>
        ) : (
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--ds-text)] mb-1">Billing &amp; Subscription</h1>
              <p className="text-[var(--ds-muted)] text-sm">Manage your plan, view invoices, and upgrade anytime</p>
            </div>
            <button onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--ds-bg2)] border border-[var(--ds-bd1)] text-[var(--ds-muted)] hover:text-[var(--ds-text)] transition-all text-sm cursor-pointer">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Current Plan Card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
            className="bg-[var(--ds-bg2)] border border-[var(--ds-bd1)] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
              style={{ background: `linear-gradient(to right, ${currentPlanDef.color}, transparent)` }} />
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${currentPlanDef.color}18`, border: `1px solid ${currentPlanDef.color}35` }}>
                  <currentPlanDef.icon size={22} style={{ color: currentPlanDef.color }} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[var(--ds-muted)] uppercase tracking-widest mb-0.5">Current Plan</div>
                  <div className="text-xl font-bold text-[var(--ds-text)]">{PLAN_LABEL[currentPlan] || currentPlan}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${usage?.isActive ? 'bg-[#4ADE80] animate-pulse' : 'bg-red-400'}`} />
                    <span className={`text-xs font-semibold ${usage?.isActive ? 'text-[#4ADE80]' : 'text-red-400'}`}>{usage?.status || 'Active'}</span>
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-[var(--ds-muted)] space-y-2">
                <div className="flex items-center gap-2 justify-end">
                  <Calendar size={13} className="text-[var(--ds-muted)]" />
                  Plan started <span className="text-[var(--ds-text)] font-medium ml-1">{usage?.planStarted || '—'}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <RefreshCw size={13} className="text-[var(--ds-muted)]" />
                  {currentPlan === 'free' ? 'Trial ends' : 'Next billing'} <span className="text-[var(--ds-text)] font-medium ml-1">{usage?.nextBilling || '—'}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Plan Usage */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06, ease }}>
            <div className="mb-4">
              <div className="font-bold text-base text-[var(--ds-text)]">Plan Usage</div>
              <div className="text-[var(--ds-muted)] text-xs mt-0.5">{PLAN_LABEL[currentPlan]} · {usage?.status || 'Active'}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {usageStats.map(stat => (
                <div key={stat.label} className="bg-[var(--ds-bg1)] border border-[var(--ds-bd1)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[10px] font-bold text-[var(--ds-muted)] uppercase tracking-wider">{stat.label}</div>
                      <div className="text-[10px] text-[var(--ds-muted)]">{stat.sublabel}</div>
                    </div>
                    <stat.icon size={15} className={stat.color} />
                  </div>
                  <div className="text-xl font-bold text-[var(--ds-text)]">{stat.value}</div>
                  {stat.included ? (
                    <div className="text-[11px] font-semibold mt-1 flex items-center gap-1" style={{ color: stat.includedColor }}>
                      <CheckCircle size={11} /> Included
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] text-[var(--ds-muted)] mt-0.5">/ {stat.max}</div>
                      <div className="w-full h-1.5 bg-[var(--ds-bg0)] rounded-full mt-2 overflow-hidden border border-[var(--ds-bg3)]">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${stat.pct ?? 0}%`,
                            background: (stat.pct ?? 0) >= 90 ? 'linear-gradient(90deg,#dc2626,#f87171)' : (stat.pct ?? 0) >= 70 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#166534,#4ADE80)',
                          }} />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Available Plans */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1, ease }}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-bold text-base text-[var(--ds-text)]">Available Plans</div>
              <div className="flex items-center bg-[var(--ds-bg1)] border border-[var(--ds-bd1)] p-1 rounded-xl gap-1">
                {(['monthly', 'annual'] as const).map(c => (
                  <button key={c} onClick={() => setCycle(c)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize flex items-center gap-1.5
                      ${cycle === c ? 'bg-gradient-to-br from-[#16A34A] to-[#15803D] text-[var(--ds-text)] shadow' : 'text-[var(--ds-muted)] hover:text-[var(--ds-dim)]'}`}>
                    {c}
                    {c === 'annual' && (
                      <span className="bg-amber-400/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-amber-400/20">-20%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {plans.map((plan, i) => {
                const isCurrent = plan.key === currentPlan
                const isPopular = plan.badge === 'Most Popular'
                const isLoading = paying === plan.key
                return (
                  <motion.div key={`${plan.key}-${cycle}`}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05, ease }}
                    className={`relative bg-[var(--ds-bg1)] border rounded-2xl flex flex-col pt-8 px-5 pb-5 ${plan.border}`}
                    style={isPopular ? { boxShadow: `0 0 24px ${plan.color}12` } : {}}>

                    {isPopular ? (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-[#A3E635] text-[#050A06] text-[10px] font-extrabold px-3 py-1 rounded-full whitespace-nowrap">Most Popular</span>
                      </div>
                    ) : <div className="h-0" />}

                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${plan.color}12`, border: `1px solid ${plan.color}28` }}>
                        <plan.icon size={16} style={{ color: plan.color }} />
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-[var(--ds-text)]">{plan.name}</div>
                        <div className="text-[var(--ds-muted)] text-[10px] leading-tight">{plan.desc}</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      {plan.price === 0 ? (
                        <span className="text-2xl font-bold text-[var(--ds-text)]">Free</span>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className="text-2xl font-bold text-[var(--ds-text)]">₹{plan.price.toLocaleString()}</span>
                          <span className="text-[var(--ds-muted)] text-xs mb-1">/mo</span>
                        </div>
                      )}
                      {cycle === 'annual' && plan.price > 0 && (
                        <div className="text-[10px] text-amber-400 font-semibold mt-0.5">₹{(plan.price * 12).toLocaleString()}/yr billed annually</div>
                      )}
                    </div>

                    <ul className="space-y-1.5 flex-1 mb-4">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs text-[var(--ds-dim)]">
                          <CheckCircle size={11} style={{ color: plan.color }} className="flex-shrink-0" /> {f}
                        </li>
                      ))}
                      {'extra' in plan && plan.extra && (
                        <li className="text-[10px] text-[var(--ds-muted)] pl-4">{plan.extra}</li>
                      )}
                    </ul>

                    {isCurrent ? (
                      <div className="w-full py-2 rounded-xl text-center text-xs font-bold border"
                        style={{ color: plan.color, borderColor: `${plan.color}28`, backgroundColor: `${plan.color}0A` }}>
                        ✓ Current Plan
                      </div>
                    ) : plan.price === 0 ? (
                      <div className="w-full py-2 rounded-xl text-center text-xs font-semibold text-[var(--ds-muted)] border border-[var(--ds-bd1)] cursor-not-allowed">
                        Downgrade
                      </div>
                    ) : (
                      <motion.button
                        onClick={() => handleUpgrade(plan.key)}
                        disabled={!!paying}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="w-full py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={isPopular
                          ? { background: 'linear-gradient(135deg,#16A34A,#15803D)', color: '#fff', boxShadow: '0 4px 14px rgba(163,230,53,0.2)' }
                          : { border: `1px solid ${plan.color}28`, color: plan.color, backgroundColor: `${plan.color}08` }
                        }>
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                        {isLoading ? 'Processing…' : `↗ Upgrade to ${plan.name}`}
                      </motion.button>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Invoices */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14, ease }}>
            <div className="flex items-center gap-2 mb-4 font-bold text-base text-[var(--ds-text)]">
              <CreditCard size={16} className="text-[#4ADE80]" /> Invoices
            </div>
            {invoices.length === 0 ? (
              <div className="bg-[var(--ds-bg1)] border border-[var(--ds-bd1)] rounded-2xl p-10 text-center text-[var(--ds-muted)] text-sm">
                No invoices yet. Invoices appear here after your first payment.
              </div>
            ) : (
              <div className="bg-[var(--ds-bg1)] border border-[var(--ds-bd1)] rounded-2xl overflow-hidden">
                {invoices.map((inv, i) => (
                  <div key={inv.id}>
                    <div
                      className={`flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors
                        ${i < invoices.length - 1 ? 'border-b border-[var(--ds-bg3)]' : ''}`}
                      onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle size={14} className="text-[#4ADE80]" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--ds-text)]">{inv.orderId}</div>
                          <div className="text-xs text-[var(--ds-muted)]">Due: {inv.due} · {PLAN_LABEL[inv.plan] || inv.plan} · {inv.cycle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-bold text-[var(--ds-text)]">₹{Number(inv.amount).toLocaleString()}</div>
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 w-fit ml-auto
                            ${inv.status === 'paid'    ? 'text-[#4ADE80] bg-[#4ADE80]/10'
                            : inv.status === 'pending' ? 'text-amber-400 bg-amber-400/10'
                            : 'text-red-400 bg-red-400/10'}`}>
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </div>
                        </div>
                        {inv.status === 'pending' && (
                          <button
                            onClick={e => { e.stopPropagation(); handlePayInvoice(inv) }}
                            disabled={paying === `inv-${inv.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 btn-lime text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60 flex-shrink-0">
                            {paying === `inv-${inv.id}` ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
                            Pay
                          </button>
                        )}
                        <div className="flex gap-2 text-[var(--ds-muted)]">
                          <button onClick={e => e.stopPropagation()} className="hover:text-[var(--ds-text)] transition-colors cursor-pointer">
                            <Eye size={14} />
                          </button>
                          {expandedInv === inv.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>
                    <AnimatePresence>
                      {expandedInv === inv.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease }}
                          className="overflow-hidden border-t border-[var(--ds-bg3)] bg-[var(--ds-bg0)]">
                          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><div className="text-[var(--ds-muted)] text-[10px] mb-1 uppercase tracking-wide">Invoice Date</div><div className="font-medium text-[var(--ds-text)]">{inv.date}</div></div>
                            <div><div className="text-[var(--ds-muted)] text-[10px] mb-1 uppercase tracking-wide">Plan</div><div className="font-medium text-[var(--ds-text)]">{PLAN_LABEL[inv.plan] || inv.plan}</div></div>
                            <div><div className="text-[var(--ds-muted)] text-[10px] mb-1 uppercase tracking-wide">Payment ID</div><div className="font-medium text-xs text-[var(--ds-dim)] truncate">{inv.paymentId || '—'}</div></div>
                            <div><div className="text-[var(--ds-muted)] text-[10px] mb-1 uppercase tracking-wide">Amount</div><div className="font-bold text-[#4ADE80]">₹{Number(inv.amount).toLocaleString()}</div></div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Payment History Table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18, ease }}>
            <div className="font-bold text-base text-[var(--ds-text)] mb-4">Payment History</div>
            {invoices.length === 0 ? (
              <div className="bg-[var(--ds-bg1)] border border-[var(--ds-bd1)] rounded-2xl p-10 text-center text-[var(--ds-muted)] text-sm">
                No payment history yet.
              </div>
            ) : (
              <div className="bg-[var(--ds-bg1)] border border-[var(--ds-bd1)] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-5 px-5 py-3 border-b border-[var(--ds-bg3)] text-[10px] font-bold text-[var(--ds-muted)] uppercase tracking-widest">
                  <div>Date</div><div>Plan</div><div>Cycle</div><div>Amount</div><div>Status</div>
                </div>
                {invoices.map((inv, i) => (
                  <div key={inv.id}
                    className={`grid grid-cols-5 px-5 py-4 text-sm items-center hover:bg-white/[0.015] transition-colors
                      ${i < invoices.length - 1 ? 'border-b border-[var(--ds-bg2)]' : ''}`}>
                    <div className="text-[var(--ds-dim)] text-xs">{inv.date}</div>
                    <div className="font-medium text-[var(--ds-text)] text-xs">{PLAN_LABEL[inv.plan] || inv.plan}</div>
                    <div className="text-[var(--ds-muted)] text-xs">{inv.cycle}</div>
                    <div className="font-bold text-[var(--ds-text)] text-xs">₹{Number(inv.amount).toLocaleString()}</div>
                    <div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 w-fit
                        ${inv.status === 'paid'    ? 'text-[#4ADE80] bg-[#4ADE80]/10'
                        : inv.status === 'pending' ? 'text-amber-400 bg-amber-400/10'
                        : 'text-red-400 bg-red-400/10'}`}>
                        {inv.status === 'paid' && <CheckCircle size={10} />}
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Footer */}
          <div className="flex items-center gap-2 text-xs text-[var(--ds-muted)] pb-6">
            <CreditCard size={13} />
            Payments processed securely via <span className="text-[var(--ds-text)] font-semibold mx-1">Razorpay</span>.
            We accept UPI, cards, net banking, and wallets. Your card details are never stored on our servers.
          </div>

        </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl animate-[tup_200ms_ease]
          ${toast.ok ? 'bg-[var(--ds-bg2)] border-emerald-500/30 text-emerald-400' : 'bg-[var(--ds-bg2)] border-red-500/30 text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${toast.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {toast.msg}
        </div>
      )}

    </div>
  )
}

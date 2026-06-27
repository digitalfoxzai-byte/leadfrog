'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Search, Download, Trash2, LogOut, Users, CheckCircle, Phone, Globe,
  ChevronDown, ChevronUp, X, Star, RefreshCw, Settings, Eye, FileJson,
  Lock, Zap, Check, Crown,
} from 'lucide-react'

interface Lead {
  id?: number; name: string; phone: string; email?: string; address: string
  website?: string; category: string; rating: number; reviews: number
  status: string; keyword?: string; location?: string
}

interface PlanStatus {
  plan: string; label: string; isActive: boolean
  leadsUsed: number; leadsLimit: number; leadsRemaining: number
  daysLeft: number; expired: boolean; limitReached: boolean; percentUsed: number
  trialEndsAt: string | null; planExpiresAt: string | null
}

const STATUS_OPTS = ['all','new','contacted','qualified','converted','lost']
const STATUS_COLORS: Record<string, string> = {
  new:       'bg-[#A3E635]/10 text-[#A3E635] border-[#A3E635]/20',
  contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  qualified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  converted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  lost:      'bg-red-500/10 text-red-400 border-red-500/20',
}
const SCRAPER_CATS = ['All Categories','Beauty & Wellness','Food & Restaurant','Healthcare','Hotels & Hospitality','Fitness & Wellness','Real Estate','Digital Marketing','Education','Dental Care']

const UPGRADE_PLANS = [
  {
    key: 'starter', label: 'Starter', price: 499, leads: 500,
    features: ['500 leads/month', 'CSV Export', 'Basic filters', 'Email support', 'Phone data'],
  },
  {
    key: 'pro', label: 'Pro', price: 999, leads: 2000, popular: true,
    features: ['2,000 leads/month', 'CSV + Excel Export', 'Advanced filters', 'Priority support', 'Keyword history'],
  },
  {
    key: 'business', label: 'Business', price: 2499, leads: 10000,
    features: ['10,000 leads/month', 'All Pro features', 'API access', 'Dedicated manager'],
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [scraperResults, setScraperResults] = useState<Lead[]>([])
  const [dbLeads, setDbLeads] = useState<Lead[]>([])
  const [scraping, setScraping] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTxt, setProgressTxt] = useState('Initializing...')

  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null)

  const [panelOpen, setPanelOpen] = useState(true)
  const [form, setForm] = useState({
    keyword: '', location: '', maxResults: '20',
    minRating: '0', minReviews: '0', strategy: 'fast',
    hasWebsite: false, hasPhone: false,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('0')
  const [webFilter, setWebFilter] = useState('all')
  const [sortF, setSortF] = useState('rating_desc')

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [view, setView] = useState<'scraper'|'leads'>('scraper')
  const [page, setPage] = useState(1)
  const [delConfirm, setDelConfirm] = useState(false)
  const [modalLead, setModalLead] = useState<Lead | null>(null)
  const [toast, setToast] = useState<{msg:string;ok:boolean}|null>(null)
  const PER_PAGE = 25

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') router.push('/admin')
  }, [status, session, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/leads').then(r => r.json()).then(d => { if (d.leads) setDbLeads(d.leads) })
    fetch('/api/plan/status').then(r => r.json()).then(d => {
      setPlanStatus(d)
      setPlanLoading(false)
    }).catch(() => setPlanLoading(false))
  }, [status])

  useEffect(() => {
    if (view === 'leads' && status === 'authenticated') {
      fetch('/api/leads').then(r => r.json()).then(d => { if (d.leads) setDbLeads(d.leads) })
    }
    setSelected(new Set())
    setPage(1)
  }, [view, status])

  const activeLeads = view === 'scraper' ? scraperResults : dbLeads

  const filtered = useMemo(() => {
    let list = [...activeLeads]
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter)
    if (webFilter === 'yes') list = list.filter(l => l.website)
    if (webFilter === 'no') list = list.filter(l => !l.website)
    if (ratingFilter !== '0') list = list.filter(l => (l.rating || 0) >= Number(ratingFilter))
    if (search) list = list.filter(l =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone||'').includes(search) ||
      (l.address||'').toLowerCase().includes(search.toLowerCase())
    )
    list.sort((a, b) => {
      if (sortF === 'rating_desc') return (b.rating||0) - (a.rating||0)
      if (sortF === 'rating_asc')  return (a.rating||0) - (b.rating||0)
      if (sortF === 'reviews_desc') return (b.reviews||0) - (a.reviews||0)
      if (sortF === 'name_asc')  return a.name.localeCompare(b.name)
      if (sortF === 'name_desc') return b.name.localeCompare(a.name)
      return 0
    })
    return list
  }, [activeLeads, statusFilter, webFilter, ratingFilter, search, sortF])

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)

  const stats = {
    total: dbLeads.length,
    qualified: dbLeads.filter(l => l.status === 'qualified').length,
    contacted: dbLeads.filter(l => l.status === 'contacted').length,
    hasWebsite: dbLeads.filter(l => l.website).length,
  }

  // Razorpay payment
  const buyPlan = useCallback(async (planKey: string) => {
    setBuyingPlan(planKey)
    try {
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://checkout.razorpay.com/v1/checkout.js'
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed to load Razorpay'))
          document.head.appendChild(s)
        })
      }
      const res = await fetch('/api/payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const { orderId, keyId, amount, planName, error } = await res.json()
      if (error) { showToast(error, false); setBuyingPlan(null); return }

      new window.Razorpay({
        key: keyId, order_id: orderId, amount, currency: 'INR',
        name: 'LeadFrog', description: `${planName} Plan — Monthly`,
        prefill: { email: session?.user?.email || '' },
        theme: { color: '#A3E635' },
        handler: async (response: { razorpay_payment_id: string }) => {
          await fetch('/api/payment', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, paymentId: response.razorpay_payment_id, plan: planKey }),
          })
          window.location.reload()
        },
        modal: { ondismiss: () => setBuyingPlan(null) },
      }).open()
    } catch {
      showToast('Payment setup failed. Please try again.', false)
      setBuyingPlan(null)
    }
  }, [session])

  const startScrape = useCallback(async () => {
    if (!form.keyword || !form.location) return
    if (planStatus && !planStatus.isActive) return
    setScraping(true); setProgress(0)
    const steps = ['Connecting to Google Maps...','Searching businesses...','Fetching details...','Processing results...']
    let step = 0
    setProgressTxt(steps[0])
    const tick = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + 2, 88)
        if (next > 25 * (step + 1) && step < steps.length - 1) { step++; setProgressTxt(steps[step]) }
        return next
      })
    }, 200)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: form.keyword, location: form.location, maxResults: Number(form.maxResults) }),
      })
      const data = await res.json()
      clearInterval(tick); setProgress(100); setProgressTxt('Done!')

      if (data.error === 'trial_expired' || data.error === 'plan_expired') {
        setPlanStatus(p => p ? { ...p, isActive: false, expired: true } : p)
        showToast('Your plan has expired. Please upgrade to continue.', false)
        return
      }
      if (data.error === 'limit_reached') {
        setPlanStatus(p => p ? { ...p, isActive: false, limitReached: true } : p)
        showToast('Lead limit reached. Please upgrade to continue.', false)
        return
      }
      if (data.error) { showToast(data.error, false); return }

      let results: Lead[] = data.leads || []
      if (Number(form.minRating) > 0) results = results.filter((l: Lead) => (l.rating||0) >= Number(form.minRating))
      if (Number(form.minReviews) > 0) results = results.filter((l: Lead) => (l.reviews||0) >= Number(form.minReviews))
      if (form.hasWebsite) results = results.filter((l: Lead) => l.website)
      if (form.hasPhone) results = results.filter((l: Lead) => l.phone)

      setScraperResults(results)
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(results) })
      setDbLeads(prev => [...results, ...prev])

      // Update plan status counters
      setPlanStatus(p => p ? {
        ...p,
        leadsUsed: p.leadsUsed + results.length,
        leadsRemaining: Math.max(0, p.leadsRemaining - results.length),
        percentUsed: Math.min(100, Math.round(((p.leadsUsed + results.length) / p.leadsLimit) * 100)),
      } : p)

      showToast(`${results.length} leads scraped & saved`)
    } catch {
      showToast('Scraping failed. Please try again.', false)
    } finally {
      clearInterval(tick)
      setTimeout(() => { setScraping(false); setProgress(0) }, 800)
    }
  }, [form, planStatus])

  const exportCSV = useCallback((rows?: Lead[]) => {
    const data = rows || filtered
    const header = ['Name','Phone','Email','Address','Website','Category','Rating','Reviews','Status']
    const csv = [header, ...data.map(l => [l.name,l.phone||'',l.email||'',l.address,l.website||'',l.category,String(l.rating||''),String(l.reviews||''),l.status])]
      .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'leadfrog_leads.csv'; a.click()
  }, [filtered])

  const exportJSON = useCallback(() => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(filtered,null,2)],{type:'application/json'}))
    a.download = 'leadfrog_leads.json'; a.click()
  }, [filtered])

  const handleClearAll = useCallback(async () => {
    if (view === 'scraper') {
      setScraperResults([]); setDelConfirm(false); showToast('Scraper results cleared')
    } else {
      await fetch('/api/leads', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ids:'all'}) })
      setDbLeads([]); setDelConfirm(false); showToast('All leads deleted')
    }
  }, [view])

  const deleteLead = useCallback(async (idx: number) => {
    const lead = filtered[idx]
    if (view === 'scraper') {
      setScraperResults(prev => prev.filter(l => l !== lead))
      if (lead?.id) {
        await fetch('/api/leads', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ids:[lead.id]}) })
        setDbLeads(prev => prev.filter(l => l.id !== lead.id))
      }
    } else {
      if (lead?.id) await fetch('/api/leads', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ids:[lead.id]}) })
      setDbLeads(prev => prev.filter(l => l !== lead))
    }
  }, [filtered, view])

  const cycleStatus = useCallback((idx: number) => {
    const order = ['new','contacted','qualified','converted','lost']
    const lead = filtered[idx]
    if (view === 'scraper') {
      setScraperResults(prev => prev.map(l => l === lead ? { ...l, status: order[(order.indexOf(l.status)+1)%order.length] } : l))
    } else {
      setDbLeads(prev => prev.map(l => l === lead ? { ...l, status: order[(order.indexOf(l.status)+1)%order.length] } : l))
    }
  }, [filtered, view])

  const bulkSetStatus = (s: string) => {
    const leads = filtered
    if (view === 'scraper') {
      setScraperResults(prev => prev.map((l) => selected.has(leads.indexOf(l)) ? {...l, status: s} : l))
    } else {
      setDbLeads(prev => prev.map((l) => selected.has(leads.indexOf(l)) ? {...l, status: s} : l))
    }
    setSelected(new Set()); showToast(`${selected.size} leads marked as ${s}`)
  }

  const bulkExport = () => exportCSV(Array.from(selected).map(i => filtered[i]).filter(Boolean))

  const bulkDelete = useCallback(async () => {
    const toDelete = Array.from(selected).map(i => filtered[i]).filter(Boolean)
    const ids = toDelete.map(l => l.id).filter(Boolean) as number[]
    const count = toDelete.length
    if (ids.length) {
      await fetch('/api/leads', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ids}) })
      setDbLeads(prev => prev.filter(l => !l.id || !ids.includes(l.id)))
    }
    if (view === 'scraper') setScraperResults(prev => prev.filter(l => !toDelete.includes(l)))
    setSelected(new Set()); showToast(`${count} leads deleted`)
  }, [selected, filtered, view])

  const toggleSelect = (i: number) => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  const selectAll = () => setSelected(selected.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map((_,i)=>i)))

  if (status === 'loading' || planLoading) {
    return <div className="min-h-screen bg-[#050A06] flex items-center justify-center text-[#4B6856]">Loading...</div>
  }

  const isScraperView = view === 'scraper'
  const planBlocked = planStatus && !planStatus.isActive && planStatus.plan !== 'admin'

  // Sidebar plan status section
  const PlanBadge = () => {
    if (!planStatus || planStatus.plan === 'admin') return null
    const isTrial = planStatus.plan === 'free'
    const barColor = planStatus.percentUsed >= 90 ? 'bg-red-500' : planStatus.percentUsed >= 70 ? 'bg-amber-400' : 'bg-[#4ADE80]'
    return (
      <div className="mx-3 mb-2 p-3 rounded-xl border border-[#122016] bg-[#070D08]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-[#4B6856] uppercase tracking-widest">
            {isTrial ? 'Free Trial' : planStatus.label}
          </span>
          {isTrial && planStatus.daysLeft > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${planStatus.daysLeft <= 1 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {planStatus.daysLeft}d left
            </span>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-[#4B6856] mb-1">
          <span>Leads used</span>
          <span className="text-[#94A3B8] font-semibold">{planStatus.leadsUsed}/{planStatus.leadsLimit}</span>
        </div>
        <div className="h-1.5 bg-[#0A110B] rounded-full border border-[#122016] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{width:`${planStatus.percentUsed}%`}} />
        </div>
        {!planStatus.isActive && (
          <button onClick={() => {}} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-[#A3E635]/20 to-[#4ADE80]/10 text-[#A3E635] border border-[#A3E635]/20 cursor-pointer hover:from-[#A3E635]/30 transition-all">
            Upgrade Now ↑
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#050A06] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-[#122016] bg-[#070D08]">
        <div className="p-4 border-b border-[#122016] flex flex-col items-center gap-1.5">
          <Image src="/logo.png" alt="LeadFrog" width={110} height={44} className="object-contain" />
          <span className="text-[8px] text-[#4B6856] tracking-[2px] uppercase">Lead Intelligence</span>
        </div>
        <nav className="flex-1 p-3 text-sm overflow-y-auto">
          <div className="text-[9px] text-[#4B6856] uppercase tracking-[2.5px] px-3 py-2 font-semibold">Workspace</div>
          <button onClick={() => setView('scraper')} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer border-l-2 transition-all text-[13.5px] font-medium ${isScraperView ? 'bg-[#0A1F0C] text-[#A3E635] border-[#4ADE80]' : 'text-[#4B6856] border-transparent hover:text-[#94A3B8] hover:bg-white/[0.03]'}`}>
            <Search size={14} /> Scraper
            {scraperResults.length > 0 && <span className="ml-auto text-[10px] bg-[#4ADE80]/10 text-[#4ADE80] px-2 py-0.5 rounded-full font-bold">{scraperResults.length}</span>}
          </button>
          <button onClick={() => setView('leads')} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer border-l-2 transition-all text-[13.5px] font-medium ${!isScraperView ? 'bg-[#0A1F0C] text-[#A3E635] border-[#4ADE80]' : 'text-[#4B6856] border-transparent hover:text-[#94A3B8] hover:bg-white/[0.03]'}`}>
            <Users size={14} /> All Leads
            <span className="ml-auto text-[10px] bg-[#A3E635]/10 text-[#A3E635] px-2 py-0.5 rounded-full font-bold">{dbLeads.length}</span>
          </button>
          {!planBlocked && (
            <>
              <div className="h-px bg-[#122016] my-2" />
              <div className="text-[9px] text-[#4B6856] uppercase tracking-[2.5px] px-3 py-2 font-semibold">Export</div>
              <button onClick={() => exportCSV()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#4B6856] hover:text-[#94A3B8] hover:bg-white/[0.03] text-left cursor-pointer border-l-2 border-transparent text-[13.5px] font-medium">
                <Download size={14} /> Export CSV
              </button>
              <button onClick={exportJSON} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#4B6856] hover:text-[#94A3B8] hover:bg-white/[0.03] text-left cursor-pointer border-l-2 border-transparent text-[13.5px] font-medium">
                <FileJson size={14} /> Export JSON
              </button>
            </>
          )}
        </nav>
        <PlanBadge />
        <div className="p-3 space-y-1 text-sm border-t border-[#122016]">
          {(session?.user as {role?:string})?.role === 'admin' && (
            <button onClick={() => router.push('/admin')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#4B6856] hover:text-[#A3E635] hover:bg-white/[0.03] text-left cursor-pointer text-[13.5px]">
              <Settings size={14} /> Admin
            </button>
          )}
          <button onClick={() => signOut({callbackUrl:'/login'})} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#4B6856] hover:text-red-400 hover:bg-white/[0.03] text-left cursor-pointer text-[13.5px]">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
        <div className="p-3 text-[10px] text-[#4B6856] text-center border-t border-[#122016]">LeadFrog © 2025</div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── PLAN WALL ── shown when trial/plan expired or limit reached */}
        {planBlocked ? (
          <div className="flex-1 overflow-y-auto scrollbar-dark">
            {/* Top banner */}
            <div className="px-8 pt-8 pb-0">
              <div className="max-w-2xl mx-auto glass-card p-7 border-red-500/20 text-center"
                style={{borderColor:'rgba(239,68,68,0.2)'}}>
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {planStatus.expired ? 'Free Trial Ended' : 'Lead Limit Reached'}
                </h2>
                <p className="text-[#94A3B8] text-sm mb-5 leading-relaxed">
                  {planStatus.expired
                    ? `Your 3-day free trial has ended. You scraped ${planStatus.leadsUsed} lead${planStatus.leadsUsed !== 1 ? 's' : ''}.`
                    : `You've reached the ${planStatus.leadsLimit}-lead limit of the Free Trial.`
                  }{' '}Upgrade to keep scraping.
                </p>
                <div className="max-w-xs mx-auto">
                  <div className="flex justify-between text-[11px] text-[#4B6856] mb-1.5">
                    <span>Leads used</span>
                    <span className="text-[#94A3B8] font-semibold">{planStatus.leadsUsed} / {planStatus.leadsLimit}</span>
                  </div>
                  <div className="h-2 bg-[#0A110B] rounded-full border border-[#122016] overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${planStatus.percentUsed}%`,background:'linear-gradient(90deg,#dc2626,#f87171)'}} />
                  </div>
                </div>
              </div>
            </div>

            {/* Plan cards */}
            <div className="px-8 pt-6 pb-10">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-white font-bold text-lg text-center mb-1">Upgrade Your Plan</h3>
                <p className="text-[#4B6856] text-sm text-center mb-6">Secure payment via Razorpay · UPI, Cards, Net Banking</p>
                <div className="grid grid-cols-3 gap-4">
                  {UPGRADE_PLANS.map(plan => (
                    <div key={plan.key}
                      className={`glass-card p-5 flex flex-col relative ${plan.popular ? '' : ''}`}
                      style={plan.popular ? {borderColor:'rgba(163,230,53,0.3)',boxShadow:'0 0 20px rgba(163,230,53,0.06)'} : {}}>
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#A3E635] text-[#050A06] text-[10px] font-bold flex items-center gap-1">
                          <Zap size={9} /> POPULAR
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mb-3">
                        {plan.key === 'business' ? <Crown size={13} className="text-purple-400" /> : <Zap size={13} className="text-[#4ADE80]" />}
                        <span className="text-[10px] font-bold text-[#4B6856] uppercase tracking-widest">{plan.label}</span>
                      </div>
                      <div className="mb-1">
                        <span className="text-2xl font-bold text-white">₹{plan.price}</span>
                        <span className="text-xs text-[#4B6856]">/mo</span>
                      </div>
                      <div className="text-[#A3E635] text-xs font-semibold mb-4">{plan.leads.toLocaleString()} leads/month</div>
                      <ul className="space-y-1.5 flex-1 mb-5">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] text-[#94A3B8]">
                            <Check size={10} className="text-[#A3E635] shrink-0 mt-0.5" /> {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => buyPlan(plan.key)}
                        disabled={!!buyingPlan}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${plan.popular ? 'btn-lime' : 'border border-[#1A321E] text-[#94A3B8] hover:border-[#A3E635]/30 hover:text-white hover:bg-[#A3E635]/5'}`}
                      >
                        {buyingPlan === plan.key
                          ? <span className="flex items-center justify-center gap-1.5"><RefreshCw size={11} className="animate-spin" /> Processing…</span>
                          : `Upgrade to ${plan.label}`}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-center text-[11px] text-[#4B6856] mt-5">
                  Your saved leads are still available in <button onClick={() => setView('leads')} className="text-[#4ADE80] underline cursor-pointer">All Leads</button>
                </p>
              </div>
            </div>
          </div>

        ) : (
          /* ── NORMAL DASHBOARD ── */
          <>
            {/* Topbar */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-[#122016] shrink-0 bg-[#070D08]/80 backdrop-blur-sm sticky top-0 z-40">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base tracking-tight">{isScraperView ? 'Scraper' : 'All Leads'}</span>
                {isScraperView && scraperResults.length > 0 && (
                  <span className="text-[10px] text-[#4B6856] bg-[#0A110B] border border-[#122016] px-2 py-0.5 rounded-full">session results</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Plan indicator in topbar */}
                {planStatus && planStatus.plan !== 'admin' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A110B] border border-[#122016] text-[11px]">
                    <span className="text-[#4B6856]">{planStatus.label}</span>
                    <div className="w-px h-3 bg-[#122016]" />
                    <span className={planStatus.leadsRemaining <= 5 ? 'text-red-400 font-semibold' : 'text-[#4ADE80] font-semibold'}>
                      {planStatus.leadsRemaining} left
                    </span>
                    {planStatus.plan === 'free' && planStatus.daysLeft > 0 && (
                      <><div className="w-px h-3 bg-[#122016]" /><span className="text-amber-400 font-semibold">{planStatus.daysLeft}d trial</span></>
                    )}
                  </div>
                )}
                <button onClick={() => setDelConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#94A3B8] border border-[#122016] hover:border-red-500/30 hover:text-red-400 transition-all cursor-pointer">
                  <Trash2 size={13} /> {isScraperView ? 'Clear Results' : 'Clear All'}
                </button>
                <button onClick={() => exportCSV()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-amber-500/90 hover:bg-amber-400 text-black font-semibold transition-all cursor-pointer">
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-dark">

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label:'Total Leads',  value:stats.total,      icon:Users,        color:'text-[#4ADE80]', glow:'bg-[#4ADE80]',  bg:'bg-[#4ADE80]/10' },
                  { label:'Qualified',    value:stats.qualified,  icon:CheckCircle,  color:'text-emerald-400', glow:'bg-emerald-400', bg:'bg-emerald-400/10', pct: stats.total ? Math.round(stats.qualified/stats.total*100) : 0 },
                  { label:'Contacted',    value:stats.contacted,  icon:Phone,        color:'text-amber-400', glow:'bg-amber-400',  bg:'bg-amber-400/10',  pct: stats.total ? Math.round(stats.contacted/stats.total*100) : 0 },
                  { label:'With Website', value:stats.hasWebsite, icon:Globe,        color:'text-purple-400', glow:'bg-purple-400', bg:'bg-purple-400/10', pct: stats.total ? Math.round(stats.hasWebsite/stats.total*100) : 0 },
                ].map(({ label, value, icon: Icon, color, glow, bg, pct }) => (
                  <div key={label} className="glass-card p-5 relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.07] blur-2xl ${glow}`} />
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
                        <Icon size={16} className={color} />
                      </div>
                      {pct !== undefined && <span className="text-[10px] font-bold text-[#A3E635]">{pct}%</span>}
                    </div>
                    <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
                    <div className="text-xs text-[#4B6856] mt-1 font-medium">{label}</div>
                  </div>
                ))}
              </div>

              {/* Scraper Card */}
              {isScraperView && (
              <div className="rounded-[14px] bg-[#0A110B] border border-[#122016] overflow-hidden">
                <button onClick={() => setPanelOpen(p => !p)}
                  className="w-full flex items-center justify-between px-5 py-4 border-b border-[#122016] cursor-pointer hover:bg-[#A3E635]/[0.03] transition-colors"
                  style={{background:'linear-gradient(90deg,rgba(163,230,53,0.04),transparent)'}}>
                  <div className="flex items-center gap-2.5">
                    <Search size={15} className="text-[#4ADE80]" />
                    <span className="text-white font-bold text-sm">Scrape New Leads</span>
                    <span className="text-xs text-[#4B6856]">· Google Maps</span>
                    {planStatus && planStatus.plan !== 'admin' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/15">
                        {planStatus.leadsRemaining} leads remaining
                      </span>
                    )}
                  </div>
                  {panelOpen ? <ChevronUp size={15} className="text-[#4B6856]" /> : <ChevronDown size={15} className="text-[#4B6856]" />}
                </button>

                {panelOpen && (
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">Keyword / Business Type</label>
                      <input value={form.keyword} onChange={e => setForm(f=>({...f,keyword:e.target.value}))}
                        placeholder="e.g. Dentists, Restaurants, Gyms"
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">City / Location</label>
                      <input value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))}
                        placeholder="e.g. Mumbai, New York, London"
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">Category</label>
                      <select className="input-dark w-full px-3 py-2 rounded-lg text-sm cursor-pointer">
                        {SCRAPER_CATS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">Max Results</label>
                      <select value={form.maxResults} onChange={e => setForm(f=>({...f,maxResults:e.target.value}))}
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm cursor-pointer">
                        {['10','20','50'].map(n => <option key={n} value={n}>{n} results</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">Min Rating</label>
                      <select value={form.minRating} onChange={e => setForm(f=>({...f,minRating:e.target.value}))}
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm cursor-pointer">
                        <option value="0">Any Rating</option>
                        <option value="3">3+ Stars</option>
                        <option value="4">4+ Stars</option>
                        <option value="4.5">4.5+ Stars</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">Min Reviews</label>
                      <select value={form.minReviews} onChange={e => setForm(f=>({...f,minReviews:e.target.value}))}
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm cursor-pointer">
                        <option value="0">Any</option>
                        <option value="10">10+</option>
                        <option value="50">50+</option>
                        <option value="100">100+</option>
                        <option value="500">500+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-widest block mb-1.5 font-semibold">Strategy</label>
                      <select value={form.strategy} onChange={e => setForm(f=>({...f,strategy:e.target.value}))}
                        className="input-dark w-full px-3 py-2 rounded-lg text-sm cursor-pointer">
                        <option value="fast">Fast (1–5 min)</option>
                        <option value="detailed">Detailed (10–20 min)</option>
                        <option value="deep">Deep (max results)</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-center gap-3 pt-1">
                      {[
                        { key:'hasWebsite', label:'Has website only' },
                        { key:'hasPhone',   label:'Has phone only' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                          <div className="relative w-9 h-5">
                            <input type="checkbox" className="sr-only"
                              checked={form[key as 'hasWebsite'|'hasPhone']}
                              onChange={e => setForm(f=>({...f,[key]:e.target.checked}))} />
                            <div className={`absolute inset-0 rounded-full border transition-all ${form[key as 'hasWebsite'|'hasPhone'] ? 'bg-[#16A34A]/30 border-[#16A34A]' : 'bg-[#0A110B] border-[#1A321E]'}`} />
                            <div className={`absolute top-[3px] left-[3px] w-[14px] h-[14px] rounded-full transition-all ${form[key as 'hasWebsite'|'hasPhone'] ? 'translate-x-4 bg-[#4ADE80]' : 'bg-[#4B6856]'}`} />
                          </div>
                          <span className="text-xs text-[#94A3B8] font-medium">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={startScrape} disabled={scraping || !form.keyword || !form.location}
                      className="btn-lime px-6 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-40 whitespace-nowrap font-semibold">
                      {scraping ? <><RefreshCw size={14} className="animate-spin" /> Scraping...</> : <><Search size={14} /> Start Scraping</>}
                    </button>
                    {scraping && (
                      <div className="flex-1">
                        <div className="w-full h-1.5 bg-[#0A110B] rounded-full overflow-hidden border border-[#1A321E] mb-1">
                          <div className="h-full bg-gradient-to-r from-[#166534] via-[#4ADE80] to-[#A3E635] rounded-full transition-all duration-300" style={{width:`${progress}%`}} />
                        </div>
                        <div className="text-[11px] text-[#4B6856] font-medium">{progressTxt}</div>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>
              )}

              {/* Scraper empty state */}
              {isScraperView && scraperResults.length === 0 && !scraping && (
                <div className="rounded-[14px] bg-[#0A110B] border border-[#122016] py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#A3E635]/5 border border-[#A3E635]/10 flex items-center justify-center mx-auto mb-4">
                    <Search size={26} className="text-[#4ADE80]" />
                  </div>
                  <div className="text-[#94A3B8] font-bold mb-1">No results yet</div>
                  <div className="text-xs text-[#4B6856]">Enter a keyword and location, then click Start Scraping</div>
                  <div className="text-xs text-[#4B6856] mt-1">Your saved leads are in the <button onClick={() => setView('leads')} className="text-[#4ADE80] underline cursor-pointer">All Leads</button> tab</div>
                </div>
              )}

              {(!isScraperView || scraperResults.length > 0) && (
              <>
                {/* Filter Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856] pointer-events-none" />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search leads..."
                      className="input-dark w-[220px] pl-8 pr-3 py-2 rounded-lg text-sm" />
                  </div>
                  {([
                    { val: statusFilter, set: (v:string) => { setStatusFilter(v); setPage(1) }, opts: STATUS_OPTS.map(s => ({v:s, l: s==='all'?'All Status':s.charAt(0).toUpperCase()+s.slice(1)})) },
                    { val: ratingFilter, set: (v:string) => { setRatingFilter(v); setPage(1) }, opts: [{v:'0',l:'Any Rating'},{v:'3',l:'3+ Stars'},{v:'4',l:'4+ Stars'},{v:'4.5',l:'4.5+ Stars'}] },
                    { val: webFilter,    set: (v:string) => { setWebFilter(v); setPage(1) },    opts: [{v:'all',l:'All'},{v:'yes',l:'Has Website'},{v:'no',l:'No Website'}] },
                    { val: sortF,        set: (v:string) => { setSortF(v); setPage(1) },         opts: [{v:'rating_desc',l:'Rating ↓'},{v:'rating_asc',l:'Rating ↑'},{v:'reviews_desc',l:'Reviews ↓'},{v:'name_asc',l:'Name A–Z'},{v:'name_desc',l:'Name Z–A'}] },
                  ] as const).map((f, i) => (
                    <select key={i} value={f.val} onChange={e => (f.set as (v:string)=>void)(e.target.value)}
                      className="input-dark px-3 py-2 rounded-lg text-sm cursor-pointer">
                      {(f.opts as {v:string;l:string}[]).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ))}
                  <span className="ml-auto text-xs text-[#4B6856] bg-[#0A110B] border border-[#122016] px-3 py-2 rounded-lg font-semibold">{filtered.length} leads</span>
                </div>

                {/* Bulk bar */}
                {selected.size > 0 && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm"
                    style={{background:'linear-gradient(135deg,rgba(163,230,53,0.07),rgba(74,222,128,0.04))',borderColor:'rgba(163,230,53,0.2)'}}>
                    <span className="text-[#A3E635] font-bold text-xs">{selected.size} selected</span>
                    <div className="w-px h-4 bg-[#1A321E]" />
                    <button onClick={() => bulkSetStatus('qualified')} className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer">Mark Qualified</button>
                    <button onClick={() => bulkSetStatus('contacted')} className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer">Mark Contacted</button>
                    <button onClick={() => bulkSetStatus('lost')} className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 cursor-pointer">Mark Lost</button>
                    <button onClick={bulkExport} className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/[0.05] text-[#94A3B8] border border-[#122016] cursor-pointer">Export Selected</button>
                    <button onClick={bulkDelete} className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer">Delete Selected</button>
                    <button onClick={() => setSelected(new Set())} className="ml-auto text-[#4B6856] hover:text-white cursor-pointer"><X size={14} /></button>
                  </div>
                )}

                {/* Table */}
                <div className="rounded-[14px] bg-[#0A110B] border border-[#122016] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{minWidth:'960px'}}>
                      <thead>
                        <tr className="bg-[#070D08] border-b border-[#122016]">
                          <th className="p-3 w-9"><input type="checkbox" onChange={selectAll} checked={selected.size===filtered.length && filtered.length>0} className="cursor-pointer accent-[#A3E635] w-[15px] h-[15px]" /></th>
                          {['Business Name','Phone','Address','Rating','Reviews','Website','Category','Status','Actions'].map(h => (
                            <th key={h} className="px-3 py-3 text-left text-[10.5px] text-[#4B6856] uppercase tracking-[1.5px] font-bold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paged.length === 0 ? (
                          <tr><td colSpan={10} className="py-12 text-center text-xs text-[#4B6856]">No leads match your filters</td></tr>
                        ) : paged.map((lead, i) => {
                          const realIdx = (page - 1) * PER_PAGE + i
                          return (
                            <tr key={realIdx} className={`border-b border-[#0D160E]/60 transition-colors hover:bg-[#A3E635]/[0.02] ${selected.has(realIdx) ? 'bg-[#A3E635]/[0.04]' : ''}`}>
                              <td className="p-3"><input type="checkbox" checked={selected.has(realIdx)} onChange={() => toggleSelect(realIdx)} className="cursor-pointer accent-[#A3E635] w-[15px] h-[15px]" /></td>
                              <td className="px-3 py-3 max-w-[170px]">
                                <div className="font-semibold text-[#E8EDF5] truncate" title={lead.name}>{lead.name}</div>
                              </td>
                              <td className="px-3 py-3 text-[#94A3B8] whitespace-nowrap text-[12px] font-medium">{lead.phone || '—'}</td>
                              <td className="px-3 py-3 max-w-[190px]">
                                <div className="text-[#4B6856] text-xs truncate" title={lead.address}>{lead.address}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Star size={11} className="text-amber-400 fill-amber-400" />
                                  <span className="text-[12px] font-semibold text-[#94A3B8]">{lead.rating || '—'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-[12px] font-medium text-[#4B6856] whitespace-nowrap">{lead.reviews ? `(${Number(lead.reviews).toLocaleString()})` : '—'}</td>
                              <td className="px-3 py-3 max-w-[140px]">
                                {lead.website
                                  ? <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener" className="text-[#4ADE80] text-xs truncate block hover:text-[#A3E635] hover:underline" title={lead.website}>{lead.website.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a>
                                  : <span className="text-[#1A321E] text-xs">—</span>}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-[#A3E635]/8 text-[#86EFAC] border border-[#A3E635]/15">{lead.category}</span>
                              </td>
                              <td className="px-3 py-3">
                                <button onClick={() => cycleStatus(realIdx)} className={`px-2.5 py-1 rounded-full text-[10.5px] border cursor-pointer font-bold flex items-center gap-1 whitespace-nowrap ${STATUS_COLORS[lead.status]||STATUS_COLORS.new}`}>
                                  <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${lead.status==='new'?'bg-[#A3E635]':lead.status==='contacted'?'bg-amber-400':lead.status==='qualified'?'bg-emerald-400':lead.status==='converted'?'bg-blue-400':'bg-red-400'}`} />
                                  {lead.status}
                                </button>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex gap-1">
                                  <button onClick={() => setModalLead(lead)} title="View" className="w-7 h-7 rounded-md flex items-center justify-center border border-[#1A321E] text-[#4B6856] hover:text-[#4ADE80] hover:border-[#4ADE80]/30 hover:bg-[#4ADE80]/10 transition-all cursor-pointer">
                                    <Eye size={12} />
                                  </button>
                                  <button onClick={() => deleteLead(realIdx)} title="Delete" className="w-7 h-7 rounded-md flex items-center justify-center border border-[#1A321E] text-[#4B6856] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all cursor-pointer">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5 px-4 py-3 border-t border-[#122016] bg-[#070D08]">
                      <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
                        className="min-w-[32px] h-8 px-2 rounded-lg bg-[#0A110B] border border-[#122016] text-[#4B6856] text-xs font-semibold cursor-pointer disabled:opacity-35 hover:border-[#A3E635]/30 hover:text-white transition-all">‹</button>
                      {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                        let p = i+1
                        if (totalPages>5) { if (page<=3) p=i+1; else if (page>=totalPages-2) p=totalPages-4+i; else p=page-2+i }
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${page===p ? 'bg-gradient-to-br from-[#16A34A] to-[#15803D] text-white border-[#16A34A] shadow-lg shadow-[#A3E635]/20' : 'bg-[#0A110B] border border-[#122016] text-[#4B6856] hover:text-white hover:border-[#A3E635]/30'}`}>
                            {p}
                          </button>
                        )
                      })}
                      <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                        className="min-w-[32px] h-8 px-2 rounded-lg bg-[#0A110B] border border-[#122016] text-[#4B6856] text-xs font-semibold cursor-pointer disabled:opacity-35 hover:border-[#A3E635]/30 hover:text-white transition-all">›</button>
                      <span className="ml-auto text-[11.5px] text-[#4B6856] font-medium">
                        {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length}
                      </span>
                    </div>
                  )}
                </div>
              </>
              )}

            </div>
          </>
        )}
      </div>

      {/* Lead Detail Modal */}
      {modalLead && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-[100] flex items-center justify-center" onClick={() => setModalLead(null)}>
          <div className="bg-[#0A110B] border border-[#1A321E] rounded-2xl w-[580px] max-h-[88vh] flex flex-col overflow-hidden animate-[pop_180ms_cubic-bezier(0.34,1.56,0.64,1)]" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#122016]">
              <span className="text-base font-bold text-white">Lead Details</span>
              <button onClick={() => setModalLead(null)} className="w-7 h-7 rounded-lg border border-[#122016] text-[#4B6856] hover:text-white hover:bg-[#122016] flex items-center justify-center cursor-pointer text-sm">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:'Business Name', value:modalLead.name, full:true },
                  { label:'Phone',    value:modalLead.phone || '—' },
                  { label:'Email',    value:modalLead.email || '—' },
                  { label:'Website',  value:modalLead.website || '—' },
                  { label:'Address',  value:modalLead.address, full:true },
                  { label:'Category', value:modalLead.category },
                  { label:'Rating',   value:modalLead.rating ? `${modalLead.rating} ★` : '—' },
                  { label:'Reviews',  value:modalLead.reviews ? `(${Number(modalLead.reviews).toLocaleString()})` : '—' },
                  { label:'Status',   value:modalLead.status },
                  { label:'Keyword',  value:modalLead.keyword || '—' },
                ].map(({ label, value, full }) => (
                  <div key={label} className={full ? 'col-span-2' : ''}>
                    <div className="text-[10px] font-bold text-[#4B6856] uppercase tracking-[1.5px] mb-1">{label}</div>
                    <div className="text-[13px] text-[#94A3B8] font-medium break-all">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-[#122016] bg-[#070D08]">
              {modalLead.phone && <a href={`tel:${modalLead.phone}`} className="btn-lime px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"><Phone size={12} /> Call</a>}
              {modalLead.website && <a href={modalLead.website.startsWith('http') ? modalLead.website : `https://${modalLead.website}`} target="_blank" rel="noopener" className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#1A321E] text-[#94A3B8] hover:text-white flex items-center gap-1.5 cursor-pointer"><Globe size={12} /> Visit Site</a>}
              <button onClick={() => setModalLead(null)} className="ml-auto px-4 py-2 rounded-lg text-xs font-semibold border border-[#122016] text-[#4B6856] hover:text-white cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirm */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center">
          <div className="bg-[#0A110B] border border-[#1A321E] rounded-2xl w-[340px] overflow-hidden shadow-2xl">
            <div className="flex justify-center pt-6">
              <div className="w-12 h-12 rounded-[14px] bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 size={22} className="text-red-400" />
              </div>
            </div>
            <div className="px-6 pb-4 pt-3 text-center">
              {isScraperView ? (
                <>
                  <div className="text-base font-bold text-white mb-1.5">Clear Scraper Results?</div>
                  <div className="text-xs text-[#4B6856] leading-relaxed">Removes {scraperResults.length} results from view. <span className="text-[#4ADE80]">Saved leads remain safe in All Leads.</span></div>
                </>
              ) : (
                <>
                  <div className="text-base font-bold text-white mb-1.5">Delete All Leads?</div>
                  <div className="text-xs text-[#4B6856] leading-relaxed">Permanently deletes all <span className="text-[#94A3B8] font-semibold">{dbLeads.length} leads</span> from your account.</div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 px-6 pb-5">
              <button onClick={() => setDelConfirm(false)} className="py-2.5 rounded-xl border border-[#1A321E] text-[#94A3B8] text-sm font-semibold hover:text-white hover:bg-white/[0.05] cursor-pointer transition-all">Cancel</button>
              <button onClick={handleClearAll} className="py-2.5 rounded-xl bg-gradient-to-br from-red-600 to-red-500 text-white text-sm font-semibold cursor-pointer hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-500/20">
                {isScraperView ? 'Clear Results' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl animate-[tup_200ms_ease]
          ${toast.ok ? 'bg-[#0C1510] border-emerald-500/30 text-emerald-400' : 'bg-[#0C0A0A] border-red-500/30 text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${toast.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {toast.msg}
        </div>
      )}

    </div>
  )
}

'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, Users, CreditCard, IndianRupee, Settings, LogOut,
  Eye, EyeOff, Save, Trash2, ShieldOff, ShieldCheck,
  CheckCircle, AlertCircle, Globe, Key, Mail, Lock, User, ChevronDown,
  RefreshCw, Search, TrendingUp, Activity, Download
} from 'lucide-react'

/* ── Types ── */
interface Stat { totalUsers: number; activeUsers: number; totalLeads: number; revenue: number }
interface DbUser { id: number; name: string; email: string; role: string; plan: string; plan_expires_at: string | null; lead_count: number; created_at: string }
interface Invoice { id: number; plan: string; amount: number; status: string; created_at: string; user_name: string; user_email: string }
interface Upcoming { id: number; name: string; email: string; plan: string; plan_expires_at: string; days_left: number }
interface PayData { invoices: Invoice[]; upcoming: Upcoming[]; stats: { revenue: number; pending: number; upcomingCount: number; overdue: number } }
interface AdminSettings { razorpay_key_id: string; razorpay_key_secret: string; razorpay_mode: string; starter_price: string; pro_price: string; business_price: string; starter_leads: string; pro_leads: string; business_leads: string }
type InvoiceAction = { type: 'generating' | 'sending'; id: number } | null

type Tab = 'overview' | 'users' | 'plans' | 'payments' | 'settings'

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview',  icon: LayoutDashboard },
  { id: 'users',    label: 'Users',     icon: Users },
  { id: 'plans',    label: 'Plans',     icon: CreditCard },
  { id: 'payments', label: 'Payments',  icon: IndianRupee },
  { id: 'settings', label: 'Settings',  icon: Settings },
]

const PLAN_BADGE: Record<string, string> = {
  free:     'bg-[#1E2A1E] text-[#4B6856]',
  starter:  'bg-blue-900/40 text-blue-400',
  pro:      'bg-[#1A2E10] text-[#A3E635]',
  business: 'bg-purple-900/40 text-purple-400',
}
const STATUS_BADGE: Record<string, string> = {
  active:  'text-[#A3E635]',
  user:    'text-[#A3E635]',
  banned:  'text-red-400',
  admin:   'text-amber-400',
  paid:    'text-[#A3E635]',
  pending: 'text-amber-400',
  failed:  'text-red-400',
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stat | null>(null)
  const [users, setUsers] = useState<DbUser[]>([])
  const [payData, setPayData] = useState<PayData | null>(null)
  const [ovSearch, setOvSearch] = useState('')
  const [ovFilter, setOvFilter] = useState<'all'|'active'|'banned'|'free'>('all')
  const [settings, setSettings] = useState<AdminSettings>({ razorpay_key_id: '', razorpay_key_secret: '', razorpay_mode: 'test', starter_price: '499', pro_price: '999', business_price: '2499', starter_leads: '500', pro_leads: '2000', business_leads: '10000' })
  const [smtp, setSmtp] = useState<Record<string, string>>({ smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_user: '', smtp_pass: '', smtp_from_name: 'LeadFrog', smtp_admin_email: '' })
  const [account, setAccount] = useState({ currentPassword: '', newEmail: '', newPassword: '' })
  const [paySubTab, setPaySubTab] = useState<'upcoming'|'invoices'>('upcoming')
  const [showSecret, setShowSecret] = useState(false)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [invAction, setInvAction] = useState<InvoiceAction>(null)

  type PlanFeatMap = Record<string, Record<string, boolean>>
  const FEAT_LABELS: Record<string, string> = {
    json_export: 'JSON Export', advanced_filters: 'Advanced Scraper Filters',
    rating_web_filter: 'Rating & Web Filter (Leads)', bulk_actions: 'Bulk Actions',
    keyword_history: 'Keyword History', api_keys: 'API Keys',
  }
  const FEAT_KEYS = ['json_export', 'advanced_filters', 'rating_web_filter', 'bulk_actions', 'keyword_history', 'api_keys']
  const FEAT_PLANS = ['free', 'starter', 'pro', 'business']
  const [planFeats, setPlanFeats] = useState<PlanFeatMap>({})
  const [featSaving, setFeatSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'admin') router.push('/dashboard')
  }, [status, session, router])

  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000) }

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/stats'); setStats(await r.json())
  }, [])
  const loadUsers = useCallback(async () => {
    setLoading(true); const d = await (await fetch('/api/admin/users')).json(); setUsers(d.users || []); setLoading(false)
  }, [])
  const loadPayments = useCallback(async () => {
    setLoading(true); setPayData(await (await fetch('/api/admin/payments')).json()); setLoading(false)
  }, [])
  const loadSettings = useCallback(async () => {
    const d = await (await fetch('/api/admin/settings')).json()
    if (d.settings) setSettings(s => ({ ...s, ...d.settings }))
    const d2 = await (await fetch('/api/admin/smtp')).json()
    if (d2.smtp) setSmtp(s => ({ ...s, ...d2.smtp }))
  }, [])

  const loadPlanFeats = useCallback(async () => {
    const d = await (await fetch('/api/admin/plan-features')).json()
    if (d && typeof d === 'object') setPlanFeats(d)
  }, [])

  function invNum(id: number, createdAt: string) {
    const d = new Date(createdAt)
    return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${id}`
  }

  async function generateInvoice(userId: number, plan: string, amount: number) {
    setInvAction({ type: 'generating', id: userId })
    const r = await fetch('/api/admin/invoices/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, plan, amount }),
    })
    const d = await r.json()
    setInvAction(null)
    if (d.success) { flash(true, `Invoice ${d.invoiceNumber} created`); loadPayments() }
    else flash(false, d.error || 'Failed to generate invoice')
  }

  async function sendInvoice(id: number) {
    setInvAction({ type: 'sending', id })
    const r = await fetch(`/api/admin/invoices/${id}`, { method: 'POST' })
    const d = await r.json()
    setInvAction(null)
    if (d.success) flash(true, 'Invoice sent to client')
    else flash(false, d.error || 'Failed to send invoice')
  }

  async function toggleFeat(feature: string, plan: string, enabled: boolean) {
    setFeatSaving(true)
    setPlanFeats(prev => ({ ...prev, [plan]: { ...prev[plan], [feature]: enabled } }))
    await fetch('/api/admin/plan-features', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, plan, enabled }),
    })
    setFeatSaving(false)
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    loadStats()
    if (tab === 'overview' || tab === 'users') loadUsers()
    if (tab === 'payments') loadPayments()
    if (tab === 'settings') loadSettings()
    if (tab === 'plans') loadPlanFeats()
  }, [tab, status, loadStats, loadUsers, loadPayments, loadSettings, loadPlanFeats])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const today = useMemo(() => new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }), [])

  const ovUsers = useMemo(() => {
    let list = [...users]
    if (ovFilter === 'active') list = list.filter(u => u.role !== 'banned' && u.plan !== 'free')
    else if (ovFilter === 'banned') list = list.filter(u => u.role === 'banned')
    else if (ovFilter === 'free') list = list.filter(u => u.plan === 'free')
    if (ovSearch) list = list.filter(u => u.name.toLowerCase().includes(ovSearch.toLowerCase()) || u.email.toLowerCase().includes(ovSearch.toLowerCase()))
    return list
  }, [users, ovFilter, ovSearch])

  const planCounts = useMemo(() => {
    const counts: Record<string,number> = { free:0, starter:0, pro:0, business:0 }
    users.forEach(u => { counts[u.plan] = (counts[u.plan]||0)+1 })
    return counts
  }, [users])

  async function userAction(userId: number, action: string, extra?: Record<string, string>) {
    await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action, ...extra }) })
    loadUsers()
  }
  async function deleteUser(userId: number) {
    if (!confirm('Permanently delete this user?')) return
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    loadUsers()
  }
  async function saveSettings() {
    setSaving(true)
    const r = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) })
    setSaving(false); flash(r.ok, r.ok ? 'Saved!' : 'Failed')
  }
  async function saveSmtp() {
    setSaving(true)
    const r = await fetch('/api/admin/smtp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(smtp) })
    setSaving(false); flash(r.ok, r.ok ? 'SMTP saved!' : 'Failed')
  }
  async function updateAccount() {
    setSaving(true)
    const r = await fetch('/api/admin/account', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) })
    const d = await r.json(); setSaving(false); flash(r.ok, r.ok ? 'Account updated!' : d.error)
    if (r.ok) setAccount({ currentPassword: '', newEmail: '', newPassword: '' })
  }

  const displayStatus = (role: string) => role === 'user' ? 'active' : role
  const displayRole = (role: string) => role === 'admin' ? 'admin' : 'user'

  if (status === 'loading') return (
    <div className="min-h-screen bg-[#050A06] flex items-center justify-center text-[#4B6856] text-sm">Loading...</div>
  )

  const PAGE_TITLES: Record<Tab, { title: string; sub: string }> = {
    overview: { title: 'Overview',          sub: 'Platform stats at a glance' },
    users:    { title: 'User Management',   sub: 'Manage all registered users' },
    plans:    { title: 'Plan Settings',     sub: 'Configure pricing and lead limits' },
    payments: { title: 'Payments',          sub: 'Invoices and upcoming renewals' },
    settings: { title: 'Settings',          sub: 'Payment gateway, SMTP and account' },
  }

  return (
    <div className="flex h-screen bg-[#050A06] overflow-hidden" style={{ fontFamily: 'var(--font-bai, Bai Jamjuree), sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside className="w-44 shrink-0 flex flex-col bg-[#070D08] border-r border-[#0E1A0F]">

        {/* Logo */}
        <div className="px-5 pt-6 pb-4 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="LeadFrog" width={90} height={36} className="object-contain" />
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-[#A3E635]/10 text-[#A3E635]">Admin Panel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all cursor-pointer ${tab === id ? 'bg-[#A3E635]/10 text-[#A3E635] font-medium' : 'text-[#5A7A60] hover:text-[#C8E89A] hover:bg-[#0A150B]'}`}>
              <Icon size={15} strokeWidth={tab === id ? 2.5 : 1.8} />
              {label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5 pt-2 border-t border-[#0E1A0F]">
          <button onClick={() => setSignOutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#5A7A60] hover:text-red-400 hover:bg-[#0A150B] cursor-pointer transition-all text-left">
            <LogOut size={15} strokeWidth={1.8} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Page header — hidden on overview (has its own greeting) */}
        {tab !== 'overview' && (
          <div className="px-10 pt-8 pb-5 shrink-0">
            <div className="max-w-5xl mx-auto flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{PAGE_TITLES[tab].title}</h1>
                <p className="text-sm text-[#4B6856] mt-1">{PAGE_TITLES[tab].sub}</p>
              </div>
              {msg && (
                <div className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg ${msg.ok ? 'bg-[#A3E635]/10 text-[#A3E635]' : 'bg-red-500/10 text-red-400'}`}>
                  {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {msg.text}
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'overview' && msg && (
          <div className="px-8 pt-4 shrink-0">
            <div className={`inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg ${msg.ok ? 'bg-[#A3E635]/10 text-[#A3E635]' : 'bg-red-500/10 text-red-400'}`}>
              {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {msg.text}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-8 px-10">
          <div className={`${tab === 'overview' ? 'max-w-7xl' : 'max-w-5xl'} mx-auto space-y-5`}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Greeting */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{greeting}, {session?.user?.name?.split(' ')[0] || 'Admin'} 👋</h2>
                  <p className="text-sm text-[#4B6856] mt-0.5">{today}</p>
                </div>
                <button onClick={() => { loadStats(); loadUsers() }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#122016] text-[#5A7A60] hover:text-white text-xs cursor-pointer transition-all">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label:'Total Users',   sub:'Registered accounts', value: stats?.totalUsers  ?? '—', border:'border-t-red-600',    icon: Users,       iconColor:'text-red-500'    },
                  { label:'Active',        sub:'Paid subscribers',    value: stats?.activeUsers ?? '—', border:'border-t-[#A3E635]',  icon: CheckCircle, iconColor:'text-[#A3E635]'  },
                  { label:'Free Plan',     sub:'On free tier',        value: planCounts.free,           border:'border-t-amber-500',  icon: CreditCard,  iconColor:'text-amber-500'  },
                  { label:'Total Leads',   sub:'Across all users',    value: stats?.totalLeads  ?? '—', border:'border-t-blue-500',   icon: TrendingUp,  iconColor:'text-blue-400'   },
                  { label:'Revenue',       sub:'From subscriptions',  value: stats ? `₹${stats.revenue}` : '—', border:'border-t-purple-500', icon: IndianRupee, iconColor:'text-purple-400' },
                ].map(({ label, sub, value, border, icon: Icon, iconColor }) => (
                  <div key={label} className={`rounded-xl bg-[#0A110B] border border-[#122016] border-t-2 ${border} p-5`}>
                    <div className={`mb-3 ${iconColor}`}><Icon size={18} strokeWidth={1.8} /></div>
                    <div className="text-3xl font-bold text-white">{value}</div>
                    <div className="text-sm font-medium text-white/80 mt-1">{label}</div>
                    <div className="text-[11px] text-[#4B6856] mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>

              {/* Table + Right panel */}
              <div className="flex gap-5">

                {/* All Users table */}
                <div className="flex-1 rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[#122016]">
                    <div>
                      <div className="text-white font-semibold text-sm">All Users</div>
                      <div className="text-[#4B6856] text-[11px] mt-0.5">{ovUsers.length} of {users.length} shown</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                        <input value={ovSearch} onChange={e => setOvSearch(e.target.value)} placeholder="Search users..."
                          className="pl-8 pr-3 py-1.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-xs w-40 placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/30" />
                      </div>
                      {(['all','active','banned','free'] as const).map(f => (
                        <button key={f} onClick={() => setOvFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs capitalize cursor-pointer transition-all ${ovFilter===f ? 'bg-[#A3E635] text-black font-semibold' : 'text-[#5A7A60] border border-[#122016] hover:text-white'}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#0D160E]">
                        {['User','Plan','Status','Leads','Joined'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] text-[#4B6856] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ovUsers.slice(0,8).map((u,i) => {
                        const initials = u.name.split(' ').map((n:string)=>n[0]).join('').toUpperCase().slice(0,2)
                        const maxLeads = Math.max(...users.map(x=>x.lead_count),1)
                        const pct = Math.round((u.lead_count/maxLeads)*100)
                        return (
                          <tr key={u.id} className={`border-b border-[#0D160E] hover:bg-[#0D160E]/60 transition-colors ${i%2===1?'bg-[#070D08]/40':''}`}>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#1A2E10] flex items-center justify-center text-[#A3E635] text-[11px] font-bold shrink-0">{initials}</div>
                                <div>
                                  <div className="text-white text-xs font-medium">{u.name}</div>
                                  <div className="text-[#4B6856] text-[11px]">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${PLAN_BADGE[u.plan]||PLAN_BADGE.free}`}>
                                {u.plan.charAt(0).toUpperCase()+u.plan.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`flex items-center gap-1.5 text-[11px] font-medium ${STATUS_BADGE[u.role]||STATUS_BADGE.user}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.role==='banned'?'bg-red-400':u.role==='admin'?'bg-amber-400':'bg-[#A3E635]'}`}/>
                                {u.role==='user'?'Active':u.role.charAt(0).toUpperCase()+u.role.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-xs w-6 text-right">{u.lead_count}</span>
                                <div className="w-20 h-1.5 rounded-full bg-[#122016] overflow-hidden">
                                  <div className="h-full rounded-full bg-[#A3E635]" style={{width:`${pct}%`}}/>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-[#4B6856] text-[11px]">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                          </tr>
                        )
                      })}
                      {ovUsers.length===0 && (
                        <tr><td colSpan={5} className="px-5 py-10 text-center text-[#4B6856] text-sm">No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                  {users.length > 8 && (
                    <div className="px-5 py-3 border-t border-[#122016]">
                      <button onClick={() => setTab('users')} className="text-[#A3E635] text-xs hover:underline cursor-pointer">
                        View all {users.length} users →
                      </button>
                    </div>
                  )}
                </div>

                {/* Right panel */}
                <div className="w-64 shrink-0 space-y-4">

                  {/* Plan distribution */}
                  <div className="rounded-xl bg-[#0A110B] border border-[#122016] p-5">
                    <div className="text-white font-semibold text-sm mb-1">Plans</div>
                    <div className="text-[#4B6856] text-[11px] mb-4">User distribution by plan</div>
                    {/* Donut chart via SVG */}
                    <div className="flex justify-center mb-4">
                      {(() => {
                        const total = users.length || 1
                        const segs = [
                          { key:'free',     color:'#4B6856', count: planCounts.free     },
                          { key:'starter',  color:'#3B82F6', count: planCounts.starter  },
                          { key:'pro',      color:'#A3E635', count: planCounts.pro      },
                          { key:'business', color:'#A855F7', count: planCounts.business },
                        ].filter(s=>s.count>0)
                        const r=40, cx=50, cy=50, stroke=14
                        const circ = 2*Math.PI*r
                        let offset = 0
                        return (
                          <svg width="100" height="100" viewBox="0 0 100 100">
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#122016" strokeWidth={stroke}/>
                            {segs.map(s=>{
                              const dash=(s.count/total)*circ
                              const el=<circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                                strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset} style={{transformOrigin:'center',transform:'rotate(-90deg)'}}/>
                              offset+=dash; return el
                            })}
                            <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="bold">{users.length}</text>
                            <text x={cx} y={cy+13} textAnchor="middle" dominantBaseline="middle" fill="#4B6856" fontSize="7">users</text>
                          </svg>
                        )
                      })()}
                    </div>
                    <div className="space-y-2">
                      {[
                        { key:'free',     label:'Free',     color:'bg-[#4B6856]' },
                        { key:'starter',  label:'Starter',  color:'bg-blue-500'  },
                        { key:'pro',      label:'Pro',      color:'bg-[#A3E635]' },
                        { key:'business', label:'Business', color:'bg-purple-500'},
                      ].map(p=>(
                        <div key={p.key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${p.color}`}/>
                            <span className="text-[#94A3B8] text-xs">{p.label}</span>
                          </div>
                          <span className="text-white text-xs font-medium">{planCounts[p.key]||0}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status overview */}
                  <div className="rounded-xl bg-[#0A110B] border border-[#122016] p-5">
                    <div className="text-white font-semibold text-sm mb-4">Status Overview</div>
                    {[
                      { label:'Active',  color:'bg-[#A3E635]', textColor:'text-[#A3E635]', count: users.filter(u=>u.role!=='banned').length },
                      { label:'Banned',  color:'bg-red-500',   textColor:'text-red-400',   count: users.filter(u=>u.role==='banned').length  },
                      { label:'Free',    color:'bg-amber-500', textColor:'text-amber-400', count: planCounts.free },
                    ].map(s=>(
                      <div key={s.label} className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`flex items-center gap-1.5 text-xs ${s.textColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.color}`}/>{s.label}
                          </span>
                          <span className="text-white text-xs font-medium">{s.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#122016] overflow-hidden">
                          <div className={`h-full rounded-full ${s.color} transition-all`}
                            style={{width:`${users.length?Math.round((s.count/users.length)*100):0}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Activity */}
                  <div className="rounded-xl bg-[#0A110B] border border-[#122016] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-white font-semibold text-sm">Activity</div>
                      <Activity size={13} className="text-[#4B6856]"/>
                    </div>
                    <div className="space-y-3">
                      {users.slice(0,4).map(u=>(
                        <div key={u.id} className="flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] mt-1.5 shrink-0"/>
                          <div>
                            <div className="text-white text-[11px] font-medium">{u.name} joined</div>
                            <div className="text-[#4B6856] text-[10px] mt-0.5">{new Date(u.created_at).toLocaleDateString('en-GB')}</div>
                          </div>
                        </div>
                      ))}
                      {users.length===0 && <div className="text-[#4B6856] text-xs">No activity yet</div>}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#122016]">
                <span className="text-white font-semibold text-sm">
                  All Users <span className="text-[#4B6856] font-normal ml-1">({users.length})</span>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[#A3E635]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse inline-block" />
                  Live Data
                </span>
              </div>
              {loading
                ? <div className="p-12 text-center text-[#4B6856] text-sm">Loading...</div>
                : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#0D160E]">
                        {['Name', 'Email', 'Plan', 'Status', 'Leads', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-[11px] text-[#4B6856] uppercase tracking-wider font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id} className={`border-b border-[#0D160E] hover:bg-[#0D160E]/60 transition-colors ${i % 2 === 0 ? '' : 'bg-[#070D08]/40'}`}>
                          <td className="px-6 py-4 text-white font-medium">{u.name}</td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${PLAN_BADGE[u.plan] || PLAN_BADGE.free}`}>
                              {u.plan.charAt(0).toUpperCase() + u.plan.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_BADGE[u.role] || STATUS_BADGE.user}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.role === 'banned' ? 'bg-red-400' : u.role === 'admin' ? 'bg-amber-400' : 'bg-[#A3E635]'}`} />
                              {displayStatus(u.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{u.lead_count}</td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {/* Plan selector */}
                              <div className="relative">
                                <select
                                  value={u.plan}
                                  onChange={e => userAction(u.id, 'plan', { plan: e.target.value, cycle: 'monthly' })}
                                  className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-[#122016] border border-[#1A2E1A] text-[#94A3B8] text-xs cursor-pointer focus:outline-none focus:border-[#A3E635]/30"
                                >
                                  {['free', 'starter', 'pro', 'business'].map(p => (
                                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                  ))}
                                </select>
                                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4B6856] pointer-events-none" />
                              </div>
                              {/* Ban / Unban */}
                              {u.role === 'banned'
                                ? <button onClick={() => userAction(u.id, 'unban')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A2E10] text-[#A3E635] text-xs hover:bg-[#A3E635]/20 cursor-pointer transition-all">
                                    <ShieldCheck size={12} /> Unban
                                  </button>
                                : u.role !== 'admin' && (
                                  <button onClick={() => userAction(u.id, 'ban')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20 cursor-pointer transition-all">
                                    <ShieldOff size={12} /> Ban
                                  </button>
                                )
                              }
                              {/* Delete */}
                              {u.role !== 'admin' && (
                                <button onClick={() => deleteUser(u.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 cursor-pointer transition-all">
                                  <Trash2 size={12} /> Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={7} className="px-6 py-12 text-center text-[#4B6856] text-sm">No users yet</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
            </div>
          )}

          {/* ── PLANS ── */}
          {tab === 'plans' && (
            <div className="space-y-6">
            <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#122016]">
                <span className="text-white font-semibold text-sm">Plan Configuration</span>
              </div>
              <div className="p-6 space-y-4">
                {(['starter', 'pro', 'business'] as const).map(plan => (
                  <div key={plan} className="flex items-center gap-6 p-5 rounded-xl border border-[#122016] bg-[#070D08]">
                    <span className={`w-24 px-3 py-1.5 rounded-lg text-xs font-semibold text-center ${PLAN_BADGE[plan]}`}>
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </span>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Price (₹ / month)</label>
                        <input type="number" value={settings[`${plan}_price` as keyof AdminSettings]}
                          onChange={e => setSettings(s => ({ ...s, [`${plan}_price`]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-[#0A110B] border border-[#122016] text-white text-sm focus:outline-none focus:border-[#A3E635]/40" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Lead Limit / month</label>
                        <input type="number" value={settings[`${plan}_leads` as keyof AdminSettings]}
                          onChange={e => setSettings(s => ({ ...s, [`${plan}_leads`]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg bg-[#0A110B] border border-[#122016] text-white text-sm focus:outline-none focus:border-[#A3E635]/40" />
                      </div>
                    </div>
                    <div className="text-xs text-[#4B6856] w-36 text-right">
                      {Number(settings[`${plan}_leads` as keyof AdminSettings]).toLocaleString()} leads<br />
                      <span className="text-white font-medium">₹{settings[`${plan}_price` as keyof AdminSettings]}/mo</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <button onClick={saveSettings} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#A3E635] text-black text-sm font-semibold hover:bg-[#B5F045] transition-all cursor-pointer disabled:opacity-50">
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Plan Config'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Feature Permissions Matrix ── */}
            <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden mt-6">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#122016]">
                <div>
                  <span className="text-white font-semibold text-sm">Feature Permissions</span>
                  <p className="text-[11px] text-[#4B6856] mt-0.5">Toggle which features each plan can access. Changes apply immediately.</p>
                </div>
                {featSaving && <span className="text-[10px] text-[#A3E635] animate-pulse">Saving…</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#122016]">
                      <th className="px-6 py-3 text-left text-[11px] font-semibold text-[#4B6856] uppercase tracking-wider w-64">Feature</th>
                      {FEAT_PLANS.map(p => (
                        <th key={p} className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider">
                          <span className={`px-2 py-1 rounded-md ${PLAN_BADGE[p]}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEAT_KEYS.map((feat, fi) => (
                      <tr key={feat} className={fi % 2 === 0 ? 'bg-[#070D08]' : ''}>
                        <td className="px-6 py-3.5 text-[#94A3B8] text-[13px]">{FEAT_LABELS[feat]}</td>
                        {FEAT_PLANS.map(plan => {
                          const enabled = planFeats[plan]?.[feat] ?? false
                          return (
                            <td key={plan} className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => toggleFeat(feat, plan, !enabled)}
                                className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer focus:outline-none ${enabled ? 'bg-[#A3E635]' : 'bg-[#1A2B1C]'}`}
                                title={enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                              >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${enabled ? 'left-5' : 'left-0.5'}`} />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && payData && (
            <div className="space-y-6">
              {/* 4 stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Upcoming (30 days)', value: payData.stats.upcomingCount, icon: '📅', color: 'text-blue-400',   border: 'border-t-blue-500/40',   bg: 'bg-blue-500/5' },
                  { label: 'Revenue Collected',  value: `₹${payData.stats.revenue.toLocaleString()}`, icon: '₹', color: 'text-[#A3E635]', border: 'border-t-[#A3E635]/40', bg: 'bg-[#A3E635]/5' },
                  { label: 'Pending Amount',     value: `₹${payData.stats.pending.toLocaleString()}`, icon: '⏱', color: 'text-amber-400',  border: 'border-t-amber-500/40', bg: 'bg-amber-500/5' },
                  { label: 'Overdue Invoices',   value: payData.stats.overdue, icon: '⚠', color: 'text-red-400',    border: 'border-t-red-500/40',   bg: 'bg-red-500/5' },
                ].map(({ label, value, color, border, bg }) => (
                  <div key={label} className={`rounded-xl bg-[#0A110B] border border-[#122016] border-t-2 ${border} ${bg} p-5`}>
                    <div className="text-[11px] font-semibold text-[#4B6856] uppercase tracking-wider mb-3">{label}</div>
                    <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-0 border-b border-[#122016]">
                {([
                  ['upcoming', 'Upcoming Payments'],
                  ['invoices', 'Invoices'],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setPaySubTab(key)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all cursor-pointer
                      ${paySubTab === key ? 'border-[#A3E635] text-[#A3E635]' : 'border-transparent text-[#4B6856] hover:text-white'}`}>
                    {label}
                  </button>
                ))}
                <button onClick={loadPayments}
                  className="ml-auto mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A110B] border border-[#122016] text-[#4B6856] hover:text-white text-xs cursor-pointer transition-all">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {/* Upcoming Payments */}
              {paySubTab === 'upcoming' && (
                <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#122016]">
                    <div className="font-bold text-sm text-white">Clients with Billing Due in 30 Days</div>
                  </div>
                  {payData.upcoming.length === 0 ? (
                    <div className="p-12 text-center text-[#4B6856] text-sm">No upcoming renewals in the next 30 days.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#0D160E] text-[10px] font-semibold text-[#4B6856] uppercase tracking-wider">
                          <th className="px-6 py-3 text-left">Client</th>
                          <th className="px-6 py-3 text-left">Plan</th>
                          <th className="px-6 py-3 text-left">Billing Date</th>
                          <th className="px-6 py-3 text-left">Days Left</th>
                          <th className="px-6 py-3 text-left">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payData.upcoming.map((u, i) => (
                          <tr key={u.id} className={`hover:bg-[#0D160E]/60 transition-colors ${i < payData.upcoming.length - 1 ? 'border-b border-[#0D160E]' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{u.name}</div>
                              <div className="text-xs text-[#4B6856]">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PLAN_BADGE[u.plan] || ''}`}>
                                {u.plan.charAt(0).toUpperCase() + u.plan.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-[#8FA896]">
                              {new Date(u.plan_expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                                ${u.days_left <= 5 ? 'bg-red-500/15 text-red-400' : u.days_left <= 10 ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                {u.days_left} days
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => generateInvoice(u.id, u.plan, Number(settings[`${u.plan}_price` as keyof AdminSettings]) || 499)}
                                disabled={invAction?.type === 'generating' && invAction.id === u.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#A3E635]/10 border border-[#A3E635]/20 text-[#A3E635] text-xs font-semibold hover:bg-[#A3E635]/20 cursor-pointer transition-colors disabled:opacity-50">
                                {invAction?.type === 'generating' && invAction.id === u.id ? 'Generating…' : '+ Generate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Invoices */}
              {paySubTab === 'invoices' && (
                <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                  {(payData.invoices as Invoice[]).length === 0 ? (
                    <div className="p-12 text-center text-[#4B6856] text-sm">No invoices yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#0D160E] text-[10px] font-semibold text-[#4B6856] uppercase tracking-wider">
                          <th className="px-6 py-3 text-left">Invoice</th>
                          <th className="px-6 py-3 text-left">Client</th>
                          <th className="px-6 py-3 text-left">Plan</th>
                          <th className="px-6 py-3 text-left">Date</th>
                          <th className="px-6 py-3 text-left">Amount</th>
                          <th className="px-6 py-3 text-left">Status</th>
                          <th className="px-6 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(payData.invoices as Invoice[]).map((inv, i) => (
                          <tr key={inv.id} className={`hover:bg-[#0D160E]/60 transition-colors ${i < (payData.invoices as Invoice[]).length - 1 ? 'border-b border-[#0D160E]' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="text-[#A3E635] font-mono text-xs font-bold">{invNum(inv.id, inv.created_at)}</div>
                              <div className="text-[10px] text-[#4B6856] mt-0.5">{new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{inv.user_name}</div>
                              <div className="text-xs text-[#4B6856]">{inv.user_email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${PLAN_BADGE[inv.plan] || ''}`}>
                                {inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-[#8FA896]">
                              {new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-white font-bold">₹{Math.round(inv.amount / 100).toLocaleString('en-IN')}</td>
                            <td className="px-6 py-4">
                              <span className={`flex items-center gap-1.5 text-xs font-semibold w-fit px-2.5 py-1 rounded-full
                                ${inv.status === 'active' || inv.status === 'paid' ? 'bg-[#A3E635]/10 text-[#A3E635]'
                                  : inv.status === 'pending' ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-red-500/10 text-red-400'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'active' || inv.status === 'paid' ? 'bg-[#A3E635]' : inv.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} />
                                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {/* View */}
                                <a href={`/api/admin/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer"
                                  title="View Invoice"
                                  className="p-1.5 rounded-lg text-[#4B6856] hover:text-white hover:bg-[#122016] transition-colors cursor-pointer">
                                  <Eye size={14} />
                                </a>
                                {/* Download (same page, print dialog) */}
                                <a href={`/api/admin/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer"
                                  title="Download Invoice"
                                  className="p-1.5 rounded-lg text-[#4B6856] hover:text-[#A3E635] hover:bg-[#122016] transition-colors cursor-pointer">
                                  <Download size={14} />
                                </a>
                                {/* Send email */}
                                <button onClick={() => sendInvoice(inv.id)} title="Send to Client"
                                  disabled={invAction?.type === 'sending' && invAction.id === inv.id}
                                  className="p-1.5 rounded-lg text-[#4B6856] hover:text-blue-400 hover:bg-[#122016] transition-colors cursor-pointer disabled:opacity-40">
                                  {invAction?.type === 'sending' && invAction.id === inv.id
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <Mail size={14} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <div className="space-y-5 max-w-3xl">

              {/* Razorpay */}
              <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[#122016]">
                  <Key size={15} className="text-[#A3E635]" />
                  <div>
                    <div className="text-white font-semibold text-sm">Razorpay Payment Keys</div>
                    <div className="text-[#4B6856] text-xs">Configure your payment gateway</div>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">Mode</label>
                    <select value={settings.razorpay_mode} onChange={e => setSettings(s => ({ ...s, razorpay_mode: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm cursor-pointer focus:outline-none focus:border-[#A3E635]/40">
                      <option value="test">Test Mode</option>
                      <option value="live">Live Mode</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">Key ID</label>
                    <input value={settings.razorpay_key_id} onChange={e => setSettings(s => ({ ...s, razorpay_key_id: e.target.value }))}
                      placeholder="rzp_test_xxxxxxxxxxxx"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm font-mono placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">Key Secret</label>
                    <div className="relative">
                      <input type={showSecret ? 'text' : 'password'} value={settings.razorpay_key_secret}
                        onChange={e => setSettings(s => ({ ...s, razorpay_key_secret: e.target.value }))}
                        placeholder="Secret key"
                        className="w-full px-3 pr-9 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm font-mono placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                      <button type="button" onClick={() => setShowSecret(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer">
                        {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-5">
                  <button onClick={saveSettings} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#A3E635] text-black text-sm font-semibold hover:bg-[#B5F045] transition-all cursor-pointer disabled:opacity-50">
                    <Save size={14} /> {saving ? 'Saving...' : 'Save Keys'}
                  </button>
                </div>
              </div>

              {/* SMTP */}
              <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[#122016]">
                  <Mail size={15} className="text-[#A3E635]" />
                  <div>
                    <div className="text-white font-semibold text-sm">SMTP / Email</div>
                    <div className="text-[#4B6856] text-xs">For invoices and notifications</div>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  {[
                    { key: 'smtp_host',        label: 'SMTP Host',    placeholder: 'smtp.gmail.com' },
                    { key: 'smtp_port',        label: 'Port',         placeholder: '465' },
                    { key: 'smtp_user',        label: 'Gmail / User', placeholder: 'you@gmail.com' },
                    { key: 'smtp_from_name',   label: 'From Name',    placeholder: 'LeadFrog' },
                    { key: 'smtp_admin_email', label: 'Admin Email',  placeholder: 'admin@domain.com' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">{label}</label>
                      <input value={smtp[key] || ''} onChange={e => setSmtp(s => ({ ...s, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">App Password</label>
                    <div className="relative">
                      <input
                        type={showSmtpPass ? 'text' : 'password'}
                        value={smtp.smtp_pass === '••••••••' ? '' : (smtp.smtp_pass || '')}
                        onChange={e => setSmtp(s => ({ ...s, smtp_pass: e.target.value }))}
                        onFocus={() => { if (smtp.smtp_pass === '••••••••') setSmtp(s => ({ ...s, smtp_pass: '' })) }}
                        placeholder={smtp.smtp_pass === '••••••••' ? '● Saved — enter new password to change' : 'Gmail App Password'}
                        className="w-full px-3 pr-9 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm placeholder:text-[#4B6856] focus:outline-none focus:border-[#A3E635]/40" />
                      <button type="button" onClick={() => setShowSmtpPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer z-10">
                        {showSmtpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                  <button onClick={saveSmtp} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#A3E635] text-black text-sm font-semibold hover:bg-[#B5F045] transition-all cursor-pointer disabled:opacity-50">
                    <Save size={14} /> Save SMTP
                  </button>
                  <button onClick={async () => { const r = await fetch('/api/admin/smtp', { method: 'POST' }); const d = await r.json(); flash(r.ok, d.message || d.error) }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#122016] text-[#5A7A60] hover:text-white text-sm cursor-pointer transition-all">
                    <Mail size={14} /> Send Test
                  </button>
                </div>
              </div>

              {/* Admin Account */}
              <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[#122016]">
                  <User size={15} className="text-[#A3E635]" />
                  <div>
                    <div className="text-white font-semibold text-sm">Admin Account</div>
                    <div className="text-[#4B6856] text-xs">Change email or password</div>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">New Email <span className="normal-case">(optional)</span></label>
                    <input type="email" value={account.newEmail} onChange={e => setAccount(a => ({ ...a, newEmail: e.target.value }))}
                      placeholder={session?.user?.email || ''}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">New Password <span className="normal-case">(optional)</span></label>
                    <div className="relative">
                      <input type={showNewPw ? 'text' : 'password'} value={account.newPassword}
                        onChange={e => setAccount(a => ({ ...a, newPassword: e.target.value }))}
                        placeholder="Min 8 characters"
                        className="w-full px-3 pr-9 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                      <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer">
                        {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-2">Current Password <span className="text-red-400">*</span></label>
                    <div className="relative w-1/2">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                      <input type="password" value={account.currentPassword}
                        onChange={e => setAccount(a => ({ ...a, currentPassword: e.target.value }))}
                        placeholder="Required to save changes"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-5">
                  <button onClick={updateAccount} disabled={saving || !account.currentPassword}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#A3E635] text-black text-sm font-semibold hover:bg-[#B5F045] transition-all cursor-pointer disabled:opacity-50">
                    <Save size={14} /> Update Account
                  </button>
                </div>
              </div>

            </div>
          )}

          </div>
        </div>
      </div>

      {/* Sign-out confirmation modal */}
      {signOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0A110B] border border-[#1A321E] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-bold text-base mb-1">Sign out?</h3>
            <p className="text-[#4B6856] text-sm mb-5">You will be returned to the login page.</p>
            <div className="flex gap-3">
              <button onClick={() => setSignOutConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#1A321E] text-[#94A3B8] text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors">
                Cancel
              </button>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 cursor-pointer transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

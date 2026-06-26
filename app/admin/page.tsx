'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, Users, CreditCard, IndianRupee, Settings, LogOut,
  Eye, EyeOff, Save, Trash2, ShieldOff, ShieldCheck,
  CheckCircle, AlertCircle, Globe, Key, Mail, Lock, User, ChevronDown
} from 'lucide-react'

/* ── Types ── */
interface Stat { totalUsers: number; activeUsers: number; totalLeads: number; revenue: number }
interface DbUser { id: number; name: string; email: string; role: string; plan: string; plan_expires_at: string | null; lead_count: number; created_at: string }
interface Invoice { id: number; plan: string; amount: number; status: string; created_at: string; user_name: string; user_email: string }
interface Upcoming { id: number; name: string; email: string; plan: string; plan_expires_at: string; days_left: number }
interface PayData { invoices: Invoice[]; upcoming: Upcoming[]; stats: { revenue: number; pending: number; upcomingCount: number } }
interface AdminSettings { razorpay_key_id: string; razorpay_key_secret: string; razorpay_mode: string; starter_price: string; pro_price: string; business_price: string; starter_leads: string; pro_leads: string; business_leads: string }

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
  const [settings, setSettings] = useState<AdminSettings>({ razorpay_key_id: '', razorpay_key_secret: '', razorpay_mode: 'test', starter_price: '499', pro_price: '999', business_price: '2499', starter_leads: '500', pro_leads: '2000', business_leads: '10000' })
  const [smtp, setSmtp] = useState<Record<string, string>>({ smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_user: '', smtp_pass: '', smtp_from_name: 'LeadFrog', smtp_admin_email: '' })
  const [account, setAccount] = useState({ currentPassword: '', newEmail: '', newPassword: '' })
  const [showSecret, setShowSecret] = useState(false)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (status !== 'authenticated') return
    loadStats()
    if (tab === 'users') loadUsers()
    if (tab === 'payments') loadPayments()
    if (tab === 'settings') loadSettings()
  }, [tab, status, loadStats, loadUsers, loadPayments, loadSettings])

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
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#5A7A60] hover:text-red-400 hover:bg-[#0A150B] cursor-pointer transition-all text-left">
            <LogOut size={15} strokeWidth={1.8} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Page header */}
        <div className="px-8 pt-8 pb-5 shrink-0">
          <div className="flex items-start justify-between">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-5">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Users',  value: stats?.totalUsers  ?? '—', icon: Users,          color: 'text-[#A3E635]' },
                  { label: 'Paid Users',   value: stats?.activeUsers ?? '—', icon: CreditCard,     color: 'text-blue-400' },
                  { label: 'Total Leads',  value: stats?.totalLeads  ?? '—', icon: Globe,          color: 'text-purple-400' },
                  { label: 'Revenue (₹)',  value: stats ? `₹${stats.revenue}` : '—', icon: IndianRupee, color: 'text-amber-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl bg-[#0A110B] border border-[#122016] p-5">
                    <div className={`mb-3 ${color}`}><Icon size={18} strokeWidth={1.8} /></div>
                    <div className="text-3xl font-bold text-white">{value}</div>
                    <div className="text-xs text-[#4B6856] mt-1.5">{label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-[#0A110B] border border-[#122016] p-6">
                <p className="text-sm text-[#4B6856] mb-4">Quick navigation</p>
                <div className="flex gap-3 flex-wrap">
                  {NAV.filter(n => n.id !== 'overview').map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#122016] text-[#5A7A60] hover:border-[#A3E635]/30 hover:text-[#A3E635] transition-all cursor-pointer text-sm">
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
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
          )}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && payData && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Revenue Collected', value: `₹${payData.stats.revenue}` },
                  { label: 'Pending Amount',    value: `₹${payData.stats.pending}` },
                  { label: 'Renewals (30 days)', value: payData.stats.upcomingCount },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-[#0A110B] border border-[#122016] p-5">
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="text-xs text-[#4B6856] mt-1.5">{label}</div>
                  </div>
                ))}
              </div>

              {payData.upcoming.length > 0 && (
                <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#122016] text-white font-semibold text-sm">Upcoming Renewals</div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#0D160E]">
                      {['User', 'Email', 'Plan', 'Expires', 'Days Left'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-[11px] text-[#4B6856] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {payData.upcoming.map(u => (
                        <tr key={u.id} className="border-b border-[#0D160E] hover:bg-[#0D160E]/60">
                          <td className="px-6 py-4 text-white">{u.name}</td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{u.email}</td>
                          <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-md text-xs font-medium ${PLAN_BADGE[u.plan] || ''}`}>{u.plan}</span></td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{new Date(u.plan_expires_at).toLocaleDateString('en-GB')}</td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold ${u.days_left <= 7 ? 'text-red-400' : u.days_left <= 15 ? 'text-amber-400' : 'text-[#A3E635]'}`}>{u.days_left}d</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-xl bg-[#0A110B] border border-[#122016] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#122016]">
                  <span className="text-white font-semibold text-sm">Invoices</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#A3E635]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse inline-block" /> Live Data
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[#0D160E]">
                    {['User', 'Email', 'Plan', 'Amount', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] text-[#4B6856] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(payData.invoices as Invoice[]).length === 0
                      ? <tr><td colSpan={6} className="px-6 py-12 text-center text-[#4B6856] text-sm">No invoices yet</td></tr>
                      : (payData.invoices as Invoice[]).map((inv, i) => (
                        <tr key={inv.id} className={`border-b border-[#0D160E] hover:bg-[#0D160E]/60 ${i % 2 === 0 ? '' : 'bg-[#070D08]/40'}`}>
                          <td className="px-6 py-4 text-white">{inv.user_name}</td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{inv.user_email}</td>
                          <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-md text-xs font-medium ${PLAN_BADGE[inv.plan] || ''}`}>{inv.plan}</span></td>
                          <td className="px-6 py-4 text-white font-medium">₹{Math.round(inv.amount / 100)}</td>
                          <td className="px-6 py-4 text-[#5A7A60] text-xs">{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                          <td className="px-6 py-4">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_BADGE[inv.status] || ''}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'active' || inv.status === 'paid' ? 'bg-[#A3E635]' : inv.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} />
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
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
                      <input type={showSmtpPass ? 'text' : 'password'} value={smtp.smtp_pass || ''}
                        onChange={e => setSmtp(s => ({ ...s, smtp_pass: e.target.value }))}
                        placeholder="Gmail App Password"
                        className="w-full px-3 pr-9 py-2.5 rounded-lg bg-[#070D08] border border-[#122016] text-white text-sm placeholder:text-[#2A3D2A] focus:outline-none focus:border-[#A3E635]/40" />
                      <button type="button" onClick={() => setShowSmtpPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer">
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
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, Users, CreditCard, IndianRupee, Settings,
  LogOut, Eye, EyeOff, Save, Trash2, ShieldOff, ShieldCheck,
  CheckCircle, AlertCircle, RefreshCw, Key, Mail, Lock, User
} from 'lucide-react'

/* ── Types ── */
interface Stat { totalUsers:number; activeUsers:number; totalLeads:number; revenue:number }
interface DbUser { id:number; name:string; email:string; role:string; plan:string; plan_expires_at:string|null; lead_count:number; created_at:string }
interface Invoice { id:number; plan:string; amount:number; status:string; created_at:string; user_name:string; user_email:string; razorpay_payment_id:string }
interface Upcoming { id:number; name:string; email:string; plan:string; plan_expires_at:string; days_left:number }
interface PayData { invoices:Invoice[]; upcoming:Upcoming[]; stats:{revenue:number;pending:number;upcomingCount:number} }
interface AdminSettings { razorpay_key_id:string; razorpay_key_secret:string; razorpay_mode:string; starter_price:string; pro_price:string; business_price:string; starter_leads:string; pro_leads:string; business_leads:string }

const PLAN_COLORS: Record<string,string> = {
  free:'bg-[#4B6856]/20 text-[#4B6856]', starter:'bg-blue-500/15 text-blue-400',
  pro:'bg-[#A3E635]/10 text-[#A3E635]', business:'bg-purple-500/15 text-purple-400'
}
const STATUS_COLORS: Record<string,string> = {
  active:'bg-[#A3E635]/10 text-[#A3E635]', paid:'bg-[#A3E635]/10 text-[#A3E635]',
  pending:'bg-amber-500/10 text-amber-400', failed:'bg-red-500/10 text-red-400', banned:'bg-red-500/10 text-red-400'
}

type Tab = 'overview'|'users'|'plans'|'payments'|'settings'

const NAV: {id:Tab; label:string; icon: React.ElementType}[] = [
  { id:'overview', label:'Overview', icon:LayoutDashboard },
  { id:'users',    label:'Users',    icon:Users },
  { id:'plans',    label:'Plans',    icon:CreditCard },
  { id:'payments', label:'Payments', icon:IndianRupee },
  { id:'settings', label:'Settings', icon:Settings },
]

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stat|null>(null)
  const [users, setUsers] = useState<DbUser[]>([])
  const [payData, setPayData] = useState<PayData|null>(null)
  const [settings, setSettings] = useState<AdminSettings>({ razorpay_key_id:'', razorpay_key_secret:'', razorpay_mode:'test', starter_price:'499', pro_price:'999', business_price:'2499', starter_leads:'500', pro_leads:'2000', business_leads:'10000' })
  const [smtp, setSmtp] = useState<Record<string,string>>({ smtp_host:'smtp.gmail.com', smtp_port:'465', smtp_user:'', smtp_pass:'', smtp_from_name:'LeadFrog', smtp_admin_email:'' })
  const [account, setAccount] = useState({ currentPassword:'', newEmail:'', newPassword:'' })
  const [showSecret, setShowSecret] = useState(false)
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ok:boolean;text:string}|null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && (session?.user as {role?:string})?.role !== 'admin') router.push('/dashboard')
  }, [status, session, router])

  const showMsg = (ok: boolean, text: string) => { setMsg({ok,text}); setTimeout(()=>setMsg(null), 4000) }

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/stats'); const d = await r.json(); setStats(d)
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/users'); const d = await r.json()
    setUsers(d.users || []); setLoading(false)
  }, [])

  const loadPayments = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/admin/payments'); const d = await r.json()
    setPayData(d); setLoading(false)
  }, [])

  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/admin/settings'); const d = await r.json()
    if (d.settings) setSettings(s => ({...s, ...d.settings}))
    const r2 = await fetch('/api/admin/smtp'); const d2 = await r2.json()
    if (d2.smtp) setSmtp(s => ({...s, ...d2.smtp}))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    loadStats()
    if (tab === 'users') loadUsers()
    if (tab === 'payments') loadPayments()
    if (tab === 'settings') loadSettings()
  }, [tab, status, loadStats, loadUsers, loadPayments, loadSettings])

  async function userAction(userId:number, action:string, extra?:Record<string,string>) {
    await fetch('/api/admin/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId,action,...extra}) })
    loadUsers()
  }
  async function deleteUser(userId:number) {
    if (!confirm('Delete this user permanently?')) return
    await fetch('/api/admin/users', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId}) })
    loadUsers()
  }

  async function saveSettings() {
    setSaving(true)
    const r = await fetch('/api/admin/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({settings}) })
    setSaving(false); showMsg(r.ok, r.ok ? 'Settings saved!' : 'Failed to save')
  }
  async function saveSmtp() {
    setSaving(true)
    const r = await fetch('/api/admin/smtp', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(smtp) })
    setSaving(false); showMsg(r.ok, r.ok ? 'SMTP settings saved!' : 'Failed to save')
  }
  async function updateAccount() {
    setSaving(true)
    const r = await fetch('/api/admin/account', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(account) })
    const d = await r.json(); setSaving(false)
    showMsg(r.ok, r.ok ? 'Account updated!' : d.error)
    if (r.ok) setAccount({currentPassword:'',newEmail:'',newPassword:''})
  }

  if (status === 'loading') return <div className="min-h-screen bg-[#050A06] flex items-center justify-center text-[#4B6856]">Loading...</div>

  return (
    <div className="flex h-screen bg-[#050A06] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-[#122016] bg-[#070D08]">
        <div className="p-4 border-b border-[#122016] flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="LeadFrog" width={110} height={44} className="object-contain" />
          <span className="text-[8px] text-[#4B6856] tracking-widest uppercase">Lead Intelligence</span>
        </div>

        <nav className="flex-1 p-3 space-y-1 text-sm">
          <div className="text-[10px] text-[#4B6856] uppercase tracking-wider px-3 py-2">Admin Panel</div>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer transition-all ${tab === id ? 'bg-[#0A1F0C] text-[#A3E635]' : 'text-[#94A3B8] hover:text-white hover:bg-[#0A110B]'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        <div className="p-3 space-y-1 text-sm border-t border-[#122016]">
          <div className="text-[10px] text-[#4B6856] uppercase tracking-wider px-3 py-2">Navigation</div>
          <button onClick={() => router.push('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#0A110B] cursor-pointer transition-all text-left">
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-[#0A110B] cursor-pointer transition-all text-left">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
        <div className="p-3 text-[10px] text-[#4B6856] text-center border-t border-[#122016]">LeadFrog © 2025</div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[#122016] shrink-0">
          <span className="text-white font-semibold">{NAV.find(n=>n.id===tab)?.label}</span>
          <div className="flex items-center gap-3">
            {msg && (
              <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${msg.ok ? 'bg-[#A3E635]/10 border-[#A3E635]/20 text-[#A3E635]' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                {msg.ok ? <CheckCircle size={12}/> : <AlertCircle size={12}/>} {msg.text}
              </div>
            )}
            <button onClick={()=>{ if(tab==='users') loadUsers(); if(tab==='payments') loadPayments(); loadStats() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#94A3B8] border border-[#122016] hover:text-white cursor-pointer">
              <RefreshCw size={12}/> Refresh
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-dark">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label:'Total Users', value: stats?.totalUsers ?? '—', icon: Users },
                  { label:'Paid Users',  value: stats?.activeUsers ?? '—', icon: CreditCard },
                  { label:'Total Leads', value: stats?.totalLeads ?? '—', icon: LayoutDashboard },
                  { label:'Revenue (₹)', value: stats ? `₹${stats.revenue}` : '—', icon: IndianRupee },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="glass-card p-5">
                    <Icon size={16} className="text-[#4B6856] mb-3" />
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="text-xs text-[#4B6856] mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <div className="glass-card p-5">
                <div className="text-white font-semibold mb-4 text-sm">Quick Actions</div>
                <div className="flex gap-3 flex-wrap">
                  {NAV.filter(n=>n.id!=='overview').map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#122016] text-[#94A3B8] hover:border-[#A3E635]/30 hover:text-[#A3E635] transition-all cursor-pointer text-sm">
                      <Icon size={14}/> {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-[#122016] flex items-center justify-between">
                <span className="text-white font-semibold text-sm">All Users <span className="text-[#4B6856] font-normal">({users.length})</span></span>
              </div>
              {loading ? <div className="p-8 text-center text-[#4B6856] text-sm">Loading...</div> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#122016]">
                      {['Name','Email','Plan','Leads','Expires','Role','Actions'].map(h => (
                        <th key={h} className="p-3 text-left text-[10px] text-[#4B6856] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-[#0A110B] hover:bg-[#0A110B]/50 transition-colors">
                        <td className="p-3 text-white font-medium">{u.name}</td>
                        <td className="p-3 text-[#94A3B8] text-xs">{u.email}</td>
                        <td className="p-3">
                          <select value={u.plan} onChange={e => userAction(u.id, 'plan', { plan: e.target.value, cycle: 'monthly' })}
                            className="input-dark px-2 py-1 rounded-lg text-xs cursor-pointer">
                            {['free','starter','pro','business'].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="p-3 text-[#94A3B8] text-xs">{u.lead_count}</td>
                        <td className="p-3 text-[#94A3B8] text-xs">{u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString() : '—'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLORS[u.role] || STATUS_COLORS.pending}`}>{u.role}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {u.role === 'banned'
                              ? <button onClick={() => userAction(u.id,'unban')} title="Unban" className="p-1.5 rounded-lg bg-[#A3E635]/10 text-[#A3E635] hover:bg-[#A3E635]/20 cursor-pointer"><ShieldCheck size={13}/></button>
                              : u.role !== 'admin' && <button onClick={() => userAction(u.id,'ban')} title="Ban" className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 cursor-pointer"><ShieldOff size={13}/></button>
                            }
                            {u.role !== 'admin' && (
                              <button onClick={() => deleteUser(u.id)} title="Delete" className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"><Trash2 size={13}/></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── PLANS ── */}
          {tab === 'plans' && (
            <div className="space-y-4 max-w-3xl">
              <div className="glass-card p-6">
                <div className="text-white font-semibold mb-5 text-sm">Plan Pricing & Limits</div>
                <div className="space-y-5">
                  {(['starter','pro','business'] as const).map(plan => (
                    <div key={plan} className="grid grid-cols-3 gap-4 p-4 rounded-xl border border-[#122016]">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-xs ${PLAN_COLORS[plan]} mb-3 inline-block capitalize`}>{plan}</span>
                        <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Price (₹/mo)</label>
                        <input type="number" value={settings[`${plan}_price` as keyof AdminSettings]}
                          onChange={e => setSettings(s=>({...s,[`${plan}_price`]:e.target.value}))}
                          className="input-dark w-full px-3 py-2 rounded-xl text-sm" />
                      </div>
                      <div className="pt-8">
                        <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Lead Limit / mo</label>
                        <input type="number" value={settings[`${plan}_leads` as keyof AdminSettings]}
                          onChange={e => setSettings(s=>({...s,[`${plan}_leads`]:e.target.value}))}
                          className="input-dark w-full px-3 py-2 rounded-xl text-sm" />
                      </div>
                      <div className="pt-8 flex items-end">
                        <span className="text-[#4B6856] text-xs">{Number(settings[`${plan}_leads` as keyof AdminSettings]).toLocaleString()} leads for ₹{settings[`${plan}_price` as keyof AdminSettings]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={saveSettings} disabled={saving}
                  className="btn-lime flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm mt-5 disabled:opacity-50">
                  <Save size={14}/> {saving ? 'Saving...' : 'Save Plan Config'}
                </button>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && payData && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label:'Revenue Collected', value:`₹${payData.stats.revenue}` },
                  { label:'Pending Amount',    value:`₹${payData.stats.pending}` },
                  { label:'Renewals (30 days)',value: payData.stats.upcomingCount },
                ].map(({ label, value }) => (
                  <div key={label} className="glass-card p-5">
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="text-xs text-[#4B6856] mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {payData.upcoming.length > 0 && (
                <div className="glass-card overflow-hidden">
                  <div className="p-4 border-b border-[#122016] text-white font-semibold text-sm">Upcoming Renewals</div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#122016]">
                      {['User','Email','Plan','Expires','Days Left'].map(h=>(
                        <th key={h} className="p-3 text-left text-[10px] text-[#4B6856] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {payData.upcoming.map(u=>(
                        <tr key={u.id} className="border-b border-[#0A110B]">
                          <td className="p-3 text-white">{u.name}</td>
                          <td className="p-3 text-[#94A3B8] text-xs">{u.email}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] ${PLAN_COLORS[u.plan]}`}>{u.plan}</span></td>
                          <td className="p-3 text-[#94A3B8] text-xs">{new Date(u.plan_expires_at).toLocaleDateString()}</td>
                          <td className="p-3"><span className={`text-xs font-medium ${u.days_left<=7?'text-red-400':u.days_left<=15?'text-amber-400':'text-[#A3E635]'}`}>{u.days_left}d</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-[#122016] text-white font-semibold text-sm">Invoices</div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[#122016]">
                    {['User','Email','Plan','Amount','Date','Status'].map(h=>(
                      <th key={h} className="p-3 text-left text-[10px] text-[#4B6856] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(payData.invoices as unknown as Invoice[]).length === 0
                      ? <tr><td colSpan={6} className="p-8 text-center text-[#4B6856] text-sm">No invoices yet</td></tr>
                      : (payData.invoices as unknown as Invoice[]).map(inv=>(
                        <tr key={inv.id} className="border-b border-[#0A110B] hover:bg-[#0A110B]/50">
                          <td className="p-3 text-white">{inv.user_name}</td>
                          <td className="p-3 text-[#94A3B8] text-xs">{inv.user_email}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] ${PLAN_COLORS[inv.plan]||''}`}>{inv.plan}</span></td>
                          <td className="p-3 text-white font-medium">₹{Math.round(inv.amount/100)}</td>
                          <td className="p-3 text-[#94A3B8] text-xs">{new Date(inv.created_at).toLocaleDateString()}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLORS[inv.status]||''}`}>{inv.status}</span></td>
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
            <div className="grid grid-cols-2 gap-5 max-w-5xl">

              {/* Razorpay */}
              <div className="glass-card p-6 col-span-2">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#0A1F0C] flex items-center justify-center"><Key size={16} className="text-[#A3E635]"/></div>
                  <div><div className="text-white font-semibold text-sm">Razorpay Payment Keys</div><div className="text-[#4B6856] text-xs">Configure payment gateway</div></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Mode</label>
                    <select value={settings.razorpay_mode} onChange={e=>setSettings(s=>({...s,razorpay_mode:e.target.value}))}
                      className="input-dark w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer">
                      <option value="test">Test Mode</option>
                      <option value="live">Live Mode</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Key ID</label>
                    <input value={settings.razorpay_key_id} onChange={e=>setSettings(s=>({...s,razorpay_key_id:e.target.value}))}
                      placeholder="rzp_test_xxxxxxxxxxxx" className="input-dark w-full px-3 py-2.5 rounded-xl text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Key Secret</label>
                    <div className="relative">
                      <input type={showSecret?'text':'password'} value={settings.razorpay_key_secret}
                        onChange={e=>setSettings(s=>({...s,razorpay_key_secret:e.target.value}))}
                        placeholder="Secret key" className="input-dark w-full px-3 pr-9 py-2.5 rounded-xl text-sm font-mono" />
                      <button type="button" onClick={()=>setShowSecret(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer">
                        {showSecret?<EyeOff size={14}/>:<Eye size={14}/>}
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={saveSettings} disabled={saving} className="btn-lime flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm mt-4 disabled:opacity-50">
                  <Save size={14}/> {saving?'Saving...':'Save Keys'}
                </button>
              </div>

              {/* SMTP */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#0A1F0C] flex items-center justify-center"><Mail size={16} className="text-[#A3E635]"/></div>
                  <div><div className="text-white font-semibold text-sm">SMTP / Email</div><div className="text-[#4B6856] text-xs">For invoice & notification emails</div></div>
                </div>
                <div className="space-y-3">
                  {[
                    { key:'smtp_host', label:'SMTP Host', placeholder:'smtp.gmail.com' },
                    { key:'smtp_port', label:'Port', placeholder:'465' },
                    { key:'smtp_user', label:'Gmail / User', placeholder:'you@gmail.com' },
                    { key:'smtp_from_name', label:'From Name', placeholder:'LeadFrog' },
                    { key:'smtp_admin_email', label:'Admin Email', placeholder:'admin@yourdomain.com' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">{label}</label>
                      <input value={smtp[key]||''} onChange={e=>setSmtp(s=>({...s,[key]:e.target.value}))}
                        placeholder={placeholder} className="input-dark w-full px-3 py-2 rounded-xl text-sm" />
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">App Password</label>
                    <div className="relative">
                      <input type={showSmtpPass?'text':'password'} value={smtp.smtp_pass||''}
                        onChange={e=>setSmtp(s=>({...s,smtp_pass:e.target.value}))}
                        placeholder="Gmail App Password" className="input-dark w-full px-3 pr-9 py-2 rounded-xl text-sm" />
                      <button type="button" onClick={()=>setShowSmtpPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer">
                        {showSmtpPass?<EyeOff size={13}/>:<Eye size={13}/>}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveSmtp} disabled={saving} className="btn-lime flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs disabled:opacity-50">
                    <Save size={12}/> Save SMTP
                  </button>
                  <button onClick={async()=>{ const r=await fetch('/api/admin/smtp',{method:'POST'}); const d=await r.json(); showMsg(r.ok,d.message||d.error) }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs border border-[#122016] text-[#94A3B8] hover:text-white cursor-pointer">
                    <Mail size={12}/> Test Email
                  </button>
                </div>
              </div>

              {/* Admin Account */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#0A1F0C] flex items-center justify-center"><User size={16} className="text-[#A3E635]"/></div>
                  <div><div className="text-white font-semibold text-sm">Admin Account</div><div className="text-[#4B6856] text-xs">Update email or password</div></div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">New Email <span className="normal-case text-[#4B6856]/60">(optional)</span></label>
                    <input type="email" value={account.newEmail} onChange={e=>setAccount(a=>({...a,newEmail:e.target.value}))}
                      placeholder={session?.user?.email||''} className="input-dark w-full px-3 py-2 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">New Password <span className="normal-case text-[#4B6856]/60">(optional)</span></label>
                    <div className="relative">
                      <input type={showNewPw?'text':'password'} value={account.newPassword}
                        onChange={e=>setAccount(a=>({...a,newPassword:e.target.value}))}
                        placeholder="Min 8 characters" className="input-dark w-full px-3 pr-9 py-2 rounded-xl text-sm" />
                      <button type="button" onClick={()=>setShowNewPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] cursor-pointer">
                        {showNewPw?<EyeOff size={13}/>:<Eye size={13}/>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1">Current Password <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                      <input type="password" value={account.currentPassword}
                        onChange={e=>setAccount(a=>({...a,currentPassword:e.target.value}))}
                        placeholder="Required to make changes" className="input-dark w-full pl-8 pr-3 py-2 rounded-xl text-sm" />
                    </div>
                  </div>
                </div>
                <button onClick={updateAccount} disabled={saving||!account.currentPassword}
                  className="btn-lime flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm mt-4 disabled:opacity-50">
                  <Save size={13}/> Update Account
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}

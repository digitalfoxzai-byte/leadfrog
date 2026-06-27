'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Search, Users, CreditCard, Settings, LogOut, User, Mail, Lock, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff, X } from 'lucide-react'

type Toast = { msg: string; ok: boolean } | null

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [loading, setLoading] = useState(true)

  // Name form
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Email form
  const [newEmail, setNewEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, new: false })
  const [savingPw, setSavingPw] = useState(false)

  const [toast, setToast] = useState<Toast>(null)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [usage, setUsage] = useState<{ plan: string; label?: string; leadsUsed: number; leadsLimit: number; percentUsed: number; daysLeft: number } | null>(null)

  type ApiKey = { id: number; name: string; key_prefix: string; last_used_at: string | null; created_at: string }
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)

  const isBusiness = ['business', 'admin'].includes(usage?.plan || '')

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch('/api/billing/usage').then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setUsage(d)
        if (['business', 'admin'].includes(d.plan)) {
          fetch('/api/user/api-keys').then(r => r.ok ? r.json() : []).then(keys => setApiKeys(keys))
        }
      }
    })
  }, [])

  async function createApiKey() {
    setCreatingKey(true)
    const res = await fetch('/api/user/api-keys', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: newKeyName || 'My API Key' }) })
    const d = await res.json()
    setCreatingKey(false)
    if (res.ok) { setNewKeyValue(d.key); setNewKeyName(''); fetch('/api/user/api-keys').then(r => r.json()).then(setApiKeys) }
    else showToast(d.error || 'Failed to create key', false)
  }

  async function revokeApiKey(id: number) {
    await fetch('/api/user/api-keys', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setApiKeys(prev => prev.filter(k => k.id !== id))
    showToast('API key revoked')
  }

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    fetch('/api/user/settings').then(r => {
      if (!r.ok) return null
      return r.json()
    }).then(d => {
      if (!d) return
      setProfile(d)
      setName(d.name || '')
      setLoading(false)
    })
  }, [status, router])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    const res = await fetch('/api/user/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'name', name }),
    })
    const d = await res.json()
    setSavingName(false)
    if (res.ok) { setProfile(p => ({ ...p, name })); showToast('Name updated successfully') }
    else showToast(d.error || 'Failed to update name', false)
  }

  async function sendEmailOtp(e: React.FormEvent) {
    e.preventDefault()
    setSendingOtp(true)
    const res = await fetch('/api/user/send-email-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail }),
    })
    const d = await res.json()
    setSendingOtp(false)
    if (res.ok) { setEmailOtpSent(true); showToast('Verification code sent to new email') }
    else showToast(d.error || 'Failed to send code', false)
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setSavingEmail(true)
    const res = await fetch('/api/user/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', newEmail, otp: emailOtp }),
    })
    const d = await res.json()
    setSavingEmail(false)
    if (res.ok) {
      showToast('Email updated! Signing you out…')
      setTimeout(() => signOut({ callbackUrl: '/login' }), 2000)
    } else showToast(d.error || 'Failed to update email', false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { showToast('Passwords do not match', false); return }
    if (pwForm.newPw.length < 8) { showToast('Password must be at least 8 characters', false); return }
    setSavingPw(true)
    const res = await fetch('/api/user/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'password', currentPassword: pwForm.current, newPassword: pwForm.newPw }),
    })
    const d = await res.json()
    setSavingPw(false)
    if (res.ok) { setPwForm({ current: '', newPw: '', confirm: '' }); showToast('Password updated successfully') }
    else showToast(d.error || 'Failed to update password', false)
  }

  const navItems = [
    { label: 'Scraper',  icon: Search,   href: '/dashboard' },
    { label: 'All Leads', icon: Users,   href: '/dashboard?view=leads' },
  ]
  const accountItems = [
    { label: 'Billing',  icon: CreditCard, href: '/dashboard/billing' },
    { label: 'Settings', icon: Settings,   href: '/dashboard/settings', active: true },
  ]

  if (status === 'unauthenticated') return null

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
          {navItems.map(({ label, icon: Icon, href }) => (
            <Link key={label} href={href}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-l-2 border-transparent text-[var(--ds-muted)] hover:text-[var(--ds-dim)] hover:bg-white/[0.03] transition-all text-[13.5px] font-medium">
              <Icon size={14} /> {label}
            </Link>
          ))}
          <div className="text-[9px] text-[var(--ds-muted)] uppercase tracking-[2.5px] px-3 py-2 mt-3 font-semibold">Account</div>
          {accountItems.map(({ label, icon: Icon, href, active }) => (
            active ? (
              <span key={label} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-l-2 border-[#A3E635] bg-[#A3E635]/[0.06] text-[#A3E635] text-[13.5px] font-medium">
                <Icon size={14} /> {label}
              </span>
            ) : (
              <Link key={label} href={href}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-l-2 border-transparent text-[var(--ds-muted)] hover:text-[var(--ds-dim)] hover:bg-white/[0.03] transition-all text-[13.5px] font-medium">
                <Icon size={14} /> {label}
              </Link>
            )
          ))}
        </nav>
        {usage && usage.plan !== 'admin' && (
          <div className="mx-3 mb-2 p-3 rounded-xl border border-[var(--ds-bd1)] bg-[var(--ds-bg2)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-[var(--ds-muted)] uppercase tracking-widest">
                {usage.plan === 'free' ? 'Free Trial' : (usage.label || usage.plan)}
              </span>
              {usage.plan === 'free' && usage.daysLeft > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${usage.daysLeft <= 1 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {usage.daysLeft}d left
                </span>
              )}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--ds-muted)] mb-1">
              <span>Leads used</span>
              <span className="text-[var(--ds-dim)] font-semibold">{usage.leadsUsed}/{usage.leadsLimit === -1 ? '∞' : usage.leadsLimit}</span>
            </div>
            <div className="h-1.5 bg-[var(--ds-bg3)] rounded-full border border-[var(--ds-bd1)] overflow-hidden">
              <div className={`h-full rounded-full transition-all ${usage.percentUsed >= 90 ? 'bg-red-500' : usage.percentUsed >= 70 ? 'bg-amber-400' : 'bg-[#4ADE80]'}`}
                style={{ width: `${usage.percentUsed}%` }} />
            </div>
          </div>
        )}
        <div className="p-3 border-t border-[var(--ds-bd1)]">
          <button onClick={() => setSignOutConfirm(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[var(--ds-muted)] hover:text-red-400 hover:bg-red-500/[0.05] transition-all text-[13px] cursor-pointer">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--ds-bd1)] bg-[var(--ds-bg1)] shrink-0">
          <div>
            <span className="text-[var(--ds-text)] font-semibold text-sm">Account Settings</span>
            <span className="text-[var(--ds-muted)] text-xs ml-2">· {profile.name}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {(status === 'loading' || loading) ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-[#A3E635]/30 border-t-[#A3E635] rounded-full animate-spin" />
            </div>
          ) : (
          <div className="max-w-2xl space-y-5">

            {/* Profile — Name */}
            <div className="rounded-2xl border border-[var(--ds-bd1)] bg-[var(--ds-bg1)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--ds-bd1)] flex items-center gap-2.5">
                <User size={15} className="text-[#A3E635]" />
                <span className="text-[var(--ds-text)] font-semibold text-sm">Display Name</span>
              </div>
              <form onSubmit={saveName} className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs text-[var(--ds-muted)] uppercase tracking-wider mb-2 block">Full Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="input-dark w-full px-4 py-3 rounded-xl text-sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--ds-muted)]">Shown on your invoices and emails</span>
                  <button type="submit" disabled={savingName || name === profile.name}
                    className="btn-lime px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer">
                    {savingName ? 'Saving…' : 'Save Name'}
                  </button>
                </div>
              </form>
            </div>

            {/* Email */}
            <div className="rounded-2xl border border-[var(--ds-bd1)] bg-[var(--ds-bg1)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--ds-bd1)] flex items-center gap-2.5">
                <Mail size={15} className="text-[#A3E635]" />
                <span className="text-[var(--ds-text)] font-semibold text-sm">Email Address</span>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--ds-bg2)] border border-[var(--ds-bd1)]">
                  <Mail size={14} className="text-[var(--ds-muted)]" />
                  <span className="text-sm text-[var(--ds-dim)]">{profile.email}</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">Current</span>
                </div>

                {!emailOtpSent ? (
                  <form onSubmit={sendEmailOtp} className="space-y-3">
                    <div>
                      <label className="text-xs text-[var(--ds-muted)] uppercase tracking-wider mb-2 block">New Email Address</label>
                      <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                        placeholder="new@example.com"
                        className="input-dark w-full px-4 py-3 rounded-xl text-sm" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--ds-muted)]">A verification code will be sent to the new email</span>
                      <button type="submit" disabled={sendingOtp || !newEmail}
                        className="btn-lime px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer">
                        {sendingOtp ? 'Sending…' : 'Send Code'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={saveEmail} className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                      <CheckCircle size={13} /> Code sent to <strong>{newEmail}</strong>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--ds-muted)] uppercase tracking-wider mb-2 block">Verification Code</label>
                      <div className="relative">
                        <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-muted)]" />
                        <input type="text" inputMode="numeric" maxLength={6} required autoFocus
                          value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-lg font-bold tracking-[0.5em] text-center" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => { setEmailOtpSent(false); setEmailOtp('') }}
                        className="text-xs text-[var(--ds-muted)] hover:text-[var(--ds-text)] transition-colors cursor-pointer">
                        ← Use different email
                      </button>
                      <button type="submit" disabled={savingEmail || emailOtp.length !== 6}
                        className="btn-lime px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer">
                        {savingEmail ? 'Updating…' : 'Confirm Email Change'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="rounded-2xl border border-[var(--ds-bd1)] bg-[var(--ds-bg1)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--ds-bd1)] flex items-center gap-2.5">
                <Lock size={15} className="text-[#A3E635]" />
                <span className="text-[var(--ds-text)] font-semibold text-sm">Change Password</span>
              </div>
              <form onSubmit={savePassword} className="px-6 py-5 space-y-4">
                {[
                  { label: 'Current Password', key: 'current' as const, showKey: 'current' as const, placeholder: 'Your current password' },
                  { label: 'New Password',     key: 'newPw'   as const, showKey: 'new'     as const, placeholder: 'Min 8 characters' },
                  { label: 'Confirm New Password', key: 'confirm' as const, showKey: 'new' as const, placeholder: 'Repeat new password' },
                ].map(({ label, key, showKey, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-[var(--ds-muted)] uppercase tracking-wider mb-2 block">{label}</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-muted)]" />
                      <input
                        type={showPw[showKey] ? 'text' : 'password'} required
                        value={pwForm[key]}
                        onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="input-dark w-full pl-9 pr-10 py-3 rounded-xl text-sm"
                      />
                      {key !== 'confirm' && (
                        <button type="button" onClick={() => setShowPw(p => ({ ...p, [showKey]: !p[showKey] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-muted)] hover:text-[#A3E635] transition-colors cursor-pointer">
                          {showPw[showKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {pwForm.newPw && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertCircle size={12} /> Passwords do not match
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="submit"
                    disabled={savingPw || !pwForm.current || !pwForm.newPw || !pwForm.confirm || pwForm.newPw !== pwForm.confirm}
                    className="btn-lime px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer">
                    {savingPw ? 'Saving…' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] overflow-hidden">
              <div className="px-6 py-4 border-b border-red-500/20 flex items-center gap-2.5">
                <AlertCircle size={15} className="text-red-400" />
                <span className="text-red-400 font-semibold text-sm">Sign Out</span>
              </div>
              <div className="px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--ds-text)]">Sign out of your account on this device</p>
                  <p className="text-xs text-[var(--ds-muted)] mt-0.5">You will be redirected to the login page</p>
                </div>
                <button onClick={() => setSignOutConfirm(true)}
                  className="px-5 py-2 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer">
                  Sign Out
                </button>
              </div>
            </div>

            {/* API Keys — Business+ */}
            <div className="rounded-2xl border border-[var(--ds-bd1)] bg-[var(--ds-bg1)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--ds-bd1)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound size={15} className="text-[#A3E635]" />
                  <span className="text-[var(--ds-text)] font-semibold text-sm">API Keys</span>
                  {!isBusiness && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold">Business+</span>}
                </div>
              </div>
              {!isBusiness ? (
                <div className="px-6 py-8 text-center">
                  <Lock size={22} className="text-[var(--ds-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--ds-text)] font-semibold mb-1">API Access — Business Plan</p>
                  <p className="text-xs text-[var(--ds-muted)] mb-4">Generate API keys to integrate LeadFrog into your own tools and workflows.</p>
                  <Link href="/dashboard/billing" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl btn-lime text-sm font-semibold">Upgrade to Business</Link>
                </div>
              ) : (
                <div className="px-6 py-5 space-y-4">
                  {newKeyValue && (
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5">New API Key — copy it now, it won&apos;t be shown again</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-xs text-[var(--ds-text)] bg-[var(--ds-bg2)] px-3 py-2 rounded-lg overflow-x-auto">{newKeyValue}</code>
                        <button onClick={() => { navigator.clipboard.writeText(newKeyValue); showToast('Copied!') }}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer whitespace-nowrap">Copy</button>
                        <button onClick={() => setNewKeyValue(null)} className="text-[var(--ds-muted)] hover:text-[var(--ds-text)] cursor-pointer"><X size={14} /></button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. My App)"
                      className="input-dark flex-1 px-3 py-2 rounded-lg text-sm" />
                    <button onClick={createApiKey} disabled={creatingKey}
                      className="btn-lime px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap">
                      {creatingKey ? 'Generating…' : '+ Generate Key'}
                    </button>
                  </div>
                  {apiKeys.length > 0 ? (
                    <div className="space-y-2">
                      {apiKeys.map(k => (
                        <div key={k.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--ds-bg2)] border border-[var(--ds-bd1)]">
                          <div>
                            <div className="text-sm font-semibold text-[var(--ds-text)]">{k.name}</div>
                            <div className="text-[10px] text-[var(--ds-muted)] font-mono mt-0.5">lf_{k.key_prefix}_••••••••••••••••</div>
                            <div className="text-[9px] text-[var(--ds-muted)] mt-0.5">Created {new Date(k.created_at).toLocaleDateString('en-IN')}{k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleDateString('en-IN')}` : ' · Never used'}</div>
                          </div>
                          <button onClick={() => revokeApiKey(k.id)}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors">Revoke</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ds-muted)] text-center py-2">No API keys yet.</p>
                  )}
                </div>
              )}
            </div>

          </div>
          )}
        </main>
      </div>

      {/* Sign Out Confirm */}
      {signOutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center">
          <div className="bg-[var(--ds-bg2)] border border-[var(--ds-bd2)] rounded-2xl w-[340px] overflow-hidden shadow-2xl">
            <div className="flex justify-center pt-6">
              <div className="w-12 h-12 rounded-[14px] bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <LogOut size={22} className="text-red-400" />
              </div>
            </div>
            <div className="px-6 pb-4 pt-3 text-center">
              <div className="text-base font-bold text-[var(--ds-text)] mb-1.5">Sign Out?</div>
              <div className="text-xs text-[var(--ds-muted)] leading-relaxed">You'll need to sign in again to access your dashboard.</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 px-6 pb-5">
              <button onClick={() => setSignOutConfirm(false)} className="py-2.5 rounded-xl border border-[var(--ds-bd2)] text-[var(--ds-dim)] text-sm font-semibold hover:text-[var(--ds-text)] hover:bg-white/[0.05] cursor-pointer transition-all">Cancel</button>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="py-2.5 rounded-xl bg-gradient-to-br from-red-600 to-red-500 text-white text-sm font-semibold cursor-pointer hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-500/20">Sign Out</button>
            </div>
          </div>
        </div>
      )}

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

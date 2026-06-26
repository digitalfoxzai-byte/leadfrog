'use client'
import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Key, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react'

export default function SetupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', secret: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setResult(null)
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    setResult({ ok: res.ok, msg: res.ok ? 'Admin account created! Go to /login to sign in.' : data.error })
  }

  return (
    <div className="min-h-screen bg-[#050A06] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(22,101,52,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <motion.div
        className="glass-card w-full max-w-md p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="LeadFrog" width={120} height={48} className="object-contain" />
        </div>

        <div className="flex items-center gap-2 justify-center mb-2">
          <ShieldCheck size={18} className="text-[#A3E635]" />
          <h1 className="text-xl font-bold text-white">First-Time Admin Setup</h1>
        </div>
        <p className="text-[#4B6856] text-xs text-center mb-7">
          Create the first admin account. This route is disabled after first use.
        </p>

        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-xl border text-sm mb-6 ${result.ok ? 'bg-[#A3E635]/10 border-[#A3E635]/20 text-[#A3E635]' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {result.ok ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
            {result.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Full Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Admin Name"
                className="input-dark w-full pl-9 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@yourdomain.com"
                className="input-dark w-full pl-9 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type="password" required minLength={8} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="input-dark w-full pl-9 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#4B6856] uppercase tracking-wider block mb-1.5">Setup Secret Key</label>
            <div className="relative">
              <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type="password" required value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                placeholder="leadfrog-setup-2025"
                className="input-dark w-full pl-9 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
            <p className="text-[10px] text-[#4B6856] mt-1">Default: <span className="text-[#A3E635]/70 font-mono">leadfrog-setup-2025</span> — set SETUP_SECRET in .env to change</p>
          </div>

          <button type="submit" disabled={loading || !!result?.ok}
            className="btn-lime w-full py-3 rounded-xl text-sm font-semibold mt-2 disabled:opacity-50">
            {loading ? 'Creating Admin...' : 'Create Admin Account'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

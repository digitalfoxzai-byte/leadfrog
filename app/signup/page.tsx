'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, Check } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) router.push('/login?registered=1')
    else setError(data.error || 'Registration failed')
  }

  return (
    <div className="min-h-screen bg-[#050A06] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(22,101,52,0.12)_0%,_transparent_70%)] pointer-events-none" />
      <motion.div
        className="glass-card w-full max-w-md p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="LeadFrog" width={120} height={48} className="object-contain" />
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2 font-heading">Create your account</h1>
        <p className="text-[#4B6856] text-sm text-center mb-8">Start scraping leads for free today</p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">Full Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
                className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
              <input type={showPw ? 'text' : 'password'} required value={form.password} minLength={8}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="input-dark w-full pl-9 pr-10 py-3 rounded-xl text-sm"
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] transition-colors cursor-pointer">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-lime w-full py-3 rounded-xl text-sm mt-2 disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>
        </form>

        <div className="mt-6 space-y-2">
          {['Free plan included — no credit card', '500 leads to get started', 'Upgrade anytime'].map(t => (
            <div key={t} className="flex items-center gap-2 text-xs text-[#4B6856]">
              <Check size={12} className="text-[#A3E635]" /> {t}
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[#4B6856] mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#A3E635] hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}

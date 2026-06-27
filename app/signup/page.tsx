'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, Check, KeyRound } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpStep, setOtpStep] = useState(false)
  const [otp, setOtp] = useState('')

  const passwordStrength =
    form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3
  const strengthColors = ['', 'bg-red-500', 'bg-amber-400', 'bg-[#A3E635]']
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong']
  const strengthTextColors = ['', 'text-red-400', 'text-amber-400', 'text-[#A3E635]']

  async function submitRegistration(otpCode?: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otpCode ? { ...form, otp: otpCode } : form),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    router.push('/login?registered=1')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code')

      if (data.skipVerification) {
        await submitRegistration()
      } else {
        setOtpStep(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await submitRegistration(otp)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
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

        <h1 className="text-2xl font-bold text-white text-center mb-2 font-heading">
          {otpStep ? 'Verify your email' : 'Create your account'}
        </h1>
        <p className="text-[#4B6856] text-sm text-center mb-8">
          {otpStep ? `We sent a 6-digit code to ${form.email}` : 'Start scraping leads for free today'}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {otpStep ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">Verification Code</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                <input
                  type="text" inputMode="numeric" maxLength={6} autoFocus required
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-lg font-bold tracking-[0.5em] text-center"
                />
              </div>
            </div>

            <button type="submit" disabled={loading || otp.length !== 6}
              className="btn-lime w-full py-3 rounded-xl text-sm mt-2 disabled:opacity-50 cursor-pointer">
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <button type="button" onClick={() => { setOtpStep(false); setOtp(''); setError('') }}
              className="w-full text-[#4B6856] hover:text-white text-xs font-medium transition-colors cursor-pointer">
              Wrong email? Go back
            </button>
          </form>
        ) : (
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
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6856] hover:text-[#A3E635] transition-colors cursor-pointer">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map(i => (
                      <div key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-white/[0.08]'}`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-semibold ${strengthTextColors[passwordStrength]}`}>
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="btn-lime w-full py-3 rounded-xl text-sm mt-2 disabled:opacity-50 cursor-pointer">
              {loading ? 'Sending verification code...' : 'Create Free Account'}
            </button>
          </form>
        )}

        <div className="mt-6 space-y-2">
          {['Free trial included — no credit card', '50 leads to get started', 'Upgrade anytime'].map(t => (
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

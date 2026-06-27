'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Mail, Lock, KeyRound, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      setStep(2)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050A06] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(22,101,52,0.10)_0%,_transparent_70%)] pointer-events-none" />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="LeadFrog" width={120} height={48} className="object-contain" />
        </div>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-1.5 font-heading">Reset your password</h1>
          <p className="text-[#4B6856] text-sm text-center mb-8">
            {step === 1 ? "We'll email you a 6-digit reset code" : `Code sent to ${email}`}
          </p>

          {done ? (
            <div className="text-center py-6">
              <CheckCircle size={44} className="text-[#A3E635] mx-auto mb-4" />
              <div className="font-bold text-white text-lg mb-1">Password reset!</div>
              <div className="text-[#4B6856] text-sm">Redirecting to login…</div>
            </div>
          ) : step === 1 ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn-lime w-full py-3 rounded-xl text-sm disabled:opacity-50 cursor-pointer">
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">6-Digit Code</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                  <input type="text" inputMode="numeric" maxLength={6} required autoFocus
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-lg font-bold tracking-[0.5em] text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#4B6856] uppercase tracking-wider mb-2 block">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B6856]" />
                  <input type="password" required minLength={8}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="input-dark w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn-lime w-full py-3 rounded-xl text-sm disabled:opacity-50 cursor-pointer">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button type="button" onClick={() => { setStep(1); setOtp(''); setError('') }}
                className="w-full text-[#4B6856] hover:text-white text-xs font-medium transition-colors cursor-pointer">
                Didn&apos;t get the code? Send again
              </button>
            </form>
          )}
        </div>

        <Link href="/login" className="flex items-center justify-center gap-1.5 text-[#4B6856] hover:text-white text-sm mt-6 transition-colors">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </motion.div>
    </div>
  )
}

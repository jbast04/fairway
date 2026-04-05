'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) { setError(error.message); setLoading(false); return }
      setSuccess('Account created! Check your email to confirm, then sign in.')
      setMode('login')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="text-3xl">⛳</span>
          <h1 className="text-3xl font-bold tracking-tight text-text">Fairway</h1>
        </div>
        <p className="text-sm text-text-dim">Golf performance analytics</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        {/* Mode toggle */}
        <div className="mb-6 flex rounded-lg border border-border p-1">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-accent text-bg'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-dim">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-text-dim">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-dim">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-stat/10 px-3 py-2 text-xs text-red-stat">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-bg transition-opacity disabled:opacity-50"
          >
            {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

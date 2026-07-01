'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Watch, RefreshCw, Check, Plug, Unplug, KeyRound, ShieldCheck, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import BackgroundLogo from '@/components/BackgroundLogo'
import { AnimatedCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabaseClient'
import { isDemoVisitor } from '@/lib/activeUser'
import { FITBIT_ACTIVITY_OPTIONS, FITBIT_DEFAULT_ALLOWED } from '@/lib/fitbit/constants'

type Status = {
  connected: boolean
  fitbitUserId?: string | null
  lastSyncAt?: string | null
  allowedActivities?: string[]
}

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

function relativeTime(iso?: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.round(hrs / 24)} d ago`
}

export default function ConnectionsPage() {
  const toast = useToast()
  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>({ connected: false })
  const [syncing, setSyncing] = useState(false)
  const [allowed, setAllowed] = useState<string[]>([])

  const load = useCallback(async () => {
    const isDemo = await isDemoVisitor()
    setDemo(isDemo)
    if (isDemo) {
      setStatus({
        connected: true,
        fitbitUserId: 'Charge 6 (sample)',
        lastSyncAt: new Date().toISOString(),
        allowedActivities: FITBIT_DEFAULT_ALLOWED,
      })
      setAllowed([...FITBIT_DEFAULT_ALLOWED])
      setLoading(false)
      return
    }
    try {
      const res = await authedFetch('/api/fitbit/status')
      const data: Status = await res.json()
      setStatus(data)
      setAllowed(data.allowedActivities ?? [])
    } catch {
      setStatus({ connected: false })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // One-time toast from the OAuth redirect
    const q = new URLSearchParams(window.location.search).get('fitbit')
    if (q === 'connected') toast.success('Fitbit connected')
    else if (q === 'error') toast.error('Could not connect Fitbit. Please try again.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connect() {
    if (demo) { toast.warning('Sign in to connect your own Fitbit'); return }
    window.location.href = '/api/fitbit/connect'
  }

  async function disconnect() {
    if (demo) { toast.warning('Sign in to manage your Fitbit'); return }
    try {
      await authedFetch('/api/fitbit/disconnect', { method: 'POST' })
      toast.success('Fitbit disconnected')
      setStatus({ connected: false })
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  async function syncNow() {
    if (demo) { toast.warning('Sign in to sync your Fitbit'); return }
    setSyncing(true)
    try {
      const res = await authedFetch('/api/fitbit/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        if (data.imported > 0) {
          toast.success(`Imported ${data.imported} session${data.imported === 1 ? '' : 's'}`)
        } else if (data.matched > 0) {
          toast.success('Already up to date')
        } else if (data.scanned > 0) {
          toast.warning(`Found ${data.scanned} Fitbit workout${data.scanned === 1 ? '' : 's'}, but none matched your selected types — add them in the list below.`)
        } else {
          toast.warning('No Fitbit workouts found in the last 12 months.')
        }
        load()
      } else if (data.needsReconnect) {
        toast.error('Fitbit needs reconnecting')
        setStatus({ connected: false })
      } else {
        toast.error('Sync failed')
      }
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function toggleActivity(name: string) {
    if (demo) { toast.warning('Sign in to customize imports'); return }
    const next = allowed.includes(name) ? allowed.filter((a) => a !== name) : [...allowed, name]
    setAllowed(next)
    try {
      await authedFetch('/api/fitbit/settings', { method: 'POST', body: JSON.stringify({ allowed_activities: next }) })
    } catch {
      toast.error('Failed to save')
    }
  }

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Link href="/settings" className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-display uppercase text-white">Connections</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Auto-import your cardio</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <Skeleton variant="rectangular" className="h-40" />
        ) : (
          <>
            {/* Fitbit card */}
            <AnimatedCard delay={0}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <Watch className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display uppercase text-lg text-white leading-none">Fitbit</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {status.connected
                      ? `Connected${status.fitbitUserId ? ` · ${status.fitbitUserId}` : ''}`
                      : 'Not connected'}
                  </p>
                </div>
                {status.connected && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> Active
                  </span>
                )}
              </div>

              {demo && (
                <div className="mb-4 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs text-zinc-400">
                  Sample connection. <Link href="/login" className="text-emerald-400 underline">Sign in</Link> to link your own Fitbit and auto-import cardio.
                </div>
              )}

              {status.connected ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">Last synced {relativeTime(status.lastSyncAt)}</p>
                  <div className="flex gap-2">
                    <Button onClick={syncNow} loading={syncing} icon={<RefreshCw className="w-4 h-4" />} className="flex-1">
                      Sync now
                    </Button>
                    <Button variant="secondary" onClick={disconnect} icon={<Unplug className="w-4 h-4" />}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={connect} icon={<Plug className="w-4 h-4" />} fullWidth size="lg">
                    Connect Fitbit
                  </Button>
                  <p className="text-[11px] text-zinc-600 text-center">
                    Fitbit data is now served through Google Health — you&apos;ll authorize with the Google account linked to your Fitbit.
                  </p>
                </div>
              )}
            </AnimatedCard>

            {/* Demo-only: show off how the secure sync works */}
            {demo && (
              <AnimatedCard delay={0.04}>
                <h3 className="font-display uppercase text-lg text-white mb-1">How the secure sync works</h3>
                <p className="text-xs text-zinc-500 mb-4">A live OAuth integration — here&apos;s what happens behind this card.</p>

                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { k: 'Device', v: 'Charge 6' },
                    { k: 'Synced', v: 'just now' },
                    { k: 'This year', v: '250' },
                  ].map((s) => (
                    <div key={s.k} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-2 text-center">
                      <div className="text-sm font-display text-emerald-300 leading-none">{s.v}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{s.k}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {[
                    { icon: KeyRound, t: 'Authorize once', d: 'OAuth 2.0 with PKCE — no password ever touches the app.' },
                    { icon: ShieldCheck, t: 'Encrypt the token', d: 'Stored AES-256 encrypted at rest and kept server-side.' },
                    { icon: RefreshCw, t: 'Sync daily', d: 'New workouts pull automatically, plus a manual sync.' },
                    { icon: Activity, t: 'Map intensity', d: 'Heart-rate zones become Low / Medium / High.' },
                  ].map((step) => {
                    const Icon = step.icon
                    return (
                      <div key={step.t} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white leading-snug">{step.t}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{step.d}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </AnimatedCard>
            )}

            {/* Activity allowlist */}
            {status.connected && (
              <AnimatedCard delay={0.05}>
                <h3 className="font-display uppercase text-lg text-white mb-1">Import these activities</h3>
                <p className="text-xs text-zinc-500 mb-4">Only the types you pick become cardio sessions.</p>
                <div className="flex flex-wrap gap-2">
                  {FITBIT_ACTIVITY_OPTIONS.map((name) => {
                    const on = allowed.includes(name)
                    return (
                      <motion.button
                        key={name}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleActivity(name)}
                        className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                          on
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-surface border-white/[0.07] text-zinc-500 hover:text-white'
                        }`}
                      >
                        {name}
                      </motion.button>
                    )
                  })}
                </div>
              </AnimatedCard>
            )}

            <p className="text-center text-xs text-zinc-600 px-6">
              Imported sessions appear in your cardio history and count toward your stats. You can edit or delete any of them.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

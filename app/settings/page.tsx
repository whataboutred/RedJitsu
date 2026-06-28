'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Trophy,
  User,
  Target,
  ShieldCheck,
  ChevronRight,
  LogOut,
  LogIn,
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ConfirmDialog } from '@/components/ui/BottomSheet'
import { supabase } from '@/lib/supabaseClient'
import { ensureProfile } from '@/lib/api'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useRouter } from 'next/navigation'
import BackgroundLogo from '@/components/BackgroundLogo'

type UserStats = {
  totalWorkouts: number
  totalBjjSessions: number
  currentStreak: number
  avgWeeklyWorkouts: number
  joinedDate: string
}

const NAV_ITEMS = [
  { href: '/settings/account', label: 'Account', sub: 'Name, email & password', icon: User },
  { href: '/settings/goals', label: 'Goals', sub: 'Weekly targets & coach context', icon: Target },
  { href: '/settings/privacy', label: 'Privacy & Data', sub: 'Export or delete your data', icon: ShieldCheck },
]

export default function ProfileHubPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    ;(async () => {
      setDemo(await isDemoVisitor())
      const userId = await getActiveUserId()
      if (!userId) { router.push('/login'); return }
      try {
        const p = await ensureProfile(userId)
        if (p) setDisplayName(p.display_name ?? '')
      } catch (err) {
        console.error('Error loading profile:', err)
      }
      await loadUserStats(userId)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUserStats(userId: string) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: workouts } = await supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())

    const { data: bjjSessions } = await supabase
      .from('bjj_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())

    const { data: { user } } = await supabase.auth.getUser()
    const joinedDate = user?.created_at || new Date().toISOString()

    const totalWorkouts = workouts?.length || 0
    const totalBjjSessions = bjjSessions?.length || 0
    const avgWeeklyWorkouts = Math.round((totalWorkouts / 4.3) * 10) / 10
    const currentStreak = calculateCurrentStreak(workouts || [], bjjSessions || [])

    setUserStats({ totalWorkouts, totalBjjSessions, currentStreak, avgWeeklyWorkouts, joinedDate })
  }

  function calculateCurrentStreak(workouts: any[], bjjSessions: any[]): number {
    const allSessions = [
      ...workouts.map(w => ({ date: w.created_at })),
      ...bjjSessions.map(b => ({ date: b.created_at })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    let streak = 0
    let lastDate = new Date()
    for (const session of allSessions) {
      const sessionDate = new Date(session.date)
      const diffDays = Math.floor((lastDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 2) { streak++; lastDate = sessionDate } else { break }
    }
    return streak
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />

      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4">
          <h1 className="text-4xl font-display uppercase text-white">Profile</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Your stats &amp; settings</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Identity */}
        <AnimatedCard delay={0}>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full bg-surface-elevated border-2 border-brand-red/50 flex items-center justify-center overflow-hidden flex-shrink-0">
              <div className="absolute inset-[3px] rounded-full border border-dashed border-white/15" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/red-jitsu-mark.png" alt="Red Jitsu" className="w-[44px] h-[44px] object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-semibold text-white truncate">
                {displayName || 'Set your name'}
              </p>
              {userStats && (
                <p className="text-sm text-zinc-500">
                  Member since {new Date(userStats.joinedDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </AnimatedCard>

        {/* Stats Overview */}
        {userStats && (
          <AnimatedCard delay={0.05}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-zinc-400" />
              <h3 className="font-display uppercase text-lg text-white">Your Stats (30 days)</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.totalWorkouts / 20) * 100} color="#DC2626" />
                  <span className="absolute font-display text-base text-white">{userStats.totalWorkouts}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Workouts</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.totalBjjSessions / 10) * 100} color="#7C3AED" />
                  <span className="absolute font-display text-base text-white">{userStats.totalBjjSessions}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">BJJ</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.currentStreak / 7) * 100} color="#F59E0B" />
                  <span className="absolute font-display text-base text-white">{userStats.currentStreak}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Streak</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.avgWeeklyWorkouts / 7) * 100} color="#10B981" />
                  <span className="absolute font-display text-base text-white">{userStats.avgWeeklyWorkouts}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Avg/Week</p>
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* Navigation */}
        <div className="space-y-2 pt-1">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-red/15 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-brand-red" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.sub}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600 shrink-0" />
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Sign in (demo) / Log out (real user) */}
        {demo ? (
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-brand-red text-white font-semibold hover:bg-red-600 active:scale-[0.99] transition-all mt-2 shadow-lg shadow-red-500/20"
          >
            <LogIn className="w-4 h-4" />
            Sign in to your account
          </Link>
        ) : (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-zinc-400 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors mt-2"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        variant="danger"
      />
    </div>
  )
}

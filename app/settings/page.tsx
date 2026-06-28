'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  User,
  Target,
  ShieldCheck,
  ChevronRight,
  LogOut,
  LogIn,
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/BottomSheet'
import { supabase } from '@/lib/supabaseClient'
import { ensureProfile } from '@/lib/api'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useRouter } from 'next/navigation'
import BackgroundLogo from '@/components/BackgroundLogo'

const NAV_ITEMS = [
  { href: '/settings/account', label: 'Account', sub: 'Name, email & password', icon: User },
  { href: '/settings/goals', label: 'Goals', sub: 'Weekly targets & coach context', icon: Target },
  { href: '/settings/privacy', label: 'Privacy & Data', sub: 'Export or delete your data', icon: ShieldCheck },
]

export default function ProfileHubPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
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
      const { data: { user } } = await supabase.auth.getUser()
      setJoinedDate(user?.created_at ?? null)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              {joinedDate && (
                <p className="text-sm text-zinc-500">
                  Member since {new Date(joinedDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </AnimatedCard>

        {/* Stats live on the Progress → Achievements tab now (avoids duplicating the numbers here) */}

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

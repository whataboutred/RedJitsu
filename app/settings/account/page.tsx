'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, User, Mail, Scale, Lock, ChevronRight } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabaseClient'
import { ensureProfile, upsertProfile } from '@/lib/api'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import BackgroundLogo from '@/components/BackgroundLogo'

export default function AccountPage() {
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')

  const [showPasswordSheet, setShowPasswordSheet] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    ;(async () => {
      const userId = await getActiveUserId()
      if (!userId) { router.push('/login'); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)
      try {
        const p = await ensureProfile(userId)
        if (p) {
          setDisplayName(p.display_name ?? '')
          setUnit((p.unit ?? 'lb') as 'lb' | 'kg')
        }
      } catch (err) {
        console.error('Error loading account:', err)
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (await isDemoVisitor()) { toast.warning('Sign in to edit your account'); return }
    const userId = await getActiveUserId()
    if (!userId) { toast.error('Please sign in again'); return }
    setSaving(true)
    try {
      await upsertProfile(userId, { display_name: displayName.trim() || null, unit })
      toast.success('Account saved!')
      setTimeout(() => router.push('/settings'), 400)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast.warning('Please fill in all password fields')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 12) {
      toast.warning('New password must be at least 12 characters')
      return
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.warning('Password must include uppercase, lowercase, and a number')
      return
    }
    setChangingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signInError) {
        toast.error('Current password is incorrect')
        setChangingPassword(false)
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password changed!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSheet(false)
    } catch {
      toast.error('Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />

      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display uppercase text-white leading-none">Account</h1>
            <p className="text-sm text-zinc-500 mt-1">Your identity & sign-in</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-zinc-500 text-sm">Loading…</div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Display name */}
          <AnimatedCard delay={0}>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-brand-red" />
              <h3 className="font-display uppercase text-lg text-white">Display Name</h3>
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              placeholder="What should we call you?"
              className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-600 focus:border-brand-red focus:outline-none transition-colors"
            />
            <p className="mt-2 text-xs text-zinc-600">Shown across the app instead of your email.</p>
          </AnimatedCard>

          {/* Email (read-only) */}
          <AnimatedCard delay={0.05}>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-zinc-500" />
              <h3 className="font-display uppercase text-lg text-white">Email</h3>
            </div>
            <div className="px-4 py-3 bg-surface/50 border border-white/[0.05] rounded-xl text-zinc-400">
              {email || '—'}
            </div>
          </AnimatedCard>

          {/* Weight unit */}
          <AnimatedCard delay={0.1}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4 text-zinc-500" />
                <span className="text-sm text-zinc-300">Weight unit</span>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-full bg-surface-elevated/60">
                {(['lb', 'kg'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`px-3.5 py-1 rounded-full text-sm font-semibold transition-all ${unit === u
                      ? 'bg-brand-red text-white'
                      : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </AnimatedCard>

          {/* Change password */}
          <AnimatedCard delay={0.15}>
            <button
              onClick={() => setShowPasswordSheet(true)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-zinc-500" />
                <span className="text-white">Change password</span>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </button>
          </AnimatedCard>
        </div>
      )}

      {/* Sticky Save */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent p-4"
        style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-lg mx-auto">
          <Button fullWidth size="lg" loading={saving} onClick={save}>
            Save Account
          </Button>
        </div>
      </motion.div>

      {/* Password Change Sheet */}
      <BottomSheet
        isOpen={showPasswordSheet}
        onClose={() => setShowPasswordSheet(false)}
        title="Change Password"
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm text-zinc-500 mb-2">Current Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-red-500 focus:outline-none"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-500 mb-2">New Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-red-500 focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 12 characters"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-500 mb-2">Confirm New Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-red-500 focus:outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>
          <Button
            fullWidth
            onClick={changePassword}
            loading={changingPassword}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Update Password
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}

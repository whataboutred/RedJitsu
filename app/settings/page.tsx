'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  User,
  Dumbbell,
  Target,
  Activity,
  Eye,
  Lock,
  ChevronRight,
  Check,
  Flame,
  Trophy,
  Calendar,
  TrendingUp,
  LogOut,
  Trash2,
  Scale,
  Sparkles
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Button } from '@/components/ui/Button'
import { BottomSheet, ConfirmDialog } from '@/components/ui/BottomSheet'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { useRouter } from 'next/navigation'
import DeleteAllData from '@/components/DeleteAllData'
import DataExport from '@/components/DataExport'

type Profile = {
  unit: 'lb' | 'kg' | null
  weekly_goal: number | null
  target_weeks: number | null
  goal_start: string | null
  bjj_weekly_goal: number | null
  cardio_weekly_goal: number | null
  show_strength_goal: boolean | null
  show_bjj_goal: boolean | null
  show_cardio_goal: boolean | null
}

type UserStats = {
  totalWorkouts: number
  totalBjjSessions: number
  currentStreak: number
  avgWeeklyWorkouts: number
  avgWeeklyBjj: number
  joinedDate: string
}

// Toggle switch component
function Toggle({ enabled, onChange, color = 'bg-red-500' }: {
  enabled: boolean
  onChange: (value: boolean) => void
  color?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${enabled ? color : 'bg-surface-pressed'
        }`}
    >
      <motion.span
        className="inline-block h-5 w-5 rounded-full bg-white shadow-lg"
        animate={{ x: enabled ? 24 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  )
}


export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const toast = useToast()

  // Profile settings
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [targetWeeks, setTargetWeeks] = useState<number | ''>('')
  const [goalStart, setGoalStart] = useState<string>('')
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)
  const [cardioWeeklyGoal, setCardioWeeklyGoal] = useState<number>(3)

  // Goal visibility
  const [showStrengthGoal, setShowStrengthGoal] = useState<boolean>(true)
  const [showBjjGoal, setShowBjjGoal] = useState<boolean>(true)
  const [showCardioGoal, setShowCardioGoal] = useState<boolean>(false)

  // User stats
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')

  // Password change
  const [showPasswordSheet, setShowPasswordSheet] = useState(false)
  const [currentPassword, setCurrentPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [changingPassword, setChangingPassword] = useState<boolean>(false)

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  async function loadUserData() {
    const userId = await getActiveUserId()
    if (!userId) { router.push('/login'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) setUserEmail(user.email)

    try {
      let { data: p, error } = await supabase
        .from('profiles')
        .select('unit,weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
        .eq('id', userId)
        .maybeSingle()

      if (!p) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            unit: 'lb',
            weekly_goal: 4,
            bjj_weekly_goal: 2,
            cardio_weekly_goal: 3,
            show_strength_goal: true,
            show_bjj_goal: true,
            show_cardio_goal: false
          }, { onConflict: 'id', ignoreDuplicates: false })
          .select('unit,weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
          .single()

        p = newProfile
      }

      if (p) {
        setUnit(((p as Profile).unit ?? 'lb') as 'lb' | 'kg')
        setWeeklyGoal((p as Profile).weekly_goal ?? 4)
        setTargetWeeks(((p as Profile).target_weeks ?? null) as number | null ?? '')
        setGoalStart(((p as Profile).goal_start ?? null) as string | null ?? '')
        setBjjWeeklyGoal((p as Profile).bjj_weekly_goal ?? 2)
        setCardioWeeklyGoal((p as Profile).cardio_weekly_goal ?? 3)
        setShowStrengthGoal((p as Profile).show_strength_goal ?? true)
        setShowBjjGoal((p as Profile).show_bjj_goal ?? true)
        setShowCardioGoal((p as Profile).show_cardio_goal ?? false)
      }
    } catch (err) {
      console.error('Error in loadUserData:', err)
    }

    await loadUserStats(userId)
    setLoading(false)
  }

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
    const avgWeeklyBjj = Math.round((totalBjjSessions / 4.3) * 10) / 10

    const currentStreak = calculateCurrentStreak(workouts || [], bjjSessions || [])

    setUserStats({
      totalWorkouts,
      totalBjjSessions,
      currentStreak,
      avgWeeklyWorkouts,
      avgWeeklyBjj,
      joinedDate
    })
  }

  function calculateCurrentStreak(workouts: any[], bjjSessions: any[]): number {
    const allSessions = [
      ...workouts.map(w => ({ date: w.created_at, type: 'workout' })),
      ...bjjSessions.map(b => ({ date: b.created_at, type: 'bjj' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    let streak = 0
    let lastDate = new Date()

    for (const session of allSessions) {
      const sessionDate = new Date(session.date)
      const diffDays = Math.floor((lastDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays <= 2) {
        streak++
        lastDate = sessionDate
      } else {
        break
      }
    }

    return streak
  }

  async function save() {
    const userId = await getActiveUserId()
    if (!userId) { toast.error('Please sign in again'); return }

    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        unit,
        weekly_goal: Math.min(14, Math.max(1, weeklyGoal || 4)),
        target_weeks: targetWeeks === '' ? null : targetWeeks,
        goal_start: goalStart || null,
        bjj_weekly_goal: Math.min(14, Math.max(1, bjjWeeklyGoal || 2)),
        cardio_weekly_goal: Math.min(14, Math.max(1, cardioWeeklyGoal || 3)),
        show_strength_goal: showStrengthGoal,
        show_bjj_goal: showBjjGoal,
        show_cardio_goal: showCardioGoal
      }, { onConflict: 'id', ignoreDuplicates: false })

      if (error) {
        toast.error('Failed to save: ' + error.message)
        return
      }

      toast.success('Settings saved!')
      setTimeout(() => router.push('/dashboard'), 500)
    } catch (err) {
      toast.error('Failed to save settings')
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
        email: userEmail,
        password: currentPassword
      })

      if (signInError) {
        toast.error('Current password is incorrect')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        toast.error('Failed to change password')
        return
      }

      toast.success('Password changed!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSheet(false)
    } catch (err) {
      toast.error('Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark p-4 pb-24 space-y-4">
        <Skeleton variant="rectangular" className="h-10 w-32" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-32" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-dark pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-brand-dark/80 backdrop-blur-lg border-b border-red-500/10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Customize your experience</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <AnimatedCard delay={0}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-white">{userEmail || 'User'}</p>
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
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Your Stats (30 days)</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.totalWorkouts / 20) * 100} color="#ef4444" />
                  <span className="absolute text-sm font-bold text-white">{userStats.totalWorkouts}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Workouts</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.totalBjjSessions / 10) * 100} color="#a855f7" />
                  <span className="absolute text-sm font-bold text-white">{userStats.totalBjjSessions}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">BJJ</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.currentStreak / 7) * 100} color="#10b981" />
                  <span className="absolute text-sm font-bold text-white">{userStats.currentStreak}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Streak</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <ProgressRing progress={(userStats.avgWeeklyWorkouts / 7) * 100} color="#3b82f6" />
                  <span className="absolute text-sm font-bold text-white">{userStats.avgWeeklyWorkouts}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Avg/Week</p>
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* Units */}
        <AnimatedCard delay={0.1}>
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-white">Weight Unit</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setUnit('lb')}
              className={`p-4 rounded-xl border-2 transition-all ${unit === 'lb'
                ? 'bg-red-500/20 border-red-500/50 text-white'
                : 'bg-surface/50 border-white/[0.07] text-zinc-500 hover:border-white/20'
                }`}
            >
              <p className="font-semibold">Pounds (lb)</p>
              <p className="text-xs opacity-70">Imperial</p>
            </button>
            <button
              onClick={() => setUnit('kg')}
              className={`p-4 rounded-xl border-2 transition-all ${unit === 'kg'
                ? 'bg-red-500/20 border-red-500/50 text-white'
                : 'bg-surface/50 border-white/[0.07] text-zinc-500 hover:border-white/20'
                }`}
            >
              <p className="font-semibold">Kilograms (kg)</p>
              <p className="text-xs opacity-70">Metric</p>
            </button>
          </div>
        </AnimatedCard>

        {/* Strength Goals */}
        <AnimatedCard delay={0.15}>
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-white">Strength Goal</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-zinc-500">Sessions per week</p>
                <span className="text-lg font-bold text-red-400">{weeklyGoal}</span>
              </div>
              <input
                type="range"
                min={1}
                max={14}
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(Number(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>
        </AnimatedCard>

        {/* BJJ Goals */}
        <AnimatedCard delay={0.2}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">BJJ Goal</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-zinc-500">Sessions per week</p>
                <span className="text-lg font-bold text-purple-400">{bjjWeeklyGoal}</span>
              </div>
              <input
                type="range"
                min={1}
                max={14}
                value={bjjWeeklyGoal}
                onChange={(e) => setBjjWeeklyGoal(Number(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>
        </AnimatedCard>

        {/* Cardio Goals */}
        <AnimatedCard delay={0.25}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">Cardio Goal</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-zinc-500">Sessions per week</p>
                <span className="text-lg font-bold text-emerald-400">{cardioWeeklyGoal}</span>
              </div>
              <input
                type="range"
                min={1}
                max={14}
                value={cardioWeeklyGoal}
                onChange={(e) => setCardioWeeklyGoal(Number(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>
        </AnimatedCard>

        {/* Dashboard Visibility */}
        <AnimatedCard delay={0.3}>
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Dashboard Goals</h3>
          </div>
          <p className="text-sm text-zinc-500 mb-4">Choose which goals to show on your dashboard</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Strength</p>
                  <p className="text-xs text-zinc-500">Weekly workout tracking</p>
                </div>
              </div>
              <Toggle enabled={showStrengthGoal} onChange={setShowStrengthGoal} color="bg-red-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-surface/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Jiu Jitsu</p>
                  <p className="text-xs text-zinc-500">Weekly BJJ sessions</p>
                </div>
              </div>
              <Toggle enabled={showBjjGoal} onChange={setShowBjjGoal} color="bg-purple-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-surface/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Cardio</p>
                  <p className="text-xs text-zinc-500">Weekly cardio sessions</p>
                </div>
              </div>
              <Toggle enabled={showCardioGoal} onChange={setShowCardioGoal} color="bg-emerald-500" />
            </div>
          </div>
        </AnimatedCard>

        {/* Account Section */}
        <AnimatedCard delay={0.35}>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-zinc-500" />
            <h3 className="font-semibold text-white">Account</h3>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setShowPasswordSheet(true)}
              className="w-full p-4 rounded-xl bg-surface/50 hover:bg-surface-elevated transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-zinc-500" />
                <span className="text-white">Change Password</span>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full p-4 rounded-xl bg-surface/50 hover:bg-surface-elevated transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-zinc-500" />
                <span className="text-white">Sign Out</span>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </AnimatedCard>

        {/* Danger Zone */}
        {/* Data Export */}
        <DataExport />

        <AnimatedCard delay={0.4} className="border border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-red-400">Danger Zone</h3>
          </div>
          <DeleteAllData />
        </AnimatedCard>
      </div>

      {/* Sticky Save Button */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent p-4 pb-20"
      >
        <div className="max-w-lg mx-auto">
          <Button
            fullWidth
            size="lg"
            loading={saving}
            onClick={save}
          >
            Save Settings
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
              placeholder="At least 6 characters"
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

      {/* Logout Confirmation */}
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

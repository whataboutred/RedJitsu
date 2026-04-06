'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { useToast } from '@/components/Toast'

type Profile = {
  unit: 'lb'|'kg'|null
  weekly_goal: number|null
  target_weeks: number|null
  goal_start: string|null
  bjj_weekly_goal: number|null
  cardio_weekly_goal: number|null
  show_strength_goal: boolean|null
  show_bjj_goal: boolean|null
  show_cardio_goal: boolean|null
}

type UserStats = {
  totalWorkouts: number
  totalBjjSessions: number
  currentStreak: number
  avgWeeklyWorkouts: number
  avgWeeklyBjj: number
  joinedDate: string
}

export default function EnhancedSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const toast = useToast()

  // Profile settings
  const [unit, setUnit] = useState<'lb'|'kg'>('lb')
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [targetWeeks, setTargetWeeks] = useState<number|''>('')
  const [goalStart, setGoalStart] = useState<string>('')
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)
  const [cardioWeeklyGoal, setCardioWeeklyGoal] = useState<number>(3)

  // Goal visibility toggles
  const [showStrengthGoal, setShowStrengthGoal] = useState<boolean>(true)
  const [showBjjGoal, setShowBjjGoal] = useState<boolean>(true)
  const [showCardioGoal, setShowCardioGoal] = useState<boolean>(false)

  // User stats for context
  const [userStats, setUserStats] = useState<UserStats | null>(null)

  // Password change
  const [currentPassword, setCurrentPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [changingPassword, setChangingPassword] = useState<boolean>(false)
  const [showPasswordSection, setShowPasswordSection] = useState(false)

  // Goal recommendations
  const [showGoalSuggestions, setShowGoalSuggestions] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  async function loadUserData() {
    const userId = await getActiveUserId()
    if (!userId) { router.push('/login'); return }

    try {
      // First, try to get existing profile
      let { data: p, error } = await supabase
        .from('profiles')
        .select('unit,weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error loading profile:', error)
      }

      // If no profile exists, create one with defaults
      if (!p) {
        console.log('No profile found, creating default profile')
        const { data: newProfile, error: createError } = await supabase
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
          }, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select('unit,weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
          .single()

        if (createError) {
          console.error('Error creating profile:', createError)
        } else {
          p = newProfile
          console.log('Created default profile:', p)
        }
      }

      if (p) {
        console.log('Loaded profile data:', p)
        setUnit(((p as Profile).unit ?? 'lb') as 'lb'|'kg')
        setWeeklyGoal((p as Profile).weekly_goal ?? 4)
        setTargetWeeks(((p as Profile).target_weeks ?? null) as number|null ?? '')
        setGoalStart(((p as Profile).goal_start ?? null) as string|null ?? '')
        setBjjWeeklyGoal((p as Profile).bjj_weekly_goal ?? 2)
        setCardioWeeklyGoal((p as Profile).cardio_weekly_goal ?? 3)
        setShowStrengthGoal((p as Profile).show_strength_goal ?? true)
        setShowBjjGoal((p as Profile).show_bjj_goal ?? true)
        setShowCardioGoal((p as Profile).show_cardio_goal ?? false)
      } else {
        console.log('Still no profile found, using component defaults')
      }
    } catch (err) {
      console.error('Error in loadUserData:', err)
    }

    // Load user stats for context
    await loadUserStats(userId)
    setLoading(false)
  }

  async function loadUserStats(userId: string) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // Get workout stats
    const { data: workouts } = await supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgoStr)

    const { data: bjjSessions } = await supabase
      .from('bjj_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgoStr)

    // Get user join date
    const { data: { user } } = await supabase.auth.getUser()
    const joinedDate = user?.created_at || new Date().toISOString()

    const totalWorkouts = workouts?.length || 0
    const totalBjjSessions = bjjSessions?.length || 0
    const avgWeeklyWorkouts = Math.round((totalWorkouts / 4.3) * 10) / 10
    const avgWeeklyBjj = Math.round((totalBjjSessions / 4.3) * 10) / 10

    // Calculate current streak (simplified)
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
    // Simplified streak calculation - could be enhanced
    const allSessions = [
      ...workouts.map(w => ({ date: w.created_at, type: 'workout' })),
      ...bjjSessions.map(b => ({ date: b.created_at, type: 'bjj' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    let streak = 0
    let lastDate = new Date()
    
    for (const session of allSessions) {
      const sessionDate = new Date(session.date)
      const diffDays = Math.floor((lastDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays <= 2) { // Allow 1 day gap
        streak++
        lastDate = sessionDate
      } else {
        break
      }
    }

    return streak
  }

  function getGoalSuggestions() {
    if (!userStats) return []

    const suggestions = []
    
    if (userStats.avgWeeklyWorkouts > 0) {
      if (userStats.avgWeeklyWorkouts < weeklyGoal - 1) {
        suggestions.push({
          type: 'reduce',
          message: `Consider reducing to ${Math.ceil(userStats.avgWeeklyWorkouts)} sessions - closer to your current average`,
          value: Math.ceil(userStats.avgWeeklyWorkouts)
        })
      } else if (userStats.avgWeeklyWorkouts > weeklyGoal + 1) {
        suggestions.push({
          type: 'increase',
          message: `You're averaging ${userStats.avgWeeklyWorkouts} sessions - consider increasing your goal`,
          value: Math.ceil(userStats.avgWeeklyWorkouts)
        })
      }
    }

    if (userStats.avgWeeklyBjj > 0) {
      if (userStats.avgWeeklyBjj < bjjWeeklyGoal - 1) {
        suggestions.push({
          type: 'reduce-bjj',
          message: `BJJ: Consider ${Math.ceil(userStats.avgWeeklyBjj)} sessions based on your current average`,
          value: Math.ceil(userStats.avgWeeklyBjj)
        })
      } else if (userStats.avgWeeklyBjj > bjjWeeklyGoal + 1) {
        suggestions.push({
          type: 'increase-bjj',
          message: `BJJ: You're averaging ${userStats.avgWeeklyBjj} sessions - consider increasing`,
          value: Math.ceil(userStats.avgWeeklyBjj)
        })
      }
    }

    return suggestions
  }

  async function save() {
    const userId = await getActiveUserId()
    if (!userId) { toast.warning('Please sign in again'); return }
    
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
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      
      if (error) {
        console.error('Save error:', error)
        toast.error('Failed to save settings: ' + error.message)
        return
      }
      
      toast.success('Settings saved successfully!')
      setTimeout(() => router.push('/dashboard'), 500)
    } catch (err) {
      console.error('Save error:', err)
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
      toast.warning('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.warning('New password must be at least 6 characters long')
      return
    }

    setChangingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || '',
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
        console.error('Password update error:', updateError)
        toast.error('Failed to change password: ' + updateError.message)
        return
      }

      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSection(false)
    } catch (err) {
      console.error('Password change error:', err)
      toast.error('Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="card max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          <div className="h-4 bg-white/10 rounded w-2/3"></div>
          <div className="h-10 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* User Stats Overview */}
      {userStats && (
        <div className="card">
          <div className="font-medium mb-4">📊 Your Training Overview</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-brand-red">{userStats.totalWorkouts}</div>
              <div className="text-sm text-white/70">Workouts (30d)</div>
            </div>
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{userStats.totalBjjSessions}</div>
              <div className="text-sm text-white/70">BJJ Sessions (30d)</div>
            </div>
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{userStats.currentStreak}</div>
              <div className="text-sm text-white/70">Current Streak</div>
            </div>
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{userStats.avgWeeklyWorkouts}</div>
              <div className="text-sm text-white/70">Weekly Average</div>
            </div>
          </div>
        </div>
      )}

      {/* Units Setting */}
      <div className="card space-y-4">
        <div className="font-medium">⚖️ Measurement Units</div>
        <div className="flex gap-3">
          <button
            type="button"
            aria-pressed={unit === 'lb'}
            onClick={() => setUnit('lb')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              unit === 'lb' 
                ? 'bg-brand-red/20 border-brand-red text-white border' 
                : 'bg-black/30 border border-white/10 text-white/70 hover:bg-black/50'
            }`}
          >
            🇺🇸 Pounds (lb)
          </button>
          <button
            type="button"
            aria-pressed={unit === 'kg'}
            onClick={() => setUnit('kg')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              unit === 'kg' 
                ? 'bg-brand-red/20 border-brand-red text-white border' 
                : 'bg-black/30 border border-white/10 text-white/70 hover:bg-black/50'
            }`}
          >
            🌍 Kilograms (kg)
          </button>
        </div>
        <div className="text-xs text-white/60 bg-black/20 rounded-lg p-3">
          💡 This affects how weights are displayed in new workouts
        </div>
      </div>

      {/* Strength Goals */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">💪 Strength Training Goals</div>
          {userStats && (
            <button 
              className="toggle text-sm" 
              onClick={() => setShowGoalSuggestions(!showGoalSuggestions)}
            >
              {showGoalSuggestions ? 'Hide' : 'Show'} Smart Suggestions
            </button>
          )}
        </div>

        {showGoalSuggestions && (
          <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4">
            <div className="font-medium text-brand-red/90 mb-3">🎯 Personalized Suggestions</div>
            {getGoalSuggestions().length > 0 ? (
              <div className="space-y-2">
                {getGoalSuggestions().map((suggestion, idx) => (
                  <div key={idx} className="text-sm text-white/80 bg-black/30 rounded-lg p-3">
                    {suggestion.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/70">
                Your goals look well-aligned with your current training patterns! 🎉
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <div className="mb-2 text-sm text-white/80 font-medium">Sessions per week (1–14)</div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={14}
                className="flex-1"
                value={weeklyGoal}
                onChange={e => setWeeklyGoal(Number(e.target.value))}
              />
              <div className="w-16 text-center bg-black/30 rounded-lg p-2 font-medium">
                {weeklyGoal}
              </div>
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className="mb-2 text-sm text-white/80">Target length (weeks, optional)</div>
              <input
                type="number"
                min={1}
                max={52}
                className="input w-full"
                value={targetWeeks === '' ? '' : String(targetWeeks)}
                onChange={e => {
                  const v = e.target.value.trim()
                  setTargetWeeks(v === '' ? '' : Math.min(52, Math.max(1, Number(v))))
                }}
                placeholder="e.g., 12 weeks"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm text-white/80">Start date (optional)</div>
              <input
                type="date"
                className="input w-full"
                value={goalStart}
                onChange={e => setGoalStart(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* BJJ Goals */}
      <div className="card space-y-4">
        <div className="font-medium">🥋 Jiu Jitsu Goals</div>
        <label className="block">
          <div className="mb-2 text-sm text-white/80 font-medium">Sessions per week (1–14)</div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={14}
              className="flex-1"
              value={bjjWeeklyGoal}
              onChange={e => setBjjWeeklyGoal(Number(e.target.value))}
            />
            <div className="w-16 text-center bg-black/30 rounded-lg p-2 font-medium">
              {bjjWeeklyGoal}
            </div>
          </div>
        </label>
        <div className="text-xs text-white/60 bg-black/20 rounded-lg p-3">
          📈 We'll track your total mat time and consistency each week
        </div>
      </div>

      {/* Cardio Goals */}
      <div className="card space-y-4">
        <div className="font-medium">❤️ Cardio Goals</div>
        <label className="block">
          <div className="mb-2 text-sm text-white/80 font-medium">Sessions per week (1–14)</div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={14}
              className="flex-1"
              value={cardioWeeklyGoal}
              onChange={e => setCardioWeeklyGoal(Number(e.target.value))}
            />
            <div className="w-16 text-center bg-black/30 rounded-lg p-2 font-medium">
              {cardioWeeklyGoal}
            </div>
          </div>
        </label>
        <div className="text-xs text-white/60 bg-black/20 rounded-lg p-3">
          🏃 Track cardio activities like running, cycling, and machine workouts
        </div>
      </div>

      {/* Dashboard Goals Visibility */}
      <div className="card space-y-4">
        <div className="font-medium">👁️ Dashboard Goal Visibility</div>
        <div className="text-sm text-white/70 mb-4">
          Control which goal cards appear on your dashboard. Disabled goals won't show up, keeping your dashboard focused on what matters to you.
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💪</span>
              <div>
                <div className="font-medium text-white/90">Strength Training Goal</div>
                <div className="text-sm text-white/70">Weekly workout consistency tracking</div>
              </div>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 ${
                showStrengthGoal ? 'bg-brand-red' : 'bg-gray-600'
              }`}
              onClick={() => setShowStrengthGoal(!showStrengthGoal)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${
                  showStrengthGoal ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🥋</span>
              <div>
                <div className="font-medium text-white/90">Jiu Jitsu Goal</div>
                <div className="text-sm text-white/70">Weekly BJJ session tracking</div>
              </div>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showBjjGoal ? 'bg-blue-500' : 'bg-gray-600'
              }`}
              onClick={() => setShowBjjGoal(!showBjjGoal)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${
                  showBjjGoal ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">❤️</span>
              <div>
                <div className="font-medium text-white/90">Cardio Goal</div>
                <div className="text-sm text-white/70">Weekly cardio activity tracking</div>
              </div>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 ${
                showCardioGoal ? 'bg-pink-500' : 'bg-gray-600'
              }`}
              onClick={() => setShowCardioGoal(!showCardioGoal)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ${
                  showCardioGoal ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="text-xs text-white/60 bg-black/20 rounded-lg p-3">
          💡 You can always re-enable goals later. Your goal settings and progress are preserved.
        </div>
      </div>

      {/* Password Section */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">🔒 Account Security</div>
          <button 
            className="toggle" 
            onClick={() => setShowPasswordSection(!showPasswordSection)}
          >
            {showPasswordSection ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        {showPasswordSection && (
          <div className="space-y-4 bg-black/20 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block">
                <div className="mb-1 text-sm text-white/80">Current password</div>
                <input
                  type="password"
                  className="input w-full"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-sm text-white/80">New password</div>
                <input
                  type="password"
                  className="input w-full"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-sm text-white/80">Confirm new password</div>
                <input
                  type="password"
                  className="input w-full"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                />
              </label>
            </div>
            <button 
              className="btn disabled:opacity-50" 
              onClick={changePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? 'Changing...' : 'Update Password'}
            </button>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="sticky bottom-4 bg-black/90 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
        <button 
          className="btn w-full disabled:opacity-50" 
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  )
}
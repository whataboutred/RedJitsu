'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'

type BJJSession = {
  id: string
  kind: 'class' | 'drilling' | 'open_mat'
  duration_min: number
  intensity: 'low' | 'medium' | 'high'
  performed_at: string
  notes: string | null
}

type SessionPattern = {
  kind: 'Class' | 'Drilling' | 'Open Mat'
  avgDuration: number
  commonIntensity: 'low' | 'medium' | 'high'
  frequency: number
  lastUsed: string
}

type BJJQuickStartProps = {
  onQuickStart: (pattern: {
    kind: 'Class' | 'Drilling' | 'Open Mat'
    duration: number
    intensity: 'low' | 'medium' | 'high'
  }) => void
}

const SESSION_EMOJIS = {
  'Class': '🥋',
  'Drilling': '🔥', 
  'Open Mat': '⚡'
} as const

const INTENSITY_COLORS = {
  'low': 'bg-green-500/20 text-green-400',
  'medium': 'bg-orange-500/20 text-orange-400',
  'high': 'bg-red-500/20 text-red-400'
} as const

export default function BJJQuickStart({ onQuickStart }: BJJQuickStartProps) {
  const [patterns, setPatterns] = useState<SessionPattern[]>([])
  const [weekStats, setWeekStats] = useState({ sessions: 0, totalMinutes: 0, weeklyGoal: 2 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessionPatterns()
  }, [])

  async function loadSessionPatterns() {
    const userId = await getActiveUserId()
    if (!userId) return

    // Get sessions from last 60 days for pattern analysis
    const { data: sessions } = await supabase
      .from('bjj_sessions')
      .select('kind, duration_min, intensity, performed_at, notes')
      .eq('user_id', userId)
      .gte('performed_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order('performed_at', { ascending: false })

    // Get current week stats
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday

    const { data: weekSessions } = await supabase
      .from('bjj_sessions')
      .select('duration_min')
      .eq('user_id', userId)
      .gte('performed_at', weekStart.toISOString())

    const { data: profile } = await supabase
      .from('profiles')
      .select('bjj_weekly_goal')
      .eq('id', userId)
      .single()

    if (sessions && sessions.length > 0) {
      // Analyze patterns by session type
      const typeGroups = sessions.reduce((acc, session) => {
        const kind = session.kind === 'open_mat' ? 'Open Mat' : 
                    session.kind === 'drilling' ? 'Drilling' : 'Class'
        
        if (!acc[kind]) {
          acc[kind] = {
            durations: [] as number[],
            intensities: [] as string[],
            dates: [] as string[]
          }
        }
        
        acc[kind].durations.push(session.duration_min)
        acc[kind].intensities.push(session.intensity)
        acc[kind].dates.push(session.performed_at)
        
        return acc
      }, {} as Record<string, { durations: number[], intensities: string[], dates: string[] }>)

      // Convert to patterns
      const sessionPatterns: SessionPattern[] = Object.entries(typeGroups).map(([kind, data]) => {
        const avgDuration = Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        
        // Find most common intensity
        const intensityCounts = data.intensities.reduce((acc, intensity) => {
          acc[intensity] = (acc[intensity] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const commonIntensity = Object.entries(intensityCounts)
          .sort(([,a], [,b]) => b - a)[0][0] as 'low' | 'medium' | 'high'

        return {
          kind: kind as 'Class' | 'Drilling' | 'Open Mat',
          avgDuration,
          commonIntensity,
          frequency: data.durations.length,
          lastUsed: data.dates[0] // Most recent (already sorted desc)
        }
      }).sort((a, b) => b.frequency - a.frequency) // Sort by frequency

      setPatterns(sessionPatterns)
    }

    // Set week stats
    const totalMinutes = weekSessions?.reduce((sum, s) => sum + (s.duration_min || 0), 0) || 0
    setWeekStats({
      sessions: weekSessions?.length || 0,
      totalMinutes,
      weeklyGoal: profile?.bjj_weekly_goal || 2
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="font-medium mb-3">🥋 Quick Start</div>
        <div className="text-white/60 text-sm">Loading session patterns...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* This Week Progress */}
      <div className="card">
        <div className="font-medium mb-3">📊 This Week's Training</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-red">{weekStats.sessions}</div>
            <div className="text-sm text-white/70">Sessions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{weekStats.totalMinutes}</div>
            <div className="text-sm text-white/70">Mat Minutes</div>
          </div>
          <div className="text-center col-span-2 md:col-span-1">
            <div className={`text-2xl font-bold ${weekStats.sessions >= weekStats.weeklyGoal ? 'text-green-400' : 'text-orange-400'}`}>
              {weekStats.sessions}/{weekStats.weeklyGoal}
            </div>
            <div className="text-sm text-white/70">Goal Progress</div>
          </div>
        </div>
      </div>

      {/* Quick Start Patterns */}
      {patterns.length > 0 ? (
        <div className="card">
          <div className="font-medium mb-3">🚀 Quick Start - Your Training Patterns</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patterns.slice(0, 4).map((pattern) => (
              <button
                key={pattern.kind}
                className="text-left bg-black/30 hover:bg-black/50 rounded-xl p-4 transition-all duration-200 border border-transparent hover:border-brand-red/30"
                onClick={() => onQuickStart({
                  kind: pattern.kind,
                  duration: pattern.avgDuration,
                  intensity: pattern.commonIntensity
                })}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{SESSION_EMOJIS[pattern.kind]}</span>
                  <span className="font-medium text-white/90">{pattern.kind}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                      {pattern.avgDuration} min
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${INTENSITY_COLORS[pattern.commonIntensity]}`}>
                      {pattern.commonIntensity}
                    </span>
                  </div>
                  
                  <div className="text-xs text-white/60">
                    Used {pattern.frequency}x • Last: {new Date(pattern.lastUsed).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="font-medium mb-3">🥋 Quick Start</div>
          <div className="text-white/60 text-sm">
            Log a few sessions to see your training patterns here!
          </div>
          
          {/* Default quick starts for new users */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            <button
              className="bg-black/30 hover:bg-black/50 rounded-xl p-3 text-center transition-all duration-200"
              onClick={() => onQuickStart({ kind: 'Class', duration: 60, intensity: 'medium' })}
            >
              <div className="text-lg mb-1">🥋</div>
              <div className="text-sm font-medium">Class</div>
              <div className="text-xs text-white/60">60 min • Medium</div>
            </button>
            
            <button
              className="bg-black/30 hover:bg-black/50 rounded-xl p-3 text-center transition-all duration-200"
              onClick={() => onQuickStart({ kind: 'Drilling', duration: 45, intensity: 'high' })}
            >
              <div className="text-lg mb-1">🔥</div>
              <div className="text-sm font-medium">Drilling</div>
              <div className="text-xs text-white/60">45 min • High</div>
            </button>
            
            <button
              className="bg-black/30 hover:bg-black/50 rounded-xl p-3 text-center transition-all duration-200"
              onClick={() => onQuickStart({ kind: 'Open Mat', duration: 90, intensity: 'medium' })}
            >
              <div className="text-lg mb-1">⚡</div>
              <div className="text-sm font-medium">Open Mat</div>
              <div className="text-xs text-white/60">90 min • Medium</div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
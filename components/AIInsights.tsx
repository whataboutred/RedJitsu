'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RefreshCw, Clock, ChevronDown, ChevronUp, CheckCircle2, Zap, Search, Target } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO } from '@/lib/activeUser'
import { useDataRefresh } from '@/hooks/useDataRefresh'

type InsightsResponse = {
  content: string
  cached: boolean
  generatedAt: string
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))

  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`
  if (hours >= 1) return `${hours}h ago`
  if (minutes >= 1) return `${minutes}m ago`
  return 'just now'
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={key++} className="text-base font-display uppercase tracking-wide text-white mt-4 mb-1.5 first:mt-0 flex items-center gap-2">
          {getSectionIcon(line.replace('## ', ''))}
          {line.replace('## ', '')}
        </h3>
      )
    } else if (line.match(/^[-*] /)) {
      elements.push(
        <p key={key++} className="text-sm text-zinc-300 pl-3 py-0.5 border-l border-white/10 ml-1">
          {renderInline(line.replace(/^[-*] /, ''))}
        </p>
      )
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <p key={key++} className="text-sm text-zinc-300 pl-3 py-0.5 border-l border-white/10 ml-1">
          {renderInline(line)}
        </p>
      )
    } else if (line.trim()) {
      elements.push(
        <p key={key++} className="text-sm text-zinc-300 leading-relaxed">
          {renderInline(line)}
        </p>
      )
    }
  }

  return elements
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-medium">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function getSectionIcon(section: string) {
  const lower = section.toLowerCase()
  if (lower.includes('win') || lower.includes('going well') || lower.includes('strength')) {
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
  }
  if (lower.includes('fix') || lower.includes('improve') || lower.includes('work')) {
    return <Zap className="w-4 h-4 text-amber-400 shrink-0" />
  }
  if (lower.includes('observation') || lower.includes('pattern')) {
    return <Search className="w-4 h-4 text-blue-400 shrink-0" />
  }
  if (lower.includes('focus') || lower.includes('week')) {
    return <Target className="w-4 h-4 text-brand-red shrink-0" />
  }
  return null
}

export default function AIInsights() {
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [hasCheckedCache, setHasCheckedCache] = useState(false)

  // Auto-load cached insights on mount
  useEffect(() => {
    if (DEMO) return
    loadInsights(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When training data or settings change, ask the server again — it
  // regenerates automatically once the data signature stops matching.
  useDataRefresh(() => {
    if (!DEMO && !loading) loadInsights(false)
  })

  // Hide in demo mode — requires real auth for API calls
  if (DEMO) return null

  async function loadInsights(forceRefresh: boolean) {
    if (loading) return // Prevent concurrent requests
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Please log in to view AI insights')
        setLoading(false)
        setHasCheckedCache(true)
        return
      }

      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ forceRefresh }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate insights')
      }

      const data: InsightsResponse = await res.json()
      setInsights(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
      setHasCheckedCache(true)
    }
  }

  // Don't render anything until we've checked for cached insights
  if (!hasCheckedCache && !loading) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="backdrop-blur-sm rounded-2xl border border-white/[0.07] bg-gradient-to-br from-violet-500/10 via-surface/80 to-surface/80 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h3 className="font-display uppercase text-lg text-white">AI Coach Insights</h3>
          {insights?.generatedAt && (
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(insights.generatedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                loadInsights(true)
              }}
              disabled={loading}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
              title="Refresh insights"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4">
              {/* Loading state */}
              {loading && !insights && (
                <div className="space-y-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                    Analyzing your training data...
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="space-y-1.5">
                        <div className="h-3.5 bg-surface-elevated rounded animate-pulse" style={{ width: `${30 + i * 10}%` }} />
                        <div className="h-3 bg-surface-elevated/60 rounded animate-pulse" style={{ width: `${60 + i * 5}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <div className="py-2">
                  <p className="text-sm text-red-400 mb-2">{error}</p>
                  <button
                    onClick={() => loadInsights(false)}
                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* No insights yet - show generate button */}
              {!insights && !loading && !error && hasCheckedCache && (
                <div className="py-3 text-center">
                  <p className="text-sm text-zinc-400 mb-3">
                    Get AI-powered analysis of your training trends
                  </p>
                  <button
                    onClick={() => loadInsights(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/20 transition-colors text-sm font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Insights
                  </button>
                </div>
              )}

              {/* Insights content */}
              {insights && !loading && (
                <div className="space-y-0.5">
                  {renderMarkdown(insights.content)}
                </div>
              )}

              {/* Loading overlay when refreshing with existing content */}
              {insights && loading && (
                <div className="relative space-y-0.5 opacity-50">
                  {renderMarkdown(insights.content)}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

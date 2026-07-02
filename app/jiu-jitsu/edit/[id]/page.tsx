'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Target, Flame, Zap, TrendingUp, FileText, Check, X, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import BackgroundLogo from '@/components/BackgroundLogo'
import { AnimatedCard } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { Counter } from '@/components/ui/Counter'
import { getBjjSession, updateBjjSession } from '@/lib/api'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { supabase } from '@/lib/supabaseClient'
import { isoToDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { useToast } from '@/components/Toast'
import { isUuid } from '@/lib/validation'
import { beltStyle } from '@/lib/belt'
import { TECHNIQUE_TAGS } from '@/lib/bjjConstants'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

// Same building blocks as the create page so edit looks identical.
const SESSION_TYPES = [
  { value: 'Class' as Kind, icon: <Target className="w-6 h-6" />, label: 'Class', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-300', activeGradient: 'from-purple-500/40 to-purple-700/20', borderColor: 'border-purple-500/50' },
  { value: 'Drilling' as Kind, icon: <Flame className="w-6 h-6" />, label: 'Drilling', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-300', activeGradient: 'from-purple-500/40 to-purple-700/20', borderColor: 'border-purple-500/50' },
  { value: 'Open Mat' as Kind, icon: <Zap className="w-6 h-6" />, label: 'Open Mat', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-300', activeGradient: 'from-purple-500/40 to-purple-700/20', borderColor: 'border-purple-500/50' },
]
const INTENSITY_OPTIONS = [
  { value: 'low' as Intensity, label: 'Low', description: 'Easy flow, technique focus', color: 'bg-emerald-500/10', activeColor: 'bg-emerald-500/20', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/60' },
  { value: 'medium' as Intensity, label: 'Medium', description: 'Good pace, some intensity', color: 'bg-amber-500/10', activeColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/60' },
  { value: 'high' as Intensity, label: 'High', description: 'Hard rolls, competition prep', color: 'bg-red-500/10', activeColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/60' },
]
const DURATION_PRESETS = [30, 45, 60, 75, 90, 120]

export default function EditJiuJitsuPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  const toast = useToast()

  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [performedAt, setPerformedAt] = useState<string>('')
  const [kind, setKind] = useState<Kind>('Class')
  const [duration, setDuration] = useState<number>(60)
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [notes, setNotes] = useState<string>('')

  const [rounds, setRounds] = useState<number>(0)
  const [subsFor, setSubsFor] = useState<number>(0)
  const [subsAgainst, setSubsAgainst] = useState<number>(0)
  const [techniques, setTechniques] = useState<string[]>([])
  const [partners, setPartners] = useState<string[]>([])
  const [partnerInput, setPartnerInput] = useState('')
  const [knownPartners, setKnownPartners] = useState<string[]>([])
  const [belt, setBelt] = useState<string>('purple')
  const bs = beltStyle(belt)

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (isDemo || !isUuid(sessionId)) {
        setNotFound(!isDemo)
        setLoading(false)
        return
      }
      const userId = await getActiveUserId()
      if (!userId) { setLoading(false); return }

      const session = await getBjjSession(sessionId, userId).catch(() => null)
      if (!session) {
        setNotFound(true)
      } else {
        setPerformedAt(isoToDatetimeLocal(session.performed_at))
        setKind(session.kind === 'open_mat' ? 'Open Mat' : session.kind === 'drilling' ? 'Drilling' : 'Class')
        setDuration(session.duration_min)
        setIntensity((session.intensity as Intensity) || 'medium')
        setNotes(session.notes || '')
        setRounds(session.rounds ?? 0)
        setSubsFor(session.subs_for ?? 0)
        setSubsAgainst(session.subs_against ?? 0)
        setTechniques(session.techniques ?? [])
        setPartners(session.partners ?? [])
      }

      // Belt (theming) + known partners (autocomplete)
      const { data: prof } = await supabase.from('profiles').select('bjj_belt').eq('id', userId).maybeSingle()
      if (prof?.bjj_belt) setBelt(prof.bjj_belt)
      const { data: partnerRows } = await supabase.from('bjj_sessions').select('partners').eq('user_id', userId).not('partners', 'is', null).limit(200)
      const names = new Set<string>()
      for (const r of partnerRows ?? []) for (const n of (r.partners ?? [])) names.add(n)
      setKnownPartners([...names].sort())

      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function handleSave() {
    if (saving) return
    const userId = await getActiveUserId()
    if (!userId) { toast.warning('Please sign in again.'); return }

    setSaving(true)
    try {
      const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
      await updateBjjSession(sessionId, userId, {
        performed_at: datetimeLocalToISO(performedAt),
        kind: kind === 'Open Mat' ? ('open_mat' as const) : (kind.toLowerCase() as 'class' | 'drilling'),
        duration_min: minutes,
        intensity,
        notes: notes || null,
        rounds: rounds > 0 ? rounds : null,
        subs_for: rounds > 0 ? subsFor : null,
        subs_against: rounds > 0 ? subsAgainst : null,
        techniques: techniques.length ? techniques : null,
        partners: partners.length ? partners : null,
      })
      toast.success('Session updated')
      router.push(`/history?highlight=${sessionId}&type=bjj`)
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to update session')
    } finally {
      setSaving(false)
    }
  }

  function toggleTechnique(t: string) {
    setTechniques((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  function addPartner(name: string) {
    const n = name.trim()
    if (n && !partners.includes(n)) setPartners((prev) => [...prev, n])
    setPartnerInput('')
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-brand-dark p-4 pb-24 space-y-4">
        <BackgroundLogo />
        <Skeleton variant="rectangular" className="h-10 w-48" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-48" />
      </div>
    )
  }

  if (demo || notFound) {
    return (
      <div className="relative min-h-screen bg-brand-dark">
        <BackgroundLogo />
        <main className="relative z-10 p-4 max-w-xl mx-auto pt-10">
          <h1 className="text-2xl font-display uppercase text-white mb-2">
            {demo ? 'Demo mode' : 'Session not found'}
          </h1>
          <p className="text-zinc-400">
            {demo ? (
              <>This is a read-only demo. <Link href="/login" className="text-purple-400 underline">Sign in</Link> to edit sessions.</>
            ) : (
              <>That session doesn&apos;t exist. <Link href="/history" className="text-purple-400 underline">Back to history</Link></>
            )}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />
      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Link
            href="/history"
            className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Back to history"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-display uppercase" style={{ color: bs.hex }}>
              Edit Session
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">Update your mat time</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* When */}
        <AnimatedCard delay={0}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h3 className="font-display uppercase text-lg text-white">When did you train?</h3>
          </div>
          <input
            type="datetime-local"
            className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-purple-500 focus:outline-none transition-colors"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
          />
        </AnimatedCard>

        {/* Training Type */}
        <AnimatedCard delay={0.05}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-purple-400" />
            <h3 className="font-display uppercase text-lg text-white">Training Type</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setKind(t.value)}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  kind === t.value
                    ? `bg-gradient-to-br ${t.activeGradient} ${t.borderColor}`
                    : 'bg-surface/50 border-white/[0.07] hover:border-white/20'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${t.iconBg} flex items-center justify-center mx-auto mb-2 ${t.iconColor}`}>
                  {t.icon}
                </div>
                <p className="font-medium text-sm text-white">{t.label}</p>
              </button>
            ))}
          </div>
        </AnimatedCard>

        {/* Duration */}
        <AnimatedCard delay={0.1}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-400" />
            <h3 className="font-display uppercase text-lg text-white">Duration</h3>
          </div>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setDuration(preset)}
                className={`py-3 rounded-lg text-center transition-all font-medium ${
                  duration === preset ? '' : 'bg-surface/50 text-zinc-500 hover:bg-surface-elevated hover:text-white'
                }`}
                style={duration === preset ? { backgroundColor: bs.hex, color: bs.onAccent } : undefined}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="w-12 h-12 rounded-xl bg-surface-elevated text-white font-bold hover:bg-surface-pressed transition-colors"
              onClick={() => setDuration(Math.max(5, duration - 15))}
            >
              -15
            </button>
            <div className="flex-1 text-center">
              <input
                type="number"
                min="5"
                max="600"
                className="w-full text-center text-2xl font-bold bg-transparent text-white focus:outline-none"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value || 60))}
              />
              <p className="text-xs text-zinc-500 mt-1">minutes</p>
            </div>
            <button
              className="w-12 h-12 rounded-xl bg-surface-elevated text-white font-bold hover:bg-surface-pressed transition-colors"
              onClick={() => setDuration(Math.min(600, duration + 15))}
            >
              +15
            </button>
          </div>
        </AnimatedCard>

        {/* Intensity */}
        <AnimatedCard delay={0.15}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h3 className="font-display uppercase text-lg text-white">Intensity</h3>
          </div>
          <div className="space-y-2">
            {INTENSITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setIntensity(option.value)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  intensity === option.value
                    ? `${option.activeColor} ${option.borderColor} text-white`
                    : `${option.color} border-transparent hover:border-white/10`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${intensity === option.value ? 'text-white' : option.textColor}`}>{option.label}</p>
                    <p className={`text-sm ${intensity === option.value ? 'text-zinc-200' : 'text-zinc-500'}`}>{option.description}</p>
                  </div>
                  {intensity === option.value && <Check className="w-5 h-5 text-white" />}
                </div>
              </button>
            ))}
          </div>
        </AnimatedCard>

        {/* Rolls */}
        <AnimatedCard delay={0.18}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5" style={{ color: bs.hex }} />
            <h3 className="font-display uppercase text-lg text-white">Rolls</h3>
            <span className="text-xs text-zinc-500 ml-auto">Optional</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Counter label="Rounds" value={rounds} onChange={setRounds} />
            <Counter label="Subs for" value={subsFor} onChange={setSubsFor} accent="text-emerald-400" />
            <Counter label="Subs against" value={subsAgainst} onChange={setSubsAgainst} accent="text-red-400" />
          </div>
        </AnimatedCard>

        {/* Techniques */}
        <AnimatedCard delay={0.2}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5" style={{ color: bs.hex }} />
            <h3 className="font-display uppercase text-lg text-white">Techniques</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {TECHNIQUE_TAGS.map((t) => {
              const on = techniques.includes(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleTechnique(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${on ? 'border-transparent' : 'bg-surface border-white/[0.07] text-zinc-400 hover:text-white'}`}
                  style={on ? { backgroundColor: bs.hex, color: bs.onAccent } : undefined}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </AnimatedCard>

        {/* Training partners */}
        <AnimatedCard delay={0.22}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5" style={{ color: bs.hex }} />
            <h3 className="font-display uppercase text-lg text-white">Training Partners</h3>
          </div>
          {partners.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {partners.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-white/[0.07] text-sm text-white">
                  {p}
                  <button onClick={() => setPartners((prev) => prev.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                    <X className="w-3 h-3 text-zinc-500 hover:text-white" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            list="rj-partners-edit"
            aria-label="Add a training partner"
            value={partnerInput}
            onChange={(e) => setPartnerInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPartner(partnerInput) } }}
            onBlur={() => partnerInput && addPartner(partnerInput)}
            placeholder="Add a partner and press enter..."
            className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none transition-colors"
          />
          <datalist id="rj-partners-edit">
            {knownPartners.map((n) => <option key={n} value={n} />)}
          </datalist>
        </AnimatedCard>

        {/* Notes */}
        <AnimatedCard delay={0.24}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5" style={{ color: bs.hex }} />
            <h3 className="font-display uppercase text-lg text-white">Notes</h3>
          </div>
          <textarea
            className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none transition-colors resize-none"
            placeholder="Techniques practiced, key insights..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </AnimatedCard>
      </div>

      {/* Sticky Save Bar — matches the create page */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent px-4 pt-4"
        style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-lg mx-auto flex gap-2">
          <Button
            fullWidth
            size="lg"
            loading={saving}
            onClick={handleSave}
            className="shadow-lg shadow-black/30"
            style={{ backgroundColor: bs.hex, color: bs.onAccent }}
          >
            Update {kind} ({duration} min)
          </Button>
          <IconButton
            icon={<X className="w-5 h-5" />}
            variant="default"
            className="!rounded-2xl !w-14 !h-14"
            onClick={() => router.push('/history')}
            label="Cancel"
          />
        </div>
      </motion.div>
    </div>
  )
}

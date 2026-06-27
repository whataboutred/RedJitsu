'use client'

import { useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Sparkles } from 'lucide-react'
import type { NewPR } from '@/lib/api/personalRecords'
import { hapticCelebrate } from '@/lib/haptics'

const CONFETTI_COLORS = ['#DC2626', '#F59E0B', '#10B981', '#7C3AED', '#3B82F6', '#EC4899']

function Confetti() {
  // Deterministic-enough scatter; regenerated per mount
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.2,
        rotate: Math.random() * 720 - 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    []
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0.6], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  )
}

export default function PRCelebration({
  prs,
  unit,
  isOpen,
  onClose,
}: {
  prs: NewPR[]
  unit: string
  isOpen: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (isOpen && prs.length > 0) hapticCelebrate()
  }, [isOpen, prs.length])

  return (
    <AnimatePresence>
      {isOpen && prs.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={onClose}
        >
          <Confetti />
          <motion.div
            initial={{ scale: 0.8, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="relative w-full max-w-sm rounded-3xl border border-amber-500/25 bg-gradient-to-b from-amber-500/15 via-surface to-surface p-6 text-center shadow-glow-red"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.15 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20"
            >
              <Trophy className="h-9 w-9 text-amber-400" />
            </motion.div>

            <h2 className="mb-1 text-3xl font-display uppercase text-white">
              {prs.length === 1 ? 'New Personal Record!' : `${prs.length} New PRs!`}
            </h2>
            <p className="mb-5 text-sm text-zinc-400">
              You just outlifted your past self. Keep it rolling.
            </p>

            <div className="mb-6 space-y-2 text-left">
              {prs.map((pr) => (
                <div
                  key={pr.exerciseId}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-white">{pr.exerciseName}</div>
                    <div className="text-xs text-zinc-500">
                      {pr.isFirst ? 'First time logged' : `Est. 1RM ${pr.estimated1rm} ${unit}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-amber-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    {pr.weight} {unit} × {pr.reps}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={onClose} className="btn w-full">
              Keep Going
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

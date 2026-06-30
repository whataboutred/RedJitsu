'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Wrench, Sparkles, ShieldCheck, Database, Watch, Brain, Quote } from 'lucide-react'
import BackgroundLogo from '@/components/BackgroundLogo'

const INTEGRATIONS = [
  {
    icon: Watch,
    name: 'Fitbit, via the Google Health API',
    body: 'OAuth 2.0 with PKCE, access tokens encrypted at rest, and a daily background sync that turns heart-rate zones into intensity. Cardio logs itself.',
  },
  {
    icon: Brain,
    name: 'AI coaching, via Anthropic Claude',
    body: 'Server-side only, rate limited and cost capped, with every model response treated as untrusted input.',
  },
  {
    icon: Quote,
    name: 'Daily quote, via a public API',
    body: 'A small third-party integration with a cached fallback, so it never blocks the page.',
  },
]

const SECTIONS = [
  {
    icon: Wrench,
    title: 'Why I built it',
    body: 'Moving into leadership isn’t a reason to stop building. I made Red Jitsu, a real app I actually use, to keep my hands dirty and stay at the level I hold my teams to.',
  },
  {
    icon: Sparkles,
    title: 'Built with AI',
    body: 'I built most of this with AI, not to cut corners, but because using AI well is part of the job now. I’d rather know first-hand where it’s brilliant, where it’s risky, and how to review what it ships than learn it from a slide deck.',
  },
  {
    icon: ShieldCheck,
    title: 'Securing the AI',
    body: 'I build with AI, and I secure the AI I build. The coaching feature is hardened against prompt injection and treats every model response as untrusted input, the exact muscle I want my teams to have.',
  },
  {
    icon: Database,
    title: 'Built like enterprise',
    body: 'I treated it like an enterprise app, not a side project: database-level authorization so users only see their own data, secure coding practices throughout, a security audit with the findings fixed, secrets kept server-side, and a real way to export or delete your data.',
  },
]

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-brand-dark pb-24">
      <BackgroundLogo />

      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display uppercase text-white leading-none">Why I Built This</h1>
            <p className="text-sm text-zinc-500 mt-1">The short version</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4">
        {/* Mark */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-10 pb-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/red-jitsu-mark.png"
            alt="Red Jitsu"
            className="w-20 h-20"
            style={{ filter: 'drop-shadow(0 0 20px rgba(220,38,38,0.2))' }}
          />
        </motion.div>

        <p className="text-center text-zinc-400 leading-relaxed pt-2 pb-8">
          For anyone wondering why a security manager built a fitness app.
        </p>

        {/* Sections */}
        <div className="space-y-9">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.section
                key={s.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-brand-red" />
                  <h2 className="font-display uppercase text-lg text-white">{s.title}</h2>
                </div>
                <p className="text-zinc-300 leading-relaxed text-[15px]">{s.body}</p>
              </motion.section>
            )
          })}
        </div>

        {/* Under the hood — live integrations */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border-t border-white/[0.06] mt-10 pt-8"
        >
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display uppercase text-lg text-white">Under the hood</h2>
          </div>
          <p className="text-sm text-zinc-500 mb-5">Three live integrations, each handled the way I&rsquo;d expect at work.</p>
          <div className="space-y-4">
            {INTEGRATIONS.map((it) => {
              const Icon = it.icon
              return (
                <div key={it.name} className="flex gap-3 rounded-2xl bg-surface border border-white/[0.07] p-4">
                  <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center flex-shrink-0 text-brand-red">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-[15px] leading-snug">{it.name}</p>
                    <p className="text-zinc-400 leading-relaxed text-[13px] mt-1">{it.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* Footer */}
        <div className="flex flex-col items-center gap-3 pt-12">
          <div className="flex items-center gap-2 opacity-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/redlabs-mark.png" alt="" className="h-3.5 w-auto" style={{ mixBlendMode: 'lighten' }} />
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">A Red Labs App</span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-brand-red hover:text-red-400 transition-colors"
          >
            ‹ Back to the app
          </Link>
        </div>
      </div>
    </div>
  )
}

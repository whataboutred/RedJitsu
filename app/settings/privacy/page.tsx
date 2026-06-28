'use client'

import Link from 'next/link'
import { ArrowLeft, Trash2, ShieldCheck } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import DeleteAllData from '@/components/DeleteAllData'
import DataExport from '@/components/DataExport'
import BackgroundLogo from '@/components/BackgroundLogo'

export default function PrivacyPage() {
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
            <h1 className="text-3xl font-display uppercase text-white leading-none">Privacy & Data</h1>
            <p className="text-sm text-zinc-500 mt-1">Export or erase your data</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-zinc-500 text-sm px-1">
          <ShieldCheck className="w-4 h-4" />
          Your data is yours. Download a copy anytime, or wipe it for good.
        </div>

        {/* Data Export */}
        <DataExport />

        {/* Danger Zone */}
        <AnimatedCard className="border border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h3 className="font-display uppercase text-lg text-red-400">Danger Zone</h3>
          </div>
          <DeleteAllData />
        </AnimatedCard>
      </div>
    </div>
  )
}

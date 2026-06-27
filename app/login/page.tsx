'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import LoginForm from '@/components/LoginForm'
import Wordmark from '@/components/Wordmark'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') router.push('/dashboard')
    })
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(1200px_circle_at_50%_0%,rgba(239,68,68,0.15),transparent)]">
        <div className="w-full max-w-md space-y-6">
        {/* Brand wordmark */}
        <div className="flex flex-col items-center gap-2">
          <Wordmark size="xl" className="drop-shadow-[0_0_24px_rgba(239,68,68,0.25)]" />
          <p className="text-sm text-zinc-500 uppercase tracking-[0.2em]">Training</p>
        </div>

        {/* Auth card */}
        <div className="card p-4">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

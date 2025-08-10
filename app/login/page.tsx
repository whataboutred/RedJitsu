'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import LoginForm from '@/components/LoginForm'

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
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3">
          {/* NOTE: keep the filename exactly as in /public */}
          <img
            src="/red-jitsu-logo.png?v=2"
            width={160}
            height={160}
            alt="Red Jitsu Training"
            className="mx-auto block drop-shadow-[0_0_24px_rgba(239,68,68,0.35)]"
          />
          <h1 className="text-xl font-semibold">Red Jitsu Training</h1>
        </div>

        {/* Auth card */}
        <div className="card p-4">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

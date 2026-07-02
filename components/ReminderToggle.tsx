'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { isDemoVisitor } from '@/lib/activeUser'
import { pushSupported, isPushEnabled, enablePush, disablePush } from '@/lib/push'

export function ReminderToggle() {
  const toast = useToast()
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    ;(async () => {
      setDemo(await isDemoVisitor())
      setSupported(pushSupported())
      setEnabled(await isPushEnabled())
    })()
  }, [])

  async function toggle() {
    if (demo) { toast.warning('Sign in to enable reminders'); return }
    setBusy(true)
    try {
      if (enabled) {
        await disablePush()
        setEnabled(false)
        toast.success('Reminders turned off')
      } else {
        const r = await enablePush()
        if (r === 'enabled') { setEnabled(true); toast.success('Reminders on') }
        else if (r === 'denied') toast.error('Notifications are blocked — enable them in your device settings')
        else toast.warning('Add Red Jitsu to your home screen first, then try again')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatedCard delay={0.1}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red flex-shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display uppercase text-lg text-white leading-none">Reminders</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {enabled ? 'On — training nudges + a weekly review' : 'Gentle nudges to log training and a weekly review'}
          </p>
        </div>
        {supported ? (
          <Button variant={enabled ? 'secondary' : 'primary'} size="sm" loading={busy} onClick={toggle}>
            {enabled ? 'Turn off' : 'Enable'}
          </Button>
        ) : (
          <span className="text-[11px] text-zinc-600 text-right max-w-[9rem]">Add to your home screen to enable</span>
        )}
      </div>
    </AnimatedCard>
  )
}

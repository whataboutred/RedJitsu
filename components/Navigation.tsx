'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Dumbbell,
  History,
  User,
  Plus,
  X,
  Activity,
  Heart,
  LogOut,
  Settings,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, isDemoVisitor } from '@/lib/activeUser'
import SafeAutoRefresh from '@/components/SafeAutoRefresh'

// Check if we're in workout mode (hide nav)
const workoutModeRoutes = ['/workouts/new', '/workouts/edit']

function DemoBadge() {
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    isDemoVisitor().then(demo => setIsDemo(demo))
  }, [])

  if (!isDemo) return null

  return (
    <span className="ml-2 text-2xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
      demo
    </span>
  )
}

// Desktop Header
function DesktopHeader({ signOut }: { signOut: () => Promise<void> }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/history', label: 'History', icon: History },
    { href: '/programs', label: 'Programs', icon: FileText },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-brand-dark/80 backdrop-blur-lg border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/red-jitsu-logo.png?v=15"
              alt="Red Jitsu Training"
              width={36}
              height={36}
              className="rounded-xl"
              priority
            />
            <span className="font-bold text-lg">Red Jitsu</span>
            <DemoBadge />
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/workouts/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-red text-white font-medium hover:bg-red-600 transition-colors"
            >
              <Dumbbell className="w-4 h-4" />
              Start Workout
            </Link>
            <button
              onClick={signOut}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

// Mobile Header (minimal)
function MobileHeader() {
  return (
    <header
      className="md:hidden sticky top-0 z-40 bg-brand-dark/80 backdrop-blur-lg border-b border-white/5"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/red-jitsu-logo.png?v=15"
            alt="Red Jitsu Training"
            width={28}
            height={28}
            className="rounded-lg"
            priority
          />
          <span className="font-bold">Red Jitsu</span>
          <DemoBadge />
        </Link>
      </div>
    </header>
  )
}

// Bottom Navigation for Mobile
function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/history', label: 'History', icon: History },
    { href: '/programs', label: 'Programs', icon: FileText },
    { href: '/settings', label: 'Profile', icon: User },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-lg border-t border-white/5 pb-safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-1 flex-1 py-2
                transition-colors duration-200
                ${isActive ? 'text-brand-red' : 'text-zinc-500'}
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-2xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Floating Action Button with Quick Actions
function QuickActionFAB() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Don't show FAB on certain pages
  if (pathname?.includes('/workouts/new') || pathname?.includes('/workouts/edit')) {
    return null
  }

  const actions = [
    { href: '/workouts/new', label: 'Workout', icon: Dumbbell, color: 'bg-red-500' },
    { href: '/jiu-jitsu', label: 'Jiu-Jitsu', icon: Activity, color: 'bg-purple-500' },
    { href: '/cardio', label: 'Cardio', icon: Heart, color: 'bg-emerald-500' },
  ]

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed bottom-28 md:bottom-8 right-4 z-50 flex flex-col-reverse gap-3">
            {actions.map((action, index) => {
              const Icon = action.icon
              return (
                <motion.div
                  key={action.href}
                  initial={{ opacity: 0, scale: 0, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0, y: 20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={action.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center gap-3 pl-4 pr-5 py-3 rounded-full
                      ${action.color} text-white font-medium
                      shadow-lg hover:shadow-xl transition-shadow
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{action.label}</span>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-20 md:bottom-8 right-4 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-lg transition-all duration-200
          ${isOpen
            ? 'bg-zinc-800 rotate-45'
            : 'bg-brand-red shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40'
          }
        `}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Plus className="w-6 h-6 text-white" />
        )}
      </motion.button>
    </>
  )
}

// Main Navigation Component
export default function Navigation({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Check if we're in a full-screen mode (workout logging)
  const isWorkoutMode = workoutModeRoutes.some(route => pathname?.startsWith(route))

  async function signOut() {
    await supabase.auth.signOut()
    if (!DEMO) {
      router.push('/login')
    }
  }

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NEXT_PUBLIC_SW !== 'off') {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed:', err)
      })
    }
  }, [])

  // Don't show nav on login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Workout mode - minimal UI
  if (isWorkoutMode) {
    return (
      <div className="min-h-screen bg-brand-dark">
        <SafeAutoRefresh />
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-dark">
      <SafeAutoRefresh />
      <DesktopHeader signOut={signOut} />
      <MobileHeader />

      {/* Main Content */}
      <main className="pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* Floating Action Button */}
      <QuickActionFAB />
    </div>
  )
}

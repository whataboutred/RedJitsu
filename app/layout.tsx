import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import Navigation from '@/components/Navigation'
import { AuthProvider } from '@/components/AuthProvider'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Red Jitsu Training',
    template: '%s | Red Jitsu Training',
  },
  description: 'Track workouts, BJJ sessions, cardio, and more.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Red Jitsu Training',
    startupImage: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Red Jitsu Training',
    title: {
      default: 'Red Jitsu Training',
      template: '%s | Red Jitsu Training',
    },
    description: 'Track workouts, BJJ sessions, cardio, and more.',
  },
  twitter: {
    card: 'summary',
    title: {
      default: 'Red Jitsu Training',
      template: '%s | Red Jitsu Training',
    },
    description: 'Track workouts, BJJ sessions, cardio, and more.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon-192.png', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0D0B0C',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-brand-dark text-white antialiased font-sans">
        <AuthProvider>
          <ToastProvider>
            <Navigation>{children}</Navigation>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

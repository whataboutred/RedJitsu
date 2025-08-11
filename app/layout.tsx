import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Red Jitsu Training',
    template: '%s | Red Jitsu Training',
  },
  description: 'Track workouts, volume, trends, and more.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Red Jitsu Training',
    startupImage: '/apple-touch-icon.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
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
    description: 'Track workouts, volume, trends, and more.',
  },
  twitter: {
    card: 'summary',
    title: {
      default: 'Red Jitsu Training',
      template: '%s | Red Jitsu Training',
    },
    description: 'Track workouts, volume, trends, and more.',
  },
  icons: {
    icon: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

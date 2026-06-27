'use client'

import { motion } from 'framer-motion'

// Next.js remounts this on every navigation, so it gives each screen a quick
// cross-fade instead of an instant hard swap — a big part of the "native" feel.
//
// Intentionally opacity-only: a transform here would create a containing block
// and break every position:fixed element (bottom nav, save footer, modals,
// bottom sheets). Reduced-motion is honored globally via MotionConfig.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

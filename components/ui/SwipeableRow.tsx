'use client'

import { useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Trash2 } from 'lucide-react'

const REVEAL_PX = -88

/**
 * Swipe-left to reveal a delete action behind the row (tap still works
 * normally). Used by list items like the history timeline.
 */
export function SwipeableRow({
  children,
  onDelete,
  className = '',
}: {
  children: React.ReactNode
  onDelete: () => void
  className?: string
}) {
  const controls = useAnimation()
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
    controls.start({ x: 0 })
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <div className="absolute inset-y-0 right-0 flex w-[88px]">
        <button
          onClick={() => {
            close()
            onDelete()
          }}
          aria-label="Delete"
          tabIndex={open ? 0 : -1}
          className="flex h-full w-full items-center justify-center rounded-r-xl bg-red-600 text-white active:bg-red-700"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: REVEAL_PX, right: 0 }}
        dragElastic={0.08}
        animate={controls}
        onDragEnd={(_, info) => {
          const shouldOpen = info.offset.x < REVEAL_PX / 2 || info.velocity.x < -500
          setOpen(shouldOpen)
          controls.start({ x: shouldOpen ? REVEAL_PX : 0 })
        }}
        onClickCapture={(e) => {
          // A tap while the row is open closes it instead of navigating
          if (open) {
            e.stopPropagation()
            e.preventDefault()
            close()
          }
        }}
        className="relative bg-brand-dark"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default SwipeableRow

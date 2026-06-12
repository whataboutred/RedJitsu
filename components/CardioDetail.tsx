'use client'

import { useState, useEffect } from 'react'
import { getCardioSession, deleteCardioSession } from '@/lib/api'
import { getActiveUserId } from '@/lib/activeUser'
import { X, Edit3, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'

type CardioSession = {
  id: string
  activity: string
  duration_minutes: number | null
  distance: number | null
  distance_unit: string | null
  intensity: string | null
  calories: number | null
  notes: string | null
  performed_at: string
}

export default function CardioDetail({ 
  sessionId, 
  onClose,
  onUpdate 
}: { 
  sessionId: string
  onClose: () => void
  onUpdate?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<CardioSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    loadSessionData()
  }, [sessionId])

  async function loadSessionData() {
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      setSession(await getCardioSession(sessionId, userId))
    } catch (error) {
      console.error('Error loading cardio session:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      await deleteCardioSession(sessionId, userId)
      toast.success('Cardio session deleted')
      if (onUpdate) {
        onUpdate()
      }
      onClose()
    } catch (error) {
      toast.error('Failed to delete cardio session')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    router.push(`/cardio/edit/${sessionId}`)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3 py-1">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="rounded" className="h-24 w-full" />
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  if (!session) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-center justify-between">
          <div>Session not found or access denied.</div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
          <div>
            <div className="font-medium text-lg">{session.activity}</div>
            <div className="text-sm text-white/70">{new Date(session.performed_at).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleEdit}
              className="toggle text-sm px-3 py-1" 
              title="Edit session"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="p-2 hover:bg-white/5 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors" 
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="bg-black/30 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-4">
              {session.duration_minutes && (
                <div>
                  <div className="text-sm text-white/60">Duration</div>
                  <div className="font-medium">{session.duration_minutes} minutes</div>
                </div>
              )}
              
              {session.distance && session.distance_unit && (
                <div>
                  <div className="text-sm text-white/60">Distance</div>
                  <div className="font-medium">{session.distance} {session.distance_unit}</div>
                </div>
              )}
              
              {session.intensity && (
                <div>
                  <div className="text-sm text-white/60">Intensity</div>
                  <div className="font-medium capitalize">{session.intensity}</div>
                </div>
              )}
              
              {session.calories && (
                <div>
                  <div className="text-sm text-white/60">Calories</div>
                  <div className="font-medium">{session.calories} cal</div>
                </div>
              )}
            </div>

            {session.notes && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-sm text-white/60 mb-2">Notes</div>
                <div className="text-white/90">{session.notes}</div>
              </div>
            )}

            {!session.duration_minutes && !session.distance && !session.calories && !session.notes && (
              <div className="text-center text-white/60 py-4">
                No additional details recorded for this session.
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete cardio session?"
        message="This session will be permanently deleted. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
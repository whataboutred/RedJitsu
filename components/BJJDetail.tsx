'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { X, Edit3, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type BJJSession = {
  id: string
  performed_at: string
  kind: string
  duration_min: number
  intensity: string | null
  notes: string | null
}

export default function BJJDetail({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<BJJSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const userId = await getActiveUserId()
      if (!userId) return

      // Load BJJ session details
      const { data: s } = await supabase
        .from('bjj_sessions')
        .select('id,performed_at,kind,duration_min,intensity,notes')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()
      
      setSession(s as BJJSession)
      setLoading(false)
    })()
  }, [sessionId])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this Jiu Jitsu session? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      const { error } = await supabase
        .from('bjj_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId)

      if (error) {
        alert('Failed to delete session')
        console.error('Delete error:', error)
        return
      }

      // Close modal and refresh the page
      onClose()
      window.location.reload()
    } catch (error) {
      alert('Failed to delete session')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    // Navigate to edit page (we'll need to create this)
    router.push(`/jiu-jitsu/edit/${sessionId}`)
  }

  function formatKind(kind: string) {
    return kind.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  function formatIntensity(intensity: string | null) {
    if (!intensity) return ''
    return intensity.charAt(0).toUpperCase() + intensity.slice(1)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="card max-w-lg w-full">
        <div className="flex items-center justify-between">
          <div>Loading session details...</div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  if (!session) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="card max-w-lg w-full">
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
      <div className="card max-w-lg w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-medium">Jiu Jitsu Session</div>
            <div className="text-sm text-white/70">{new Date(session.performed_at).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleEdit}
              className="p-1 hover:bg-white/5 rounded-lg text-blue-400 hover:text-blue-300" 
              title="Edit session"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 hover:bg-white/5 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50" 
              title="Delete session"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="bg-black/30 rounded-xl p-3 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-white/70 mb-1">Type</div>
                <div className="font-medium text-white/90">{formatKind(session.kind)}</div>
              </div>
              <div>
                <div className="text-sm text-white/70 mb-1">Duration</div>
                <div className="font-medium text-white/90">{session.duration_min} minutes</div>
              </div>
            </div>
            
            {session.intensity && (
              <div>
                <div className="text-sm text-white/70 mb-1">Intensity</div>
                <div className="font-medium text-white/90">{formatIntensity(session.intensity)}</div>
              </div>
            )}
            
            {session.notes && (
              <div>
                <div className="text-sm text-white/70 mb-1">Notes</div>
                <div className="text-white/90 whitespace-pre-wrap">{session.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
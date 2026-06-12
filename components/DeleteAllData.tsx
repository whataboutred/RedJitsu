'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { ConfirmDialog } from '@/components/ui/BottomSheet'

export default function DeleteAllData() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>('')
  const [confirmText, setConfirmText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestDelete = async () => {
    // Require typing "DELETE" as extra confirmation
    if (confirmText !== 'DELETE') {
      setError('Type DELETE to confirm')
      return
    }

    // Verify user is authenticated before calling RPC
    const userId = await getActiveUserId()
    if (!userId) {
      setError('You must be signed in to delete data')
      return
    }

    setConfirmOpen(true)
  }

  const onDelete = async () => {
    setBusy(true)
    setError('')
    // RPC uses auth.uid() server-side via RLS — only deletes the authenticated user's data
    const { error } = await supabase.rpc('delete_my_data')
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="rounded-xl border border-white/10 p-4 bg-black/40">
        <div className="font-semibold mb-1">All data deleted</div>
        <div className="text-white/70 text-sm">
          Your logs and programs have been removed from our database.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 bg-black/40">
      <div className="font-semibold mb-2 text-red-400">Danger zone</div>
      <p className="text-white/70 text-sm mb-3">
        Permanently delete all your workouts, sets, programs, and Jiu Jitsu sessions.
        This cannot be undone.
      </p>
      <div className="mb-3">
        <label className="text-white/70 text-sm block mb-1">Type <strong className="text-red-400">DELETE</strong> to confirm</label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-600"
        />
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <button
        onClick={requestDelete}
        disabled={busy || confirmText !== 'DELETE'}
        className="rounded-xl border border-red-500/30 px-4 py-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Deleting…' : 'Delete all my data'}
      </button>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        title="Delete ALL your data?"
        message="Every workout, set, program, and session will be permanently deleted. This cannot be undone."
        confirmText="Delete everything"
        variant="danger"
      />
    </div>
  )
}

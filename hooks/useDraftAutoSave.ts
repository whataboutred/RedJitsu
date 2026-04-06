import { useEffect, useRef, useCallback, useState } from 'react'

export interface WorkoutDraft {
  items: any[]
  note: string
  customTitle: string
  location: string
  performedAt?: string // datetime-local value to preserve original start time
  timestamp: number
}

interface UseDraftAutoSaveOptions {
  draftKey: string
  autoSaveInterval?: number // milliseconds, default 10000 (10s)
  enabled?: boolean
}

interface UseDraftAutoSaveReturn {
  saveDraft: (draft: Omit<WorkoutDraft, 'timestamp'>) => void
  loadDraft: () => WorkoutDraft | null
  clearDraft: () => void
  hasDraft: boolean
  lastSaved: number | null
  hasUnsavedChanges: boolean
  markAsSaved: () => void
}

export function useDraftAutoSave({
  draftKey,
  autoSaveInterval = 10000,
  enabled = true,
}: UseDraftAutoSaveOptions): UseDraftAutoSaveReturn {
  const [hasDraft, setHasDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const draftDataRef = useRef<Omit<WorkoutDraft, 'timestamp'> | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()
  const lastSavedHashRef = useRef<string>('')

  // Check if draft exists on mount
  useEffect(() => {
    const draft = loadDraft()
    setHasDraft(draft !== null)
    if (draft) {
      setLastSaved(draft.timestamp)
    }
  }, [draftKey])

  const saveDraft = useCallback((draft: Omit<WorkoutDraft, 'timestamp'>) => {
    if (!enabled) return

    const workoutDraft: WorkoutDraft = {
      ...draft,
      timestamp: Date.now(),
    }

    try {
      localStorage.setItem(draftKey, JSON.stringify(workoutDraft))
      setHasDraft(true)
      setLastSaved(workoutDraft.timestamp)

      // Update hash to track saved state
      lastSavedHashRef.current = JSON.stringify(draft)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save draft:', error)
    }
  }, [draftKey, enabled])

  const loadDraft = useCallback((): WorkoutDraft | null => {
    try {
      const saved = localStorage.getItem(draftKey)
      if (!saved) return null

      const draft = JSON.parse(saved) as WorkoutDraft
      return draft
    } catch (error) {
      console.error('Failed to load draft:', error)
      return null
    }
  }, [draftKey])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey)
      setHasDraft(false)
      setLastSaved(null)
      setHasUnsavedChanges(false)
      lastSavedHashRef.current = ''
      draftDataRef.current = null
    } catch (error) {
      console.error('Failed to clear draft:', error)
    }
  }, [draftKey])

  const markAsSaved = useCallback(() => {
    if (draftDataRef.current) {
      lastSavedHashRef.current = JSON.stringify(draftDataRef.current)
    }
    setHasUnsavedChanges(false)
  }, [])

  // Auto-save effect with save-on-unload and save-on-visibility-change
  useEffect(() => {
    if (!enabled) return

    const saveIfChanged = () => {
      if (draftDataRef.current) {
        const currentHash = JSON.stringify(draftDataRef.current)
        if (currentHash !== lastSavedHashRef.current) {
          saveDraft(draftDataRef.current)
        }
      }
    }

    // Periodic auto-save
    intervalRef.current = setInterval(saveIfChanged, autoSaveInterval)

    // Save immediately when user navigates away or closes tab
    const handleBeforeUnload = () => saveIfChanged()

    // Save when user switches to another tab/app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveIfChanged()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Final save on unmount
      saveIfChanged()
    }
  }, [enabled, autoSaveInterval, saveDraft])

  // Method to update draft data and track changes
  const updateDraftData = useCallback((draft: Omit<WorkoutDraft, 'timestamp'>) => {
    draftDataRef.current = draft

    // Check if data has changed from last saved state
    const currentHash = JSON.stringify(draft)
    if (currentHash !== lastSavedHashRef.current) {
      setHasUnsavedChanges(true)
    }
  }, [])

  // Expose updateDraftData through saveDraft
  const enhancedSaveDraft = useCallback((draft: Omit<WorkoutDraft, 'timestamp'>) => {
    updateDraftData(draft)
    saveDraft(draft)
  }, [updateDraftData, saveDraft])

  return {
    saveDraft: enhancedSaveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    lastSaved,
    hasUnsavedChanges,
    markAsSaved,
  }
}

// Helper function to format time ago
export function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 120) return '1 minute ago'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 7200) return '1 hour ago'
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  return `${Math.floor(seconds / 86400)} days ago`
}

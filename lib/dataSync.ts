'use client'

/**
 * Cross-page data refresh signal. Pages subscribe with useDataRefresh
 * (hooks/useDataRefresh.ts); mutations call notifyDataChanged() so every
 * open view refetches without a manual reload.
 *
 * The localStorage write fires `storage` events in other tabs; the
 * CustomEvent covers same-window navigation.
 */
export const DATA_UPDATED_KEY = 'workout-data-updated'

export function notifyDataChanged() {
  try {
    const ts = String(Date.now())
    localStorage.setItem(DATA_UPDATED_KEY, ts)
    window.dispatchEvent(new CustomEvent(DATA_UPDATED_KEY, { detail: { ts } }))
  } catch {
    // localStorage may be unavailable (private mode) — same-window event only
    window.dispatchEvent(new CustomEvent(DATA_UPDATED_KEY))
  }
}

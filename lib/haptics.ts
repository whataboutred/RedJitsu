/**
 * Light haptic feedback wrappers. No-ops where the Vibration API is
 * unavailable (desktop browsers, iOS Safari).
 */

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      // ignore — haptics are best-effort
    }
  }
}

/** Quick tick for small interactions (completing a set, toggling). */
export function hapticTap() {
  vibrate(10)
}

/** Stronger double-pulse for successes (workout saved, PR hit). */
export function hapticSuccess() {
  vibrate([100, 50, 100])
}

/** Long celebration pattern for big moments (new personal record). */
export function hapticCelebrate() {
  vibrate([100, 50, 100, 50, 200])
}
